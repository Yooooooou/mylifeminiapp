"""Locating tables inside a hand-made spreadsheet, and parsing their cells.

The spreadsheet is a human artefact: tabs contain titles, blank spacer rows and
— on Финансы — two stacked tables. Nothing here may be pinned to a fixed row
number, or adding a row would silently corrupt the next block. Instead every
table is found by matching its header row, and its body runs until the first
fully blank row.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta

# ---------------------------------------------------------------- normalising


def norm(value: str) -> str:
    """Normalise a header cell so 'Мин. платёж' matches 'мин платеж'."""
    lowered = (value or "").strip().lower().replace("ё", "е")
    return re.sub(r"[^a-zа-я0-9]+", " ", lowered).strip()


def cell(row: list[str], index: int) -> str:
    """Read a 0-indexed cell from a ragged row without an IndexError."""
    if 0 <= index < len(row):
        return (row[index] or "").strip()
    return ""


def is_blank(row: list[str]) -> bool:
    return all(not (value or "").strip() for value in row)


# ------------------------------------------------------------------- parsing

_NUMBER_JUNK = re.compile(r"[^\d,.\-]")


def parse_number(value: str) -> float | None:
    """Parse '150 000 ₸', '1 234,50', '-500', '12%' into a float."""
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None

    # Sheets renders negatives in accounting style as (1 234).
    negative = text.startswith("(") and text.endswith(")")
    cleaned = _NUMBER_JUNK.sub("", text)
    if not cleaned or cleaned in {"-", ",", "."}:
        return None

    # A comma is a decimal separator here; thousands separators are spaces or
    # non-breaking spaces, which the junk filter already removed.
    if "," in cleaned and "." in cleaned:
        cleaned = cleaned.replace(",", "")
    else:
        cleaned = cleaned.replace(",", ".")

    try:
        number = float(cleaned)
    except ValueError:
        return None
    return -number if negative else number


def parse_percent(value: str) -> float | None:
    number = parse_number(value)
    if number is None:
        return None
    # '12%' and '12' both mean twelve percent; 0.12 is stored by Sheets when the
    # cell is percent-formatted, so scale sub-1 values up.
    if "%" not in str(value) and 0 < number < 1:
        return number * 100
    return number


_DATE_FORMATS = (
    "%d.%m.%Y", "%d.%m.%y", "%Y-%m-%d", "%d/%m/%Y", "%d/%m/%y",
    "%d-%m-%Y", "%m/%d/%Y", "%d %m %Y",
)

_MONTHS = {
    "янв": 1, "фев": 2, "мар": 3, "апр": 4, "мая": 5, "май": 5, "июн": 6,
    "июл": 7, "авг": 8, "сен": 9, "окт": 10, "ноя": 11, "дек": 12,
}


def parse_date(value: str, *, default_year: int | None = None) -> date | None:
    """Parse the date formats a person actually types into a tracker."""
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None

    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue

    # Sheets sometimes hands back a serial number for date-formatted cells.
    serial = parse_number(text)
    if serial is not None and 20000 < serial < 80000:
        return date(1899, 12, 30) + timedelta(days=int(serial))

    # '12 марта' / '5 сен'
    match = re.match(r"(\d{1,2})\s+([а-яё]{3,})", text.lower())
    if match:
        day = int(match.group(1))
        stem = match.group(2)[:3]
        month = _MONTHS.get(stem)
        if month:
            year = default_year or date.today().year
            try:
                return date(year, month, day)
            except ValueError:
                return None

    # '12.03' without a year.
    match = re.fullmatch(r"(\d{1,2})[./-](\d{1,2})", text)
    if match:
        year = default_year or date.today().year
        try:
            return date(year, int(match.group(2)), int(match.group(1)))
        except ValueError:
            return None

    return None


def format_date(value: date) -> str:
    # ISO, matching the dates already sitting in the Тело and Привычки tabs.
    # A dd.mm.yyyy row among them would sort and compare differently in the
    # sheet's own formulas.
    return value.strftime("%Y-%m-%d")


_TRUE = {"да", "yes", "true", "1", "+", "v", "✓", "✔", "x", "истина", "готово"}
_FALSE = {"нет", "no", "false", "0", "-", "—", "ложь"}


def parse_bool(value: str) -> bool | None:
    # Deliberately not `norm()`: that strips punctuation for header matching,
    # which would erase a '✓' or '+' someone ticked a habit with.
    text = str(value or "").strip().lower().replace("ё", "е")
    if not text:
        return None
    if text in _TRUE:
        return True
    if text in _FALSE:
        return False
    return None


def format_bool(value: bool) -> str:
    # The habit columns are headed "(1/0)" and the sheet's own formulas sum
    # them, so a written "Да" would both look foreign and break those totals.
    return "1" if value else "0"


# ------------------------------------------------------------------- tables


@dataclass
class Table:
    """A located table: where its header sits and which columns it has."""

    title: str
    header_row: int                      # 1-indexed row of the header
    first_col: int                       # 1-indexed leftmost column
    columns: dict[str, int]              # normalised header -> 0-indexed offset
    rows: list[tuple[int, list[str]]] = field(default_factory=list)

    def column_index(self, *names: str) -> int | None:
        """Offset of the first matching column, or None when absent."""
        for name in names:
            key = norm(name)
            if key in self.columns:
                return self.columns[key]
            # Tolerate a header that merely starts with the expected word,
            # e.g. 'Доход Nedelka, ₸'.
            for header, index in self.columns.items():
                if header.startswith(key):
                    return index
        return None

    def value(self, row: list[str], *names: str) -> str:
        index = self.column_index(*names)
        if index is None:
            return ""
        return cell(row, index)

    @property
    def width(self) -> int:
        return max(self.columns.values(), default=0) + 1

    @property
    def next_row(self) -> int:
        """Row number a new record should be inserted at (end of this block)."""
        if self.rows:
            return self.rows[-1][0] + 1
        return self.header_row + 1


def locate_table(
    grid: list[list[str]],
    expected: list[str],
    *,
    title: str,
    start_row: int = 1,
    min_matches: int = 2,
) -> Table | None:
    """Find a table by its header row, scanning from `start_row` downwards.

    `expected` lists the headers we care about. A row qualifies as the header
    when at least `min_matches` of them appear in it — enough to distinguish the
    Долги block from the Кэшфлоу block without demanding an exact schema.
    """
    wanted = [norm(name) for name in expected]

    for offset, row in enumerate(grid, start=1):
        if offset < start_row or is_blank(row):
            continue

        present: dict[str, int] = {}
        for index, raw in enumerate(row):
            key = norm(raw)
            if key:
                present.setdefault(key, index)

        matches = sum(
            1
            for want in wanted
            if want in present or any(h.startswith(want) for h in present)
        )
        if matches < min_matches:
            continue

        table = Table(
            title=title,
            header_row=offset,
            first_col=min(present.values()) + 1 if present else 1,
            columns=present,
        )
        table.rows = _collect_rows(grid, offset)
        return table

    return None


def _collect_rows(grid: list[list[str]], header_row: int) -> list[tuple[int, list[str]]]:
    """Body rows below a header, stopping at the first blank separator row."""
    rows: list[tuple[int, list[str]]] = []
    for offset in range(header_row, len(grid)):
        row = grid[offset]
        if is_blank(row):
            break
        rows.append((offset + 1, row))
    return rows
