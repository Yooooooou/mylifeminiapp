"""Parsing the actual «МОЯ ЖИЗНЬ» spreadsheet, not an idealised version of it.

The fixtures below mirror the real tabs cell for cell: two stacked tables with
totals under them on Финансы, pre-dated empty rows on Тело and Привычки,
aggregate rows below the Работа table, and the "(1/0)" and "Сумма
(изначально)" style headers. Each of those broke a different assumption the
first mapping made from the spec alone.
"""

from datetime import date

import pytest

from app.models import BodyCreate, HabitUpsert
from app.services.repository import Repository

from .fake_sheets import FakeSheets

FINANCE = [
    ["Финансы"],
    ["Жёлтые ячейки — заполняй сам. Остальное считается формулами."],
    [],
    ["ДОЛГИ"],
    ["Долг", "Сумма (изначально)", "Ставка, %", "Мин. платёж", "Осталось сейчас"],
    ["поездка вьетнам", "341821", "0", "14244", "284845"],
    ["покупка мака", "588084", "0", "49008", "539076"],
    ["кредит нал", "100000", "10", "5154", "51683"],
    ["ванфит", "259990", "0", "10834", "140816"],
    [], [], [],
    ["ИТОГО ДОЛГ", "", "", "", "1016420"],
    [], [],
    ["КЭШФЛОУ (по неделям/месяцам)"],
    ["Период", "Доход (Nedelka)", "Доход (прочее)", "Обязательные траты",
     "На долг", "Остаток"],
    ["Пример: неделя 1", "60000", "0", "40000", "15000", "5000"],
]

# Тело is dated weekly into the future with only the first row filled in.
BODY = [
    ["Тело"],
    ["Заполняй раз в несколько дней. Без КБЖУ — просто вес и тренировки."],
    [],
    ["Дата", "Вес, кг", "Тренировки (из 3 за неделю)", "Заметка"],
    ["2026-08-27", "100", "2", "начало отсчёта"],
    ["2026-09-03", "", "", ""],
    ["2026-09-10", "", "", ""],
    ["2026-09-17", "", "", ""],
]

JOBS = [
    ["Работа"],
    [],
    [],
    ["Компания", "Роль", "Дата отклика", "Статус", "Заметка"],
    ["DELTA M Kazakhstan", "Business Analyst", "2026-08-01", "Собес", "ждём фидбек"],
    ["Daribar", "Junior Product Analyst", "2026-08-10", "Собес", ""],
    [], [],
    ["Всего откликов", "2"],
    ["Собеседований", "2"],
    ["Офферов", "0"],
    ["Конверсия отклик → оф", "0"],
]

# Rows 2026-08-32 onwards are a real defect in the sheet: text that looks like
# a date but is not one. They must be skipped, never crash the parse.
HABITS = [
    ["Привычки"],
    ["Ежедневный чек-ин — 30 секунд вечером. 1 = да, 0 = нет."],
    [],
    ["Дата", "медитация (1/0)", "Тренировка (1/0)", "Работа сделана (1/0)",
     "Настроение (1-5)"],
    ["2026-08-27", "", "", "", ""],
    ["2026-08-28", "", "", "", ""],
    ["2026-08-31", "", "", "", ""],
    ["2026-08-32", "", "", "", ""],
    ["2026-08-57", "", "", "", ""],
]


@pytest.fixture
def repo() -> Repository:
    return Repository(FakeSheets({
        "Финансы": [list(r) for r in FINANCE],
        "Тело": [list(r) for r in BODY],
        "Работа": [list(r) for r in JOBS],
        "Привычки": [list(r) for r in HABITS],
    }))


def test_debts_read_past_the_renamed_headers(repo):
    debts = repo.list_debts()
    assert [d.name for d in debts] == [
        "поездка вьетнам", "покупка мака", "кредит нал", "ванфит"
    ]
    # 'Сумма (изначально)' and 'Осталось сейчас' must map to total/remaining.
    assert debts[0].total == 341821
    assert debts[0].remaining == 284845
    assert debts[2].rate == 10


def test_the_totals_row_is_not_a_debt(repo):
    names = [d.name for d in repo.list_debts()]
    assert "ИТОГО ДОЛГ" not in names
    # Its 1 016 420 would otherwise double the dashboard's debt figure.
    assert round(sum(d.remaining for d in repo.list_debts())) == 1016420


def test_body_ignores_rows_that_only_carry_a_future_date(repo):
    weighed = [e for e in repo.list_body() if e.weight is not None]
    assert len(weighed) == 1
    assert weighed[0].weight == 100
    assert weighed[0].workouts == 2  # the weekly count, as a number


def test_weight_fills_the_row_already_dated_for_that_day(repo):
    row = repo.create_body(BodyCreate(date=date(2026, 9, 3), weight=99.2))
    assert row == 6, "must reuse the pre-dated row, not append below 2026-09-17"
    assert str(repo.sheets.grids["Тело"][5][1]) == "99.2"


def test_a_weight_for_an_undated_day_is_appended(repo):
    row = repo.create_body(BodyCreate(date=date(2027, 1, 7), weight=95.0))
    assert row == 9


def test_jobs_stop_before_the_aggregate_rows(repo):
    jobs = repo.list_jobs()
    assert [j.company for j in jobs] == ["DELTA M Kazakhstan", "Daribar"]
    assert "Всего откликов" not in [j.company for j in jobs]


def test_habits_skip_the_impossible_dates(repo):
    dates = [e.date for e in repo.list_habits()]
    assert date(2026, 8, 31) in dates
    assert len(dates) == 3, "2026-08-32 and 2026-08-57 are not dates"


def test_checkin_writes_ones_and_zeroes(repo):
    row = repo.upsert_habits(HabitUpsert(
        date=date(2026, 8, 27), meditation=True, workout=False,
        work_done=True, mood=4,
    ))
    assert row == 5
    written = repo.sheets.grids["Привычки"][4]
    assert written[1] == "1"
    assert written[2] == "0"
    assert str(written[4]) == "4"


def test_cashflow_reads_the_parenthesised_income_headers(repo):
    week = repo.list_cashflow()[0]
    assert week.income_nedelka == 60000
    assert week.mandatory == 40000
    assert week.remainder == 5000
