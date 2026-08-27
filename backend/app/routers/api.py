"""HTTP surface of the tracker.

Every route here sits behind `require_user`, so an unsigned or foreign request
never reaches the spreadsheet.
"""

from __future__ import annotations

from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, Query

from ..auth import TelegramUser, require_user
from ..models import (
    BodyCreate,
    BodyEntry,
    BodyUpdate,
    CashflowUpdate,
    CashflowWeek,
    Created,
    Dashboard,
    Debt,
    DebtCreate,
    DebtUpdate,
    HabitEntry,
    HabitUpsert,
    HistoryItem,
    IncomeCreate,
    JobApplication,
    JobCreate,
    JobUpdate,
    Ok,
)
from ..services.repository import Repository, get_repository

router = APIRouter(prefix="/api", dependencies=[Depends(require_user)])

HistoryType = Literal["finance", "body", "jobs", "habits"]


@router.get("/me")
def me(user: TelegramUser = Depends(require_user)) -> dict:
    return {"id": user.id, "first_name": user.first_name, "username": user.username}


@router.get("/dashboard", response_model=Dashboard)
def dashboard(repo: Repository = Depends(get_repository)) -> Dashboard:
    return repo.dashboard()


# ------------------------------------------------------------------- finance


@router.get("/finance/debts", response_model=list[Debt])
def list_debts(repo: Repository = Depends(get_repository)) -> list[Debt]:
    return repo.list_debts()


@router.post("/finance/debts", response_model=Created, status_code=201)
def create_debt(payload: DebtCreate, repo: Repository = Depends(get_repository)) -> Created:
    return Created(id=repo.create_debt(payload))


@router.patch("/finance/debts/{debt_id}", response_model=Ok)
def update_debt(
    debt_id: int, payload: DebtUpdate, repo: Repository = Depends(get_repository)
) -> Ok:
    repo.update_debt(debt_id, payload)
    return Ok()


@router.delete("/finance/debts/{debt_id}", response_model=Ok)
def delete_debt(debt_id: int, repo: Repository = Depends(get_repository)) -> Ok:
    repo.delete_debt(debt_id)
    return Ok()


@router.get("/finance/cashflow", response_model=list[CashflowWeek])
def list_cashflow(repo: Repository = Depends(get_repository)) -> list[CashflowWeek]:
    return repo.list_cashflow()


@router.post("/finance/cashflow", response_model=Created, status_code=201)
def add_income(payload: IncomeCreate, repo: Repository = Depends(get_repository)) -> Created:
    """Add income; it is folded into the cashflow week containing its date."""
    return Created(id=repo.add_income(payload))


@router.patch("/finance/cashflow/{week_id}", response_model=Ok)
def update_cashflow(
    week_id: int, payload: CashflowUpdate, repo: Repository = Depends(get_repository)
) -> Ok:
    repo.update_cashflow(week_id, payload)
    return Ok()


# ---------------------------------------------------------------------- body


@router.get("/body", response_model=list[BodyEntry])
def list_body(repo: Repository = Depends(get_repository)) -> list[BodyEntry]:
    return sorted(
        repo.list_body(), key=lambda e: (e.date or date.min, e.id), reverse=True
    )


@router.post("/body", response_model=Created, status_code=201)
def create_body(payload: BodyCreate, repo: Repository = Depends(get_repository)) -> Created:
    return Created(id=repo.create_body(payload))


@router.patch("/body/{entry_id}", response_model=Ok)
def update_body(
    entry_id: int, payload: BodyUpdate, repo: Repository = Depends(get_repository)
) -> Ok:
    repo.update_body(entry_id, payload)
    return Ok()


@router.delete("/body/{entry_id}", response_model=Ok)
def delete_body(entry_id: int, repo: Repository = Depends(get_repository)) -> Ok:
    repo.delete_body(entry_id)
    return Ok()


# ---------------------------------------------------------------------- jobs


@router.get("/jobs", response_model=list[JobApplication])
def list_jobs(repo: Repository = Depends(get_repository)) -> list[JobApplication]:
    return sorted(
        repo.list_jobs(), key=lambda j: (j.applied_on or date.min, j.id), reverse=True
    )


@router.post("/jobs", response_model=Created, status_code=201)
def create_job(payload: JobCreate, repo: Repository = Depends(get_repository)) -> Created:
    return Created(id=repo.create_job(payload))


@router.patch("/jobs/{job_id}", response_model=Ok)
def update_job(
    job_id: int, payload: JobUpdate, repo: Repository = Depends(get_repository)
) -> Ok:
    repo.update_job(job_id, payload)
    return Ok()


@router.delete("/jobs/{job_id}", response_model=Ok)
def delete_job(job_id: int, repo: Repository = Depends(get_repository)) -> Ok:
    repo.delete_job(job_id)
    return Ok()


# -------------------------------------------------------------------- habits


@router.get("/habits/today", response_model=HabitEntry)
def habits_today(repo: Repository = Depends(get_repository)) -> HabitEntry:
    return repo.get_habits_for(date.today())


@router.get("/habits", response_model=list[HabitEntry])
def list_habits(repo: Repository = Depends(get_repository)) -> list[HabitEntry]:
    return sorted(repo.list_habits(), key=lambda e: e.date, reverse=True)


@router.post("/habits", response_model=Created, status_code=201)
def upsert_habits(payload: HabitUpsert, repo: Repository = Depends(get_repository)) -> Created:
    """Upsert by date — re-opening today's check-in edits it, never duplicates."""
    return Created(id=repo.upsert_habits(payload))


@router.delete("/habits/{entry_id}", response_model=Ok)
def delete_habits(entry_id: int, repo: Repository = Depends(get_repository)) -> Ok:
    repo.delete_habits(entry_id)
    return Ok()


# ------------------------------------------------------------------- history


@router.get("/history", response_model=list[HistoryItem])
def history(
    type: HistoryType | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    repo: Repository = Depends(get_repository),
) -> list[HistoryItem]:
    return repo.history(kind=type)[:limit]
