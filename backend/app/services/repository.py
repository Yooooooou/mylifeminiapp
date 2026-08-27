"""Domain layer: turns spreadsheet grids into records and back.

Every read goes through `snapshot()`, which locates the tables inside each tab
by their headers. Row numbers double as record ids — acceptable for a private
single-user tracker, and validated against the located block before any write
so a stale id can never overwrite an unrelated row.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, timedelta

from fastapi import HTTPException, status
from gspread.utils import rowcol_to_a1

from ..config import get_settings
from ..models import (
    BodyCreate,
    BodyEntry,
    BodyUpdate,
    CashflowUpdate,
    CashflowWeek,
    Dashboard,
    Debt,
    DebtCreate,
    DebtUpdate,
    FunnelSummary,
    HabitEntry,
    HabitUpsert,
    HistoryItem,
    IncomeCreate,
    IncomeSource,
    JobApplication,
    JobCreate,
    JobStatus,
    JobUpdate,
    WeekSummary,
    WeightSummary,
)
from ..sheets import SheetsClient, get_sheets
from .tables import (
    Table,
    format_bool,
    format_date,
    locate_table,
    norm,
    parse_bool,
    parse_date,
    parse_number,
    parse_percent,
)

DEBT_HEADERS = ["Долг", "Сумма", "Ставка", "Мин. платёж", "Осталось"]
CASHFLOW_HEADERS = [
    "Период", "Доход Nedelka", "Доход прочее",
    "Обязательные траты", "На долг", "Остаток",
]
BODY_HEADERS = ["Дата", "Вес", "Тренировки", "Заметка"]
JOB_HEADERS = ["Компания", "Роль", "Дата отклика", "Статус", "Заметка"]
HABIT_HEADERS = [
    "Дата", "Траты под контролем", "Тренировка", "Работа сделана", "Настроение",
]


class LayoutError(HTTPException):
    """A tab exists but its header row could not be found."""

    def __init__(self, tab: str, block: str) -> None:
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                f"Не удалось найти таблицу «{block}» на листе «{tab}». "
                "Проверь, что строка заголовков на месте."
            ),
        )


def _not_found(what: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND, detail=f"{what} не найдена."
    )


# ------------------------------------------------------------------- periods


def week_bounds(day: date) -> tuple[date, date]:
    start = day - timedelta(days=day.weekday())
    return start, start + timedelta(days=6)


_RANGE_SPLIT = re.compile(r"\s*[–—\-]{1,2}\s*|\s+по\s+", re.IGNORECASE)


def parse_period(text: str, *, hint_year: int | None = None) -> tuple[date, date] | None:
    """Interpret a Период cell as a date range.

    Handles '01.09.2025 – 07.09.2025', '01.09-07.09' and a single date meaning
    'the week containing this date'. Labels like 'Неделя 3' carry no date and
    return None; those rows are matched by position instead.
    """
    raw = (text or "").strip()
    if not raw:
        return None

    parts = [part for part in _RANGE_SPLIT.split(raw) if part.strip()]
    if len(parts) >= 2:
        start = parse_date(parts[0], default_year=hint_year)
        end = parse_date(parts[1], default_year=hint_year)
        if start and end and end >= start:
            return start, end
        if start and not end:
            return week_bounds(start)

    single = parse_date(raw, default_year=hint_year)
    if single:
        return week_bounds(single)
    return None


def period_label(start: date, end: date) -> str:
    return f"{format_date(start)} – {format_date(end)}"


# ------------------------------------------------------------------ snapshot


@dataclass
class Snapshot:
    """All four tabs, parsed into located tables, for one request."""

    debts: Table
    cashflow: Table
    body: Table
    jobs: Table
    habits: Table


class Repository:
    def __init__(self, sheets: SheetsClient | None = None) -> None:
        self.sheets = sheets or get_sheets()
        self.settings = get_settings()

    # ------------------------------------------------------------- loading

    def snapshot(self, *, refresh: bool = False) -> Snapshot:
        grids = self.sheets.read_all(refresh=refresh)
        s = self.settings

        if self._bootstrap_if_empty(grids):
            grids = self.sheets.read_all(refresh=True)

        finance_grid = grids.get(s.sheet_finance, [])
        debts = locate_table(finance_grid, DEBT_HEADERS, title=s.sheet_finance)
        cashflow = locate_table(finance_grid, CASHFLOW_HEADERS, title=s.sheet_finance)
        body = locate_table(grids.get(s.sheet_body, []), BODY_HEADERS, title=s.sheet_body)
        jobs = locate_table(grids.get(s.sheet_jobs, []), JOB_HEADERS, title=s.sheet_jobs)
        habits = locate_table(
            grids.get(s.sheet_habits, []), HABIT_HEADERS, title=s.sheet_habits
        )

        if debts is None:
            raise LayoutError(s.sheet_finance, "Долги")
        if cashflow is None:
            raise LayoutError(s.sheet_finance, "Кэшфлоу")
        if body is None:
            raise LayoutError(s.sheet_body, "Тело")
        if jobs is None:
            raise LayoutError(s.sheet_jobs, "Работа")
        if habits is None:
            raise LayoutError(s.sheet_habits, "Привычки")

        return Snapshot(debts=debts, cashflow=cashflow, body=body, jobs=jobs, habits=habits)

    def _bootstrap_if_empty(self, grids: dict[str, list[list[str]]]) -> bool:
        """Write header rows into tabs that are completely empty.

        Only ever touches a tab with zero cells, so an existing tracker is never
        modified — this exists so the app also works against a fresh
        spreadsheet. Returns True when anything was written.
        """
        s = self.settings
        plans: list[tuple[str, list[tuple[int, list[str]]]]] = [
            # Финансы stacks two tables; row 2 stays blank as their separator.
            (s.sheet_finance, [(1, DEBT_HEADERS), (3, CASHFLOW_HEADERS)]),
            (s.sheet_body, [(1, BODY_HEADERS)]),
            (s.sheet_jobs, [(1, JOB_HEADERS)]),
            (s.sheet_habits, [(1, HABIT_HEADERS)]),
        ]
        wrote = False
        for tab, rows in plans:
            if grids.get(tab):
                continue
            for row_number, headers in rows:
                self.sheets.update_row(tab, row_number, headers)
            wrote = True
        return wrote

    # ---------------------------------------------------------------- debts

    def list_debts(self, snap: Snapshot | None = None) -> list[Debt]:
        snap = snap or self.snapshot()
        table = snap.debts
        result: list[Debt] = []
        for row_number, row in table.rows:
            name = table.value(row, "Долг")
            if not name:
                continue
            result.append(
                Debt(
                    id=row_number,
                    name=name,
                    total=parse_number(table.value(row, "Сумма")),
                    rate=parse_percent(table.value(row, "Ставка")),
                    min_payment=parse_number(table.value(row, "Мин. платёж", "Мин платеж")),
                    remaining=parse_number(table.value(row, "Осталось")),
                )
            )
        return result

    def create_debt(self, payload: DebtCreate) -> int:
        snap = self.snapshot()
        table = snap.debts
        remaining = payload.remaining if payload.remaining is not None else payload.total
        values = self._row_for(
            table,
            {
                "Долг": payload.name,
                "Сумма": payload.total,
                "Ставка": payload.rate,
                "Мин. платёж": payload.min_payment,
                "Осталось": remaining,
            },
        )
        row = table.next_row
        self.sheets.insert_row(table.title, row, values)
        return row

    def update_debt(self, debt_id: int, payload: DebtUpdate) -> None:
        snap = self.snapshot()
        table = snap.debts
        self._require_row(table, debt_id, "Запись о долге")
        self._write_fields(
            table,
            debt_id,
            {
                "Долг": payload.name,
                "Сумма": payload.total,
                "Ставка": payload.rate,
                "Мин. платёж": payload.min_payment,
                "Осталось": payload.remaining,
            },
        )

    def delete_debt(self, debt_id: int) -> None:
        snap = self.snapshot()
        self._require_row(snap.debts, debt_id, "Запись о долге")
        self.sheets.delete_row(snap.debts.title, debt_id)

    # ------------------------------------------------------------- cashflow

    def list_cashflow(self, snap: Snapshot | None = None) -> list[CashflowWeek]:
        snap = snap or self.snapshot()
        table = snap.cashflow
        today = date.today()
        weeks: list[CashflowWeek] = []

        for row_number, row in table.rows:
            label = table.value(row, "Период")
            if not label:
                continue
            bounds = parse_period(label)
            nedelka = parse_number(table.value(row, "Доход Nedelka")) or 0.0
            other = parse_number(table.value(row, "Доход прочее")) or 0.0
            mandatory = parse_number(table.value(row, "Обязательные траты")) or 0.0
            to_debt = parse_number(table.value(row, "На долг")) or 0.0
            stored = parse_number(table.value(row, "Остаток"))

            weeks.append(
                CashflowWeek(
                    id=row_number,
                    period=label,
                    period_start=bounds[0] if bounds else None,
                    period_end=bounds[1] if bounds else None,
                    income_nedelka=nedelka,
                    income_other=other,
                    mandatory=mandatory,
                    to_debt=to_debt,
                    # Recomputed in Python; the sheet's own formula is only a
                    # fallback for viewing the file directly.
                    remainder=nedelka + other - mandatory - to_debt
                    if stored is None
                    else stored,
                    is_current=bool(bounds and bounds[0] <= today <= bounds[1]),
                )
            )
        return weeks

    def add_income(self, payload: IncomeCreate) -> int:
        """Fold an income entry into the cashflow week containing its date."""
        when = payload.date or date.today()
        snap = self.snapshot()
        table = snap.cashflow

        column = (
            "Доход Nedelka"
            if payload.source is IncomeSource.NEDELKA
            else "Доход прочее"
        )

        target = self._find_week_row(table, when)
        if target is not None:
            row_number, row = target
            current = parse_number(table.value(row, column)) or 0.0
            index = table.column_index(column)
            if index is None:
                raise LayoutError(table.title, f"Кэшфлоу: колонка «{column}»")
            self.sheets.update_cell(table.title, row_number, index + 1, current + payload.amount)
            self._write_remainder_formula(table, row_number)
            return row_number

        start, end = week_bounds(when)
        values = self._row_for(
            table,
            {
                "Период": period_label(start, end),
                "Доход Nedelka": payload.amount if column == "Доход Nedelka" else 0,
                "Доход прочее": payload.amount if column == "Доход прочее" else 0,
                "Обязательные траты": 0,
                "На долг": 0,
            },
        )
        row = table.next_row
        self.sheets.insert_row(table.title, row, values)
        self._write_remainder_formula(table, row)
        return row

    def update_cashflow(self, week_id: int, payload: CashflowUpdate) -> None:
        snap = self.snapshot()
        table = snap.cashflow
        self._require_row(table, week_id, "Неделя")
        self._write_fields(
            table,
            week_id,
            {
                "Доход Nedelka": payload.income_nedelka,
                "Доход прочее": payload.income_other,
                "Обязательные траты": payload.mandatory,
                "На долг": payload.to_debt,
            },
        )
        self._write_remainder_formula(table, week_id)

    def _find_week_row(
        self, table: Table, when: date
    ) -> tuple[int, list[str]] | None:
        for row_number, row in table.rows:
            label = table.value(row, "Период")
            bounds = parse_period(label, hint_year=when.year)
            if bounds and bounds[0] <= when <= bounds[1]:
                return row_number, row
        return None

    def _write_remainder_formula(self, table: Table, row: int) -> None:
        """Keep the sheet's Остаток column self-maintaining.

        The Mini App computes its own numbers, but the spreadsheet stays
        readable on its own — so the cell gets a live formula, not a snapshot.
        """
        remainder = table.column_index("Остаток")
        nedelka = table.column_index("Доход Nedelka")
        other = table.column_index("Доход прочее")
        mandatory = table.column_index("Обязательные траты")
        to_debt = table.column_index("На долг")
        if None in (remainder, nedelka, other, mandatory, to_debt):
            return

        def ref(index: int) -> str:
            return rowcol_to_a1(row, index + 1)

        formula = (
            f"={ref(nedelka)}+{ref(other)}-{ref(mandatory)}-{ref(to_debt)}"
        )
        self.sheets.update_cell(table.title, row, remainder + 1, formula)

    # ----------------------------------------------------------------- body

    def list_body(self, snap: Snapshot | None = None) -> list[BodyEntry]:
        snap = snap or self.snapshot()
        table = snap.body
        entries: list[BodyEntry] = []
        for row_number, row in table.rows:
            when = parse_date(table.value(row, "Дата"))
            weight = parse_number(table.value(row, "Вес"))
            if when is None and weight is None:
                continue
            entries.append(
                BodyEntry(
                    id=row_number,
                    date=when,
                    weight=weight,
                    workouts=table.value(row, "Тренировки") or None,
                    note=table.value(row, "Заметка") or None,
                )
            )
        return entries

    def create_body(self, payload: BodyCreate) -> int:
        snap = self.snapshot()
        table = snap.body
        values = self._row_for(
            table,
            {
                "Дата": format_date(payload.date or date.today()),
                "Вес": payload.weight,
                "Тренировки": payload.workouts,
                "Заметка": payload.note,
            },
        )
        row = table.next_row
        self.sheets.insert_row(table.title, row, values)
        return row

    def update_body(self, entry_id: int, payload: BodyUpdate) -> None:
        snap = self.snapshot()
        table = snap.body
        self._require_row(table, entry_id, "Запись о весе")
        self._write_fields(
            table,
            entry_id,
            {
                "Дата": format_date(payload.date) if payload.date else None,
                "Вес": payload.weight,
                "Тренировки": payload.workouts,
                "Заметка": payload.note,
            },
        )

    def delete_body(self, entry_id: int) -> None:
        snap = self.snapshot()
        self._require_row(snap.body, entry_id, "Запись о весе")
        self.sheets.delete_row(snap.body.title, entry_id)

    # ----------------------------------------------------------------- jobs

    def list_jobs(self, snap: Snapshot | None = None) -> list[JobApplication]:
        snap = snap or self.snapshot()
        table = snap.jobs
        result: list[JobApplication] = []
        for row_number, row in table.rows:
            company = table.value(row, "Компания")
            if not company:
                continue
            result.append(
                JobApplication(
                    id=row_number,
                    company=company,
                    role=table.value(row, "Роль") or None,
                    applied_on=parse_date(table.value(row, "Дата отклика")),
                    status=_parse_status(table.value(row, "Статус")),
                    note=table.value(row, "Заметка") or None,
                )
            )
        return result

    def create_job(self, payload: JobCreate) -> int:
        snap = self.snapshot()
        table = snap.jobs
        values = self._row_for(
            table,
            {
                "Компания": payload.company,
                "Роль": payload.role,
                "Дата отклика": format_date(payload.applied_on or date.today()),
                "Статус": payload.status.value,
                "Заметка": payload.note,
            },
        )
        row = table.next_row
        self.sheets.insert_row(table.title, row, values)
        return row

    def update_job(self, job_id: int, payload: JobUpdate) -> None:
        snap = self.snapshot()
        table = snap.jobs
        self._require_row(table, job_id, "Отклик")
        self._write_fields(
            table,
            job_id,
            {
                "Компания": payload.company,
                "Роль": payload.role,
                "Дата отклика": format_date(payload.applied_on) if payload.applied_on else None,
                "Статус": payload.status.value if payload.status else None,
                "Заметка": payload.note,
            },
        )

    def delete_job(self, job_id: int) -> None:
        snap = self.snapshot()
        self._require_row(snap.jobs, job_id, "Отклик")
        self.sheets.delete_row(snap.jobs.title, job_id)

    # --------------------------------------------------------------- habits

    def list_habits(self, snap: Snapshot | None = None) -> list[HabitEntry]:
        snap = snap or self.snapshot()
        table = snap.habits
        entries: list[HabitEntry] = []
        for row_number, row in table.rows:
            when = parse_date(table.value(row, "Дата"))
            if when is None:
                continue
            mood = parse_number(table.value(row, "Настроение"))
            entries.append(
                HabitEntry(
                    id=row_number,
                    date=when,
                    spending_ok=parse_bool(table.value(row, "Траты под контролем")),
                    workout=parse_bool(table.value(row, "Тренировка")),
                    work_done=parse_bool(table.value(row, "Работа сделана")),
                    mood=int(mood) if mood is not None and 1 <= mood <= 5 else None,
                )
            )
        return entries

    def get_habits_for(self, when: date, snap: Snapshot | None = None) -> HabitEntry:
        for entry in self.list_habits(snap):
            if entry.date == when:
                return entry
        return HabitEntry(id=None, date=when)

    def upsert_habits(self, payload: HabitUpsert) -> int:
        """Create or edit today's check-in — never a second row for one date."""
        when = payload.date or date.today()
        snap = self.snapshot()
        table = snap.habits

        existing_row: int | None = None
        for row_number, row in table.rows:
            if parse_date(table.value(row, "Дата")) == when:
                existing_row = row_number
                break

        fields = {
            "Дата": format_date(when),
            "Траты под контролем": _bool_cell(payload.spending_ok),
            "Тренировка": _bool_cell(payload.workout),
            "Работа сделана": _bool_cell(payload.work_done),
            "Настроение": payload.mood,
        }

        if existing_row is None:
            row = table.next_row
            self.sheets.insert_row(table.title, row, self._row_for(table, fields))
            return row

        # An explicit null means "leave as is", so only provided fields are sent.
        self._write_fields(table, existing_row, fields)
        return existing_row

    def delete_habits(self, entry_id: int) -> None:
        snap = self.snapshot()
        self._require_row(snap.habits, entry_id, "Чек-ин")
        self.sheets.delete_row(snap.habits.title, entry_id)

    # -------------------------------------------------------------- history

    def history(self, snap: Snapshot | None = None, *, kind: str | None = None) -> list[HistoryItem]:
        """Merged feed across all four data tabs.

        Sheets stores no insertion timestamp, so ordering approximates it:
        newest event date first, ties broken by row position (rows are appended
        at the bottom of their block, so a higher row is the later entry).
        """
        snap = snap or self.snapshot()
        items: list[HistoryItem] = []

        if kind in (None, "finance"):
            for week in self.list_cashflow(snap):
                income = week.income_nedelka + week.income_other
                if income == 0 and week.mandatory == 0 and week.to_debt == 0:
                    continue
                items.append(
                    HistoryItem(
                        id=week.id,
                        type="finance",
                        kind="Кэшфлоу",
                        date=week.period_end or week.period_start,
                        title=week.period,
                        value=f"+{_money(income)} · остаток {_money(week.remainder)}",
                    )
                )
            for debt in self.list_debts(snap):
                items.append(
                    HistoryItem(
                        id=debt.id,
                        type="finance",
                        kind="Долг",
                        date=None,
                        title=debt.name,
                        value=f"осталось {_money(debt.remaining or 0)}",
                    )
                )

        if kind in (None, "body"):
            for entry in self.list_body(snap):
                items.append(
                    HistoryItem(
                        id=entry.id,
                        type="body",
                        kind="Вес",
                        date=entry.date,
                        title=f"{entry.weight:.1f} кг" if entry.weight else "—",
                        value=entry.note,
                    )
                )

        if kind in (None, "jobs"):
            for job in self.list_jobs(snap):
                items.append(
                    HistoryItem(
                        id=job.id,
                        type="jobs",
                        kind="Отклик",
                        date=job.applied_on,
                        title=job.company,
                        value=f"{job.role or '—'} · {job.status.value if job.status else '—'}",
                    )
                )

        if kind in (None, "habits"):
            for entry in self.list_habits(snap):
                marks = "".join(
                    "✅" if flag else "⬜"
                    for flag in (entry.spending_ok, entry.workout, entry.work_done)
                )
                items.append(
                    HistoryItem(
                        id=entry.id or 0,
                        type="habits",
                        kind="Чек-ин",
                        date=entry.date,
                        title=marks,
                        value=f"настроение {entry.mood}/5" if entry.mood else None,
                    )
                )

        items.sort(key=lambda item: (item.date or date.min, item.id), reverse=True)
        return items

    # ------------------------------------------------------------ dashboard

    def dashboard(self) -> Dashboard:
        snap = self.snapshot()
        debts = self.list_debts(snap)
        body = self.list_body(snap)
        jobs = self.list_jobs(snap)
        habits = self.list_habits(snap)
        weeks = self.list_cashflow(snap)
        today = date.today()

        weighed = sorted(
            (entry for entry in body if entry.weight is not None),
            key=lambda entry: (entry.date or date.min, entry.id),
        )
        weight = WeightSummary()
        if weighed:
            latest = weighed[-1]
            weight.current = latest.weight
            weight.recorded_on = latest.date
            if len(weighed) > 1 and weighed[-2].weight is not None:
                weight.delta = round(latest.weight - weighed[-2].weight, 2)

        current_week = next((week for week in weeks if week.is_current), None)
        if current_week is None:
            start, end = week_bounds(today)
            week_summary = WeekSummary(period=period_label(start, end))
        else:
            week_summary = WeekSummary(
                period=current_week.period,
                income=current_week.income_nedelka + current_week.income_other,
                mandatory=current_week.mandatory,
                to_debt=current_week.to_debt,
                remainder=current_week.remainder,
            )

        return Dashboard(
            debt_total=round(sum(d.remaining or 0 for d in debts), 2),
            debt_initial=round(sum(d.total or 0 for d in debts), 2),
            weight=weight,
            funnel=_funnel(jobs),
            streak=_streak(habits, today),
            week=week_summary,
            habits_today=self.get_habits_for(today, snap),
            recent=self.history(snap)[:10],
        )

    # -------------------------------------------------------------- helpers

    def _row_for(self, table: Table, fields: dict[str, object]) -> list[object]:
        """Build a full row for insertion, respecting the sheet's column order."""
        row: list[object] = [""] * table.width
        for name, value in fields.items():
            index = table.column_index(name)
            if index is None or value is None:
                continue
            row[index] = value
        return row

    def _write_fields(self, table: Table, row: int, fields: dict[str, object]) -> None:
        """Write only the provided fields, in one batched call.

        Sparse per-cell writes keep columns the Mini App doesn't manage
        untouched — a manual note or a formula elsewhere in the row survives
        an edit. A None value means "leave this cell alone".
        """
        cells: list[tuple[int, int, object]] = []
        for name, value in fields.items():
            if value is None:
                continue
            index = table.column_index(name)
            if index is None:
                continue
            cells.append((row, index + 1, value))
        self.sheets.update_cells(table.title, cells)

    def _require_row(self, table: Table, record_id: int, what: str) -> list[str]:
        """Resolve a record id to its row, refusing ids outside this block."""
        for row_number, row in table.rows:
            if row_number == record_id:
                return row
        raise _not_found(what)


