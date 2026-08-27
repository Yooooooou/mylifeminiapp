"""initData verification is the whole authentication story — test it properly."""

import hashlib
import hmac
import json
import time
from urllib.parse import parse_qsl, urlencode

import pytest

from app.auth import InitDataError, verify_init_data

TOKEN = "123456:TEST-TOKEN-FOR-UNIT-TESTS"


def make_init_data(
    *, user_id: int = 42, auth_date: int | None = None, token: str = TOKEN, **extra
) -> str:
    user = {"id": user_id, "first_name": "Sanzhar", "username": "sanzhar"}
    fields = {
        "user": json.dumps(user, separators=(",", ":"), ensure_ascii=False),
        "auth_date": str(auth_date if auth_date is not None else int(time.time())),
        "query_id": "AAEtest",
        **extra,
    }
    check = "\n".join(f"{k}={v}" for k, v in sorted(fields.items()))
    secret = hmac.new(b"WebAppData", token.encode(), hashlib.sha256).digest()
    fields["hash"] = hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()
    return urlencode(fields)


def test_accepts_a_properly_signed_payload():
    user = verify_init_data(make_init_data(), bot_token=TOKEN, max_age=86400)
    assert user.id == 42
    assert user.username == "sanzhar"


def test_rejects_a_tampered_user_id():
    """The classic attack: swap the id but keep the original signature."""
    fields = dict(parse_qsl(make_init_data(user_id=42)))
    user = json.loads(fields["user"])
    user["id"] = 999
    fields["user"] = json.dumps(user, separators=(",", ":"), ensure_ascii=False)

    with pytest.raises(InitDataError, match="signature"):
        verify_init_data(urlencode(fields), bot_token=TOKEN, max_age=86400)


def test_rejects_a_signature_from_another_bot():
    raw = make_init_data(token="999999:SOMEONE-ELSES-BOT")
    with pytest.raises(InitDataError):
        verify_init_data(raw, bot_token=TOKEN, max_age=86400)


def test_rejects_a_stale_payload():
    raw = make_init_data(auth_date=int(time.time()) - 90000)
    with pytest.raises(InitDataError, match="expired"):
        verify_init_data(raw, bot_token=TOKEN, max_age=86400)


def test_accepts_a_stale_payload_when_expiry_is_disabled():
    raw = make_init_data(auth_date=int(time.time()) - 90000)
    assert verify_init_data(raw, bot_token=TOKEN, max_age=0).id == 42


def test_rejects_an_unsigned_payload():
    with pytest.raises(InitDataError, match="no hash"):
        verify_init_data("user=%7B%22id%22%3A42%7D", bot_token=TOKEN, max_age=86400)


def test_rejects_empty_init_data():
    with pytest.raises(InitDataError):
        verify_init_data("", bot_token=TOKEN, max_age=86400)


def test_handles_the_newer_signature_field():
    """Newer clients add an Ed25519 `signature`; both check-string forms pass."""
    raw = make_init_data(signature="abc123")
    assert verify_init_data(raw, bot_token=TOKEN, max_age=86400).id == 42
