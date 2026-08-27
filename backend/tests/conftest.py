import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Settings are read at import time, so the environment must be complete before
# any application module loads.
os.environ.setdefault("BOT_TOKEN", "123456:TEST-TOKEN-FOR-UNIT-TESTS")
os.environ.setdefault("ALLOWED_TELEGRAM_ID", "42")
os.environ.setdefault("SPREADSHEET_ID", "test-spreadsheet")
os.environ.setdefault("WEBAPP_URL", "https://example.test")
os.environ.setdefault("GOOGLE_CREDENTIALS_JSON", "{}")

from app.services.repository import Repository  # noqa: E402

from .fake_sheets import FakeSheets  # noqa: E402


FINANCE = [
    ["Финансы"],                                    # a title row the parser must skip
    [],
    ["Долг", "Сумма", "Ставка", "Мин. платёж", "Осталось"],
    ["Kaspi Red", "300 000", "0%", "25 000", "180 000"],
    ["Рассрочка", "120 000", "12%", "10 000", "40 000"],
    [],
    ["Кэшфлоу по неделям"],
    ["Период", "Доход Nedelka", "Доход прочее", "Обязательные траты", "На долг", "Остаток"],
    ["01.09.2025 – 07.09.2025", "150 000", "0", "60 000", "40 000", "50 000"],
    ["08.09.2025 – 14.09.2025", "170 000", "20 000", "60 000", "40 000", "90 000"],
]

BODY = [
    ["Дата", "Вес", "Тренировки", "Заметка"],
    ["01.09.2025", "84,5", "2", ""],
    ["08.09.2025", "83,2", "3", "хорошая неделя"],
]

JOBS = [
    ["Компания", "Роль", "Дата отклика", "Статус", "Заметка"],
    ["Kaspi", "Analyst", "02.09.2025", "Отклик", ""],
    ["Halyk", "Data Analyst", "03.09.2025", "Собес", ""],
    ["Chocofamily", "BI", "04.09.2025", "Оффер", ""],
    ["Freedom", "Analyst", "05.09.2025", "Отказ", ""],
]

HABITS = [
    ["Дата", "медитация", "Тренировка", "Работа сделана", "Настроение"],
    ["06.09.2025", "Да", "Да", "Да", "4"],
    ["07.09.2025", "Да", "Нет", "Да", "3"],
    ["08.09.2025", "Да", "Да", "Да", "5"],
]


@pytest.fixture
def grids() -> dict[str, list[list[str]]]:
    return {
        "Финансы": [list(r) for r in FINANCE],
        "Тело": [list(r) for r in BODY],
        "Работа": [list(r) for r in JOBS],
        "Привычки": [list(r) for r in HABITS],
    }


@pytest.fixture
def fake(grids) -> FakeSheets:
    return FakeSheets(grids)


@pytest.fixture
def repo(fake) -> Repository:
    return Repository(sheets=fake)
