"""Startup must survive a bad moment on the Telegram API.

Setting the menu button is the first call the bot makes, before polling has
started retrying anything, and the bot shares its process with the API — so an
exception there used to take the whole container down.
"""

import asyncio
from unittest.mock import AsyncMock, patch

import pytest
from aiogram.exceptions import TelegramBadRequest, TelegramNetworkError

import bot as bot_module


def _network_error() -> TelegramNetworkError:
    return TelegramNetworkError(method=None, message="Connection reset by peer")


def _bad_request() -> TelegramBadRequest:
    return TelegramBadRequest(method=None, message="Only HTTPS links are allowed")


@pytest.mark.parametrize(
    "failure",
    [_network_error(), _bad_request(), RuntimeError("something else entirely")],
    ids=["network", "bad-request", "unexpected"],
)
def test_a_failed_menu_button_never_stops_startup(failure):
    with patch.object(bot_module.bot, "set_chat_menu_button", AsyncMock(side_effect=failure)):
        # No exception escapes: the API half of the process keeps serving.
        asyncio.run(bot_module._set_menu_button())


def test_the_menu_button_points_at_the_configured_url():
    call = AsyncMock()
    with patch.object(bot_module.bot, "set_chat_menu_button", call):
        asyncio.run(bot_module._set_menu_button())

    button = call.await_args.kwargs["menu_button"]
    assert button.web_app.url == bot_module.settings.webapp_url


def test_clearing_the_old_keyboard_never_breaks_the_reply():
    class Failing:
        async def answer(self, *args, **kwargs):
            raise _network_error()

    # /start still has to answer even when the retraction cannot be delivered.
    asyncio.run(bot_module._drop_stale_keyboard(Failing()))
