"""Telegram WebApp initData validation.

This is the only authentication in the product: the Mini App hands us the
`initData` string Telegram signed for it, we verify the HMAC and check that the
user inside it is the single allowed account. No login, no sessions.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from urllib.parse import parse_qsl

from fastapi import Header, HTTPException, status

from .config import get_settings


@dataclass(frozen=True)
class TelegramUser:
    id: int
    first_name: str
    username: str | None


class InitDataError(Exception):
    """initData is missing, malformed, expired or not signed by our bot."""


def _secret_key(bot_token: str) -> bytes:
    return hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()


def _check_string(pairs: list[tuple[str, str]], *, skip: set[str]) -> str:
    return "\n".join(
        f"{key}={value}" for key, value in sorted(pairs) if key not in skip
    )


def verify_init_data(init_data: str, *, bot_token: str, max_age: int) -> TelegramUser:
    """Verify `initData` and return the user it describes.

    Raises InitDataError when the payload is unsigned, tampered with or stale.
    """
    if not init_data:
        raise InitDataError("initData is empty")

    pairs = parse_qsl(init_data, keep_blank_values=True)
    fields = dict(pairs)

    received_hash = fields.get("hash")
    if not received_hash:
        raise InitDataError("initData has no hash field")

    secret = _secret_key(bot_token)

    # Telegram's documented scheme excludes only `hash` from the check string.
    # Some client versions additionally send an Ed25519 `signature` field; older
    # validation snippets strip it, so accept either form rather than locking
    # the app out after a client update.
    candidates = [{"hash"}, {"hash", "signature"}]
    for skip in candidates:
        expected = hmac.new(
            secret, _check_string(pairs, skip=skip).encode(), hashlib.sha256
        ).hexdigest()
        if hmac.compare_digest(expected, received_hash):
            break
    else:
        raise InitDataError("initData signature does not match")

    auth_date = fields.get("auth_date")
    if not auth_date or not auth_date.isdigit():
        raise InitDataError("initData has no usable auth_date")
    if max_age > 0 and time.time() - int(auth_date) > max_age:
        raise InitDataError("initData has expired, reopen the Mini App")

    raw_user = fields.get("user")
    if not raw_user:
        raise InitDataError("initData contains no user")
    try:
        user = json.loads(raw_user)
    except json.JSONDecodeError as exc:
        raise InitDataError("initData user field is not valid JSON") from exc

    user_id = user.get("id")
    if not isinstance(user_id, int):
        raise InitDataError("initData user has no numeric id")

    return TelegramUser(
        id=user_id,
        first_name=user.get("first_name") or "",
        username=user.get("username"),
    )


async def require_user(
    authorization: str | None = Header(default=None),
    x_telegram_init_data: str | None = Header(default=None, alias="X-Telegram-Init-Data"),
) -> TelegramUser:
    """FastAPI dependency guarding every /api route.

    Accepts the initData either as `X-Telegram-Init-Data` or as
    `Authorization: tma <initData>`.
    """
    settings = get_settings()

    init_data = x_telegram_init_data
    if not init_data and authorization:
        scheme, _, value = authorization.partition(" ")
        if scheme.lower() == "tma":
            init_data = value

    try:
        user = verify_init_data(
            init_data or "",
            bot_token=settings.bot_token,
            max_age=settings.init_data_max_age,
        )
    except InitDataError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)
        ) from exc

    if user.id != settings.allowed_telegram_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This tracker is private.",
        )

    return user
