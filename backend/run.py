"""Single entrypoint: the API and the bot share one process and one event loop.

Railway runs one command per service, and this tracker is far too small to
justify paying for two. Both halves are cancelled together, so the container
exits cleanly if either one dies.
"""

from __future__ import annotations

import asyncio
import logging
import os

import uvicorn

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("run")


async def serve_api() -> None:
    config = uvicorn.Config(
        "app.main:app",
        host="0.0.0.0",
        port=int(os.environ.get("PORT", "8000")),
        log_level=os.environ.get("LOG_LEVEL", "info").lower(),
        access_log=False,
    )
    await uvicorn.Server(config).serve()


async def serve_bot() -> None:
    # Imported lazily so a bot misconfiguration cannot stop the API booting.
    from bot import main as bot_main

    await bot_main()


async def main() -> None:
    run_bot = os.environ.get("RUN_BOT", "1").strip().lower() not in {"0", "false", "no"}

    tasks = [asyncio.create_task(serve_api(), name="api")]
    if run_bot:
        tasks.append(asyncio.create_task(serve_bot(), name="bot"))
    else:
        logger.info("RUN_BOT is off — serving the API only")

    done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)

    for task in done:
        if task.exception() is not None:
            logger.error("%s stopped", task.get_name(), exc_info=task.exception())

    for task in pending:
        task.cancel()
    await asyncio.gather(*pending, return_exceptions=True)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
