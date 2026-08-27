"""Parsing and table location — the layer that must tolerate a human's sheet."""

from datetime import date

import pytest

from app.services.tables import (
    locate_table,
    parse_bool,
    parse_date,
    parse_number,
    parse_percent,
)
from app.services.repository import CASHFLOW_HEADERS, DEBT_HEADERS, parse_period


@pytest.mark.parametrize(
    "raw, expected",
    [
        ("150 000", 150000.0),
        ("150 000 ₸", 150000.0),
        ("1 234,50", 1234.5),
        ("1,234.50", 1234.5),
        ("-500", -500.0),
        ("(1 200)", -1200.0),
        ("84,5", 84.5),
        ("", None),
        ("—", None),
        ("н/д", None),
    ],
)
def test_parse_number(raw, expected):
    assert parse_number(raw) == expected


@pytest.mark.parametrize(
    "raw, expected",
    [("12%", 12.0), ("12", 12.0), ("0,12", 12.0), ("0%", 0.0)],
)
def test_parse_percent(raw, expected):
    assert parse_percent(raw) == expected


@pytest.mark.parametrize(
    "raw, expected",
    [
        ("01.09.2025", date(2025, 9, 1)),
        ("2025-09-01", date(2025, 9, 1)),
        ("01/09/2025", date(2025, 9, 1)),
        ("1.9.25", date(2025, 9, 1)),
    ],
)
def test_parse_date(raw, expected):
    assert parse_date(raw) == expected


def test_parse_date_without_year_uses_hint():
    assert parse_date("01.09", default_year=2024) == date(2024, 9, 1)


def test_parse_bool_accepts_the_forms_a_person_types():
    assert parse_bool("Да") is True
    assert parse_bool("TRUE") is True
    assert parse_bool("✓") is True
    assert parse_bool("Нет") is False
    assert parse_bool("0") is False
    assert parse_bool("") is None
    assert parse_bool("может быть") is None


def test_locate_table_skips_titles_and_blank_rows(grids):
    debts = locate_table(grids["Финансы"], DEBT_HEADERS, title="Финансы")
    assert debts is not None
    assert debts.header_row == 3
    assert [row for row, _ in debts.rows] == [4, 5]


def test_locate_table_finds_the_second_block_on_the_same_tab(grids):
    cashflow = locate_table(grids["Финансы"], CASHFLOW_HEADERS, title="Финансы")
    assert cashflow is not None
    assert cashflow.header_row == 8
    assert [row for row, _ in cashflow.rows] == [9, 10]


def test_debt_and_cashflow_blocks_do_not_capture_each_other(grids):
    """'Осталось' vs 'Остаток' and 'Долг' vs 'На долг' must not cross-match."""
    debts = locate_table(grids["Финансы"], DEBT_HEADERS, title="Финансы")
    cashflow = locate_table(grids["Финансы"], CASHFLOW_HEADERS, title="Финансы")
    assert debts.header_row < cashflow.header_row
    assert debts.rows[-1][0] < cashflow.header_row


def test_next_row_lands_at_the_end_of_its_own_block(grids):
    debts = locate_table(grids["Финансы"], DEBT_HEADERS, title="Финансы")
    # Right after the last debt, not after the cashflow table at the bottom.
    assert debts.next_row == 6


@pytest.mark.parametrize(
    "raw, expected",
    [
        ("01.09.2025 – 07.09.2025", (date(2025, 9, 1), date(2025, 9, 7))),
        ("01.09.2025-07.09.2025", (date(2025, 9, 1), date(2025, 9, 7))),
        ("03.09.2025", (date(2025, 9, 1), date(2025, 9, 7))),
        ("Неделя 3", None),
    ],
)
def test_parse_period(raw, expected):
    assert parse_period(raw) == expected
