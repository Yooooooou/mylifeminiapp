"""Application settings, loaded exclusively from environment variables.

Secrets (bot token, Google service account JSON) never live in the repo —
Railway injects them as environment variables / secrets.
"""

from __future__ import annotations

import json
import os
from functools import lru_cache


# backend/app/config.py -> backend/app -> backend -> repo root
_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class ConfigError(RuntimeError):
    """Raised when a required environment variable is missing or malformed."""


def _require(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise ConfigError(
            f"Environment variable {name} is required but was not set. "
            "Configure it in Railway variables (see .env.example)."
        )
    return value


class Settings:
    """Runtime configuration for the backend, bot and Sheets client."""

    def __init__(self) -> None:
        self.bot_token: str = _require("BOT_TOKEN")
        self.allowed_telegram_id: int = int(_require("ALLOWED_TELEGRAM_ID"))
        self.spreadsheet_id: str = _require("SPREADSHEET_ID")

        # Public https URL of the Mini App, used for the bot's WebApp button.
        self.webapp_url: str = _require("WEBAPP_URL")

        # Seconds an initData payload stays acceptable. Telegram recommends
        # rejecting stale payloads to limit replay of a leaked initData string.
        self.init_data_max_age: int = int(os.environ.get("INIT_DATA_MAX_AGE", "86400"))

        # Dashboard reads hit several sheets at once; a short cache keeps the
        # screen responsive without serving visibly stale numbers.
        self.cache_ttl: int = int(os.environ.get("CACHE_TTL_SECONDS", "45"))

        # Directory with the built frontend (index.html + assets). Optional:
        # the frontend may be deployed as a separate static service instead.
        # Resolved from the repo root, so it works whatever the working
        # directory the process was started from.
        self.static_dir: str = os.environ.get("STATIC_DIR") or os.path.join(
            _REPO_ROOT, "frontend", "dist"
        )

        self.cors_origins: list[str] = [
            origin.strip()
            for origin in os.environ.get("CORS_ORIGINS", "").split(",")
            if origin.strip()
        ]

        # Sheet (tab) names inside the spreadsheet. Overridable in case the
        # user renames a tab, but the defaults match the existing file.
        self.sheet_finance: str = os.environ.get("SHEET_FINANCE", "Финансы")
        self.sheet_body: str = os.environ.get("SHEET_BODY", "Тело")
        self.sheet_jobs: str = os.environ.get("SHEET_JOBS", "Работа")
        self.sheet_habits: str = os.environ.get("SHEET_HABITS", "Привычки")

        # Daily reminder time (local to REMINDER_TZ) for the habits check-in.
        self.reminder_hour: int = int(os.environ.get("REMINDER_HOUR", "21"))
        self.reminder_minute: int = int(os.environ.get("REMINDER_MINUTE", "0"))
        self.reminder_tz: str = os.environ.get("REMINDER_TZ", "Asia/Almaty")
        self.reminder_enabled: bool = _as_bool(os.environ.get("REMINDER_ENABLED", "1"))

    def google_credentials(self) -> dict:
        """Return the service account payload as a dict.

        Accepts either raw JSON in GOOGLE_CREDENTIALS_JSON or a path to a
        mounted key file in GOOGLE_APPLICATION_CREDENTIALS.
        """
        raw = os.environ.get("GOOGLE_CREDENTIALS_JSON", "").strip()
        if raw:
            try:
                return json.loads(raw)
            except json.JSONDecodeError as exc:  # pragma: no cover - config error
                raise ConfigError(
                    "GOOGLE_CREDENTIALS_JSON is set but is not valid JSON."
                ) from exc

        path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "").strip()
        if path:
            if not os.path.exists(path):
                raise ConfigError(
                    f"GOOGLE_APPLICATION_CREDENTIALS points to {path}, which does not exist."
                )
            with open(path, "r", encoding="utf-8") as handle:
                return json.load(handle)

        raise ConfigError(
            "Google credentials are required: set GOOGLE_CREDENTIALS_JSON "
            "(raw service account JSON) or GOOGLE_APPLICATION_CREDENTIALS (file path)."
        )


def _as_bool(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes", "on"}


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
