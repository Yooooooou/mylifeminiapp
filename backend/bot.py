"""Telegram bot: the door to the Mini App, plus the evening check-in nudge.

The bot deliberately does almost nothing itself — every screen lives in the
Mini App. It exists to host the launch button and to notice when today's
check-in is still empty.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import date

from aiogram import Bot, Dispatcher, F
from aiogram.client.default import DefaultBotProperties
from aiogram.exceptions import TelegramBadRequest
from aiogram.filters import Command, CommandStart
from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
    MenuButtonWebApp,
    WebAppInfo,
)
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.config import get_settings
from app.services.repository import Repository

logger = logging.getLogger(__name__)

settings = get_settings()
bot = Bot(
    token=settings.bot_token,
    default=DefaultBotProperties(parse_mode="HTML"),
)
dispatcher = Dispatcher()


# Every entry point is an inline button. A reply-keyboard button carrying a
# web_app opens the Mini App on Telegram Desktop without signing initData, so
# the app loads and then fails auth. Inline buttons sign it on every client.
def _inline_webapp(text: str = "Открыть трекер", path: str = "") -> InlineKeyboardMarkup:
    url = settings.webapp_url.rstrip("/") + (f"/{path.lstrip('/')}" if path else "")
    return InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(text=text, web_app=WebAppInfo(url=url))]]
    )


def _is_owner(message: Message) -> bool:
    return bool(message.from_user and message.from_user.id == settings.allowed_telegram_id)


@dispatcher.message(CommandStart())
async def on_start(message: Message) -> None:
    if not _is_owner(message):
        await message.answer("Это личный трекер.")
        return

    await message.answer(
        "<b>Life Tracker</b>\n\n"
        "Финансы, тело, работа и привычки — в одном экране.\n"
        "Жми кнопку ниже, чтобы открыть трекер.",
        reply_markup=_inline_webapp("📊 Открыть трекер"),
    )


@dispatcher.message(Command("checkin"))
async def on_checkin(message: Message) -> None:
    if not _is_owner(message):
        return
    await message.answer(
        "Чек-ин на сегодня:",
        reply_markup=_inline_webapp("Заполнить чек-ин", "#/habits"),
    )


@dispatcher.message(F.text)
async def on_any(message: Message) -> None:
    if not _is_owner(message):
        return
    await message.answer(
        "Всё происходит в трекере — открывай его кнопкой ниже.",
        reply_markup=_inline_webapp("📊 Открыть трекер"),
    )


async def remind_checkin() -> None:
    """Nudge once in the evening, but only if today's check-in is incomplete."""
    try:
        entry = await asyncio.to_thread(Repository().get_habits_for, date.today())
    except Exception:  # noqa: BLE001 - a reminder must never crash the scheduler
        logger.exception("Could not read today's check-in for the reminder")
        return

    if entry.complete:
        logger.info("Check-in already complete, staying quiet")
        return

    await bot.send_message(
        settings.allowed_telegram_id,
        "🌙 Чек-ин на сегодня ещё не заполнен.",
        reply_markup=_inline_webapp("Заполнить за 10 секунд", "#/habits"),
    )


async def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )

    # The menu button is a convenience: /start still offers the same WebApp
    # button inline. Losing it is not worth taking the API down with the bot,
    # so log the reason and carry on.
    try:
        await bot.set_chat_menu_button(
            menu_button=MenuButtonWebApp(
                text="Трекер", web_app=WebAppInfo(url=settings.webapp_url)
            )
        )
    except TelegramBadRequest as exc:
        logger.error("Could not set the menu button: %s", exc)

    scheduler: AsyncIOScheduler | None = None
    if settings.reminder_enabled:
        scheduler = AsyncIOScheduler(timezone=settings.reminder_tz)
        scheduler.add_job(
            remind_checkin,
            "cron",
            hour=settings.reminder_hour,
            minute=settings.reminder_minute,
            id="habits-reminder",
            replace_existing=True,
        )
        scheduler.start()
        logger.info(
            "Reminder scheduled for %02d:%02d %s",
            settings.reminder_hour, settings.reminder_minute, settings.reminder_tz,
        )

    try:
        await dispatcher.start_polling(bot)
    finally:
        if scheduler is not None:
            scheduler.shutdown(wait=False)
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
