"""FastAPI application: API routes plus the built Mini App as static files."""

from __future__ import annotations

import logging
import os
import re

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import get_settings
from .routers.api import router as api_router
from .sheets import SheetsConfigError, SheetsUnavailable

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Life Tracker", docs_url=None, redoc_url=None, openapi_url=None)

settings = get_settings()

if settings.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.exception_handler(SheetsUnavailable)
async def _sheets_unavailable(_: Request, exc: SheetsUnavailable) -> JSONResponse:
    """Rate limits and outages become a sentence the user can act on."""
    logger.warning("Sheets unavailable: %s", exc)
    return JSONResponse(
        status_code=503,
        content={"detail": "Google Sheets сейчас недоступен. Попробуй ещё раз через минуту."},
    )


@app.exception_handler(SheetsConfigError)
async def _sheets_misconfigured(_: Request, exc: SheetsConfigError) -> JSONResponse:
    logger.error("Sheets misconfigured: %s", exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "Таблица недоступна: проверь доступ сервис-аккаунта и SPREADSHEET_ID."},
    )


@app.exception_handler(Exception)
async def _unhandled(_: Request, exc: Exception) -> JSONResponse:
    """Never leak a stack trace into the Mini App."""
    logger.exception("Unhandled error", exc_info=exc)
    return JSONResponse(
        status_code=500, content={"detail": "Что-то пошло не так. Попробуй ещё раз."}
    )


def _bundle_id() -> str:
    """Name of the JS bundle index.html currently points at.

    A Mini App webview can hold a cached shell for a long time, and every
    version of a bug then looks identical from the outside. Opening /health in
    a browser answers "which build is actually live" without a deploy log.
    """
    index = os.path.join(os.path.abspath(settings.static_dir), "index.html")
    try:
        with open(index, encoding="utf-8") as handle:
            match = re.search(r"assets/(index-[A-Za-z0-9_-]+\.js)", handle.read())
    except OSError:
        return "no-frontend"
    return match.group(1) if match else "unknown"


@app.get("/health")
def health() -> dict:
    return {"ok": True, "bundle": _bundle_id()}


@app.middleware("http")
async def cache_headers(request: Request, call_next):
    """Let hashed assets cache forever, and never let the shell go stale.

    Vite fingerprints every asset filename, so those are safe to keep. The
    shell is what points at them, and without a directive of its own a webview
    is free to reuse the old one — which pins the app to a bundle that a
    deploy has already replaced.
    """
    response = await call_next(request)
    path = request.url.path
    if path.startswith("/assets/"):
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    elif not path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-cache, must-revalidate"
    return response


app.include_router(api_router)


# The built frontend is optional: when the Mini App is deployed as a separate
# static service, STATIC_DIR simply won't exist and the API runs on its own.
_static = os.path.abspath(settings.static_dir)
if os.path.isdir(_static):
    assets = os.path.join(_static, "assets")
    if os.path.isdir(assets):
        app.mount("/assets", StaticFiles(directory=assets), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa(full_path: str) -> FileResponse:
        """Serve the SPA shell for any non-API path."""
        candidate = os.path.abspath(os.path.join(_static, full_path))
        # Guard against ../ escaping the static root before touching the disk.
        if (
            full_path
            and os.path.commonpath([candidate, _static]) == _static
            and os.path.isfile(candidate)
        ):
            return FileResponse(candidate)
        return FileResponse(os.path.join(_static, "index.html"))
else:
    logger.info("STATIC_DIR %s not found — serving API only", _static)
