"""Reading, writing and aggregating against a fake spreadsheet."""

from datetime import date, timedelta

import pytest
from fastapi import HTTPException

from app.models import (
    BodyCreate,
    DebtCreate,
    DebtUpdate,
    HabitUpsert,
    IncomeCreate,
    IncomeSource,
    JobCreate,
    JobStatus,
    JobUpdate,
)
from app.services.tables import locate_table
from app.services.repository import CASHFLOW_HEADERS, DEBT_HEADERS


# ---------------------------------------------------------------------- read


def test_list_debts(repo):
    debts = repo.list_debts()
    assert [d.name for d in debts] == ["Kaspi Red", "Рассрочка"]
    assert debts[0].remaining == 180000
    assert debts[1].rate == 12.0


def test_list_cashflow_marks_no_week_current_for_past_data(repo):
    weeks = repo.list_cashflow()
    assert len(weeks) == 2
    assert weeks[0].income_nedelka == 150000
    assert not any(week.is_current for week in weeks)


def test_list_jobs_parses_statuses(repo):
    jobs = {job.company: job.status for job in repo.list_jobs()}
    assert jobs["Kaspi"] is JobStatus.APPLIED
    assert jobs["Halyk"] is JobStatus.INTERVIEW
    assert jobs["Chocofamily"] is JobStatus.OFFER
    assert jobs["Freedom"] is JobStatus.REJECTED


# --------------------------------------------------------------------- write


def test_create_debt_lands_inside_the_debt_block(repo, fake):
    row = repo.create_debt(DebtCreate(name="Новый", total=50000, min_payment=5000))
    assert row == 6

    # The cashflow block must have shifted down intact, not been overwritten.
    cashflow = locate_table(fake.grids["Финансы"], CASHFLOW_HEADERS, title="Финансы")
    assert cashflow.header_row == 9
    assert [r for r, _ in cashflow.rows] == [10, 11]

    debts = repo.list_debts()
    assert [d.name for d in debts] == ["Kaspi Red", "Рассрочка", "Новый"]
    # Остаток defaults to the full amount when not given.
    assert debts[-1].remaining == 50000


def test_update_debt_touches_only_the_named_column(repo, fake):
    repo.update_debt(4, DebtUpdate(remaining=120000))
    debt = next(d for d in repo.list_debts() if d.id == 4)
    assert debt.remaining == 120000
    assert debt.total == 300000          # untouched
    assert debt.min_payment == 25000     # untouched


def test_update_rejects_an_id_outside_the_block(repo):
    # Row 9 is a cashflow row, not a debt — it must not be writable as one.
    with pytest.raises(HTTPException) as exc:
        repo.update_debt(9, DebtUpdate(remaining=1))
    assert exc.value.status_code == 404


def test_delete_debt_removes_the_row(repo):
    repo.delete_debt(5)
    assert [d.name for d in repo.list_debts()] == ["Kaspi Red"]


# ------------------------------------------------------------------- income


def test_income_folds_into_the_matching_week(repo):
    repo.add_income(
        IncomeCreate(amount=30000, source=IncomeSource.NEDELKA, date=date(2025, 9, 3))
    )
    week = next(w for w in repo.list_cashflow() if w.period.startswith("01.09"))
    assert week.income_nedelka == 180000


def test_income_for_a_new_week_appends_a_row(repo, fake):
    repo.add_income(
        IncomeCreate(amount=25000, source=IncomeSource.OTHER, date=date(2025, 9, 17))
    )
    weeks = repo.list_cashflow()
    assert len(weeks) == 3
    added = weeks[-1]
    assert added.period == "2025-09-15 – 2025-09-21"
    assert added.income_other == 25000
    assert added.income_nedelka == 0


def test_income_keeps_the_sheet_formula_live(repo, fake):
    repo.add_income(IncomeCreate(amount=1000, date=date(2025, 9, 3)))
    row = fake.grids["Финансы"][8]
    # Остаток stays a formula so the spreadsheet remains readable on its own.
    assert row[5].startswith("=")


# ------------------------------------------------------------------- habits


def test_habits_upsert_edits_the_existing_day(repo, fake):
    before = len(fake.grids["Привычки"])
    row = repo.upsert_habits(HabitUpsert(date=date(2025, 9, 7), workout=True, mood=5))

    assert row == 3
    assert len(fake.grids["Привычки"]) == before  # no duplicate row
    entry = repo.get_habits_for(date(2025, 9, 7))
    assert entry.workout is True
    assert entry.mood == 5
    assert entry.meditation is True  # untouched by the partial update