def _bool_cell(value: bool | None) -> str | None:
    return None if value is None else format_bool(value)


def _parse_status(value: str) -> JobStatus | None:
    key = norm(value)
    if not key:
        return None
    aliases = {
        "отклик": JobStatus.APPLIED,
        "подал": JobStatus.APPLIED,
        "отправлено": JobStatus.APPLIED,
        "собес": JobStatus.INTERVIEW,
        "собеседование": JobStatus.INTERVIEW,
        "интервью": JobStatus.INTERVIEW,
        "оффер": JobStatus.OFFER,
        "offer": JobStatus.OFFER,
        "отказ": JobStatus.REJECTED,
        "реджект": JobStatus.REJECTED,
    }
    for alias, status_value in aliases.items():
        if key.startswith(alias):
            return status_value
    return None


def _funnel(jobs: list[JobApplication]) -> FunnelSummary:
    total = len(jobs)
    interviews = sum(1 for job in jobs if job.status is JobStatus.INTERVIEW)
    offers = sum(1 for job in jobs if job.status is JobStatus.OFFER)
    rejections = sum(1 for job in jobs if job.status is JobStatus.REJECTED)
    return FunnelSummary(
        applications=total,
        # An offer implies an interview happened, so count it in the stage above
        # too — otherwise moving a card to 'Оффер' makes the funnel shrink.
        interviews=interviews + offers,
        offers=offers,
        rejections=rejections,
        conversion=round(offers / total * 100, 1) if total else None,
    )


def _streak(habits: list[HabitEntry], today: date) -> int:
    """Consecutive days ending today with every check-in field filled.

    Today counts only once it is complete; before the evening check-in the
    streak is measured through yesterday rather than reset to zero.
    """
    complete = {entry.date for entry in habits if entry.complete}
    if not complete:
        return 0

    cursor = today if today in complete else today - timedelta(days=1)
    count = 0
    while cursor in complete:
        count += 1
        cursor -= timedelta(days=1)
    return count


def _money(value: float) -> str:
    return f"{value:,.0f} ₸".replace(",", " ")


def get_repository() -> Repository:
    return Repository()
