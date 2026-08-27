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
from aiogram.exceptions import TelegramBadRequest, TelegramNetworkError
from aiogram.filters import Command, CommandStart
from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
    MenuButtonWebApp,
    ReplyKeyboardRemove,
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


async def _set_menu_button() -> None:
    """Install the menu button, treating any failure as unimportant.

    It is a convenience — /start offers the same WebApp button inline — but it
    is also the first call the bot makes, before polling has started retrying
    anything. Catching only TelegramBadRequest meant a reset connection to
    api.telegram.org at that moment raised TelegramNetworkError, killed the bot
    task, and took the API down with it. Nothing here is worth an outage.
    """
    try:
        await bot.set_chat_menu_button(
            menu_button=MenuButtonWebApp(
                text="Трекер", web_app=WebAppInfo(url=settings.webapp_url)
            )
        )
    except (TelegramBadRequest, TelegramNetworkError) as exc:
        logger.warning("Menu button not set: %s", exc)
    except Exception:  # noqa: BLE001 — startup must survive anything here
        logger.warning("Menu button not set", exc_info=True)


async def _drop_stale_keyboard(message: Message) -> None:
    """Take down the persistent reply keyboard earlier versions installed.

    That keyboard carried a web_app button, and Telegram does not sign initData
    for one — the Mini App opened and then failed every request. Dropping the
    sending code did not retract the keyboard already pinned in the chat:
    is_persistent keeps it there until something explicitly removes it, so it
    outlived the fix and kept being the obvious button to press.

    A reply keyboard can only be removed by a message that carries the removal,
    hence the throwaway that is deleted immediately.
    """
    try:
        notice = await message.answer("…", reply_markup=ReplyKeyboardRemove())
        await notice.delete()
    except Exception:  # noqa: BLE001 — /start must answer even if this fails
        logger.warning("Could not clear the old reply keyboard", exc_info=True)


def _is_owner(message: Message) -> bool:
    return bool(message.from_user and message.from_user.id == settings.allowed_telegram_id)


@dispatcher.message(CommandStart())
async def on_start(message: Message) -> None:
    if not _is_owner(message):
        await message.answer("Это личный трекер.")
        return

    await _drop_stale_keyboard(message)
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
    await _drop_stale_keyboard(message)
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

    await _set_menu_button()

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