def test_habits_upsert_creates_a_missing_day(repo, fake):
    row = repo.upsert_habits(
        HabitUpsert(
            date=date(2025, 9, 9),
            meditation=True,
            workout=False,
            work_done=True,
            mood=3,
        )
    )
    assert row == 5
    entry = repo.get_habits_for(date(2025, 9, 9))
    assert entry.complete
    assert entry.workout is False


def test_habits_false_is_stored_not_skipped(repo):
    """`False` must reach the sheet — only `None` means 'leave alone'."""
    repo.upsert_habits(HabitUpsert(date=date(2025, 9, 8), workout=False))
    assert repo.get_habits_for(date(2025, 9, 8)).workout is False


# ---------------------------------------------------------------- dashboard


def test_dashboard_totals(repo):
    dash = repo.dashboard()
    assert dash.debt_total == 220000
    assert dash.debt_initial == 420000


def test_dashboard_weight_delta(repo):
    weight = repo.dashboard().weight
    assert weight.current == 83.2
    assert weight.delta == pytest.approx(-1.3)
    assert weight.recorded_on == date(2025, 9, 8)


def test_dashboard_conversion(repo):
    funnel = repo.dashboard().funnel
    assert funnel.applications == 4
    assert funnel.offers == 1
    assert funnel.conversion == 25.0
    # An offer implies the interview stage was reached.
    assert funnel.interviews == 2


def test_streak_breaks_on_a_partially_filled_day(repo, fake):
    """A blank field breaks the streak; answering 'Нет' does not — it is filled."""
    today = date.today()
    fake.grids["Привычки"] = [
        ["Дата", "медитация", "Тренировка", "Работа сделана", "Настроение"],
        [(today - timedelta(days=2)).strftime("%d.%m.%Y"), "Да", "Да", "Да", "4"],
        [(today - timedelta(days=1)).strftime("%d.%m.%Y"), "Да", "Да", "", "3"],
        [today.strftime("%d.%m.%Y"), "Да", "Нет", "Да", "5"],
    ]
    assert repo.dashboard().streak == 1


def test_streak_survives_an_unfilled_today(repo, fake):
    """Before the evening check-in the streak reads through yesterday."""
    today = date.today()
    fake.grids["Привычки"] = [
        ["Дата", "медитация", "Тренировка", "Работа сделана", "Настроение"],
        [(today - timedelta(days=2)).strftime("%d.%m.%Y"), "Да", "Да", "Да", "4"],
        [(today - timedelta(days=1)).strftime("%d.%m.%Y"), "Да", "Да", "Да", "3"],
        [today.strftime("%d.%m.%Y"), "Да", "", "", ""],
    ]
    assert repo.dashboard().streak == 2


def test_dashboard_current_week_falls_back_to_an_empty_summary(repo):
    week = repo.dashboard().week
    assert week.income == 0
    assert week.period is not None


# ---------------------------------------------------------------- history


def test_history_merges_every_tab(repo):
    kinds = {item.kind for item in repo.history()}
    assert kinds == {"Кэшфлоу", "Долг", "Вес", "Отклик", "Чек-ин"}


def test_history_filter(repo):
    items = repo.history(kind="body")
    assert items and all(item.type == "body" for item in items)


def test_history_is_newest_first(repo):
    dates = [item.date for item in repo.history() if item.date]
    assert dates == sorted(dates, reverse=True)


# -------------------------------------------------------------------- jobs


def test_job_status_change_edits_in_place(repo, fake):
    before = len(fake.grids["Работа"])
    repo.update_job(2, JobUpdate(status=JobStatus.OFFER))
    assert len(fake.grids["Работа"]) == before
    job = next(j for j in repo.list_jobs() if j.id == 2)
    assert job.status is JobStatus.OFFER
    assert job.company == "Kaspi"


def test_create_job_defaults_to_today(repo):
    row = repo.create_job(JobCreate(company="Jusan", role="Analyst"))
    job = next(j for j in repo.list_jobs() if j.id == row)
    assert job.applied_on == date.today()
    assert job.status is JobStatus.APPLIED


# -------------------------------------------------------------------- body


def test_create_body_entry(repo):
    row = repo.create_body(BodyCreate(weight=82.4, note="после отпуска"))
    entry = next(e for e in repo.list_body() if e.id == row)
    assert entry.weight == 82.4
    assert entry.note == "после отпуска"
    assert entry.date == date.today()


# ------------------------------------------------------------- empty sheet


def test_bootstraps_headers_into_an_empty_spreadsheet(repo, fake):
    for tab in fake.grids:
        fake.grids[tab] = []

    snap = repo.snapshot(refresh=True)
    assert snap.debts.header_row == 1
    assert snap.cashflow.header_row == 3
    assert snap.habits.header_row == 1

    # And it is immediately usable.
    repo.create_debt(DebtCreate(name="Первый", total=1000))
    assert [d.name for d in repo.list_debts()] == ["Первый"]
