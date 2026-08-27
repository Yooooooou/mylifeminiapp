"""Request and response schemas exchanged with the Mini App."""

from __future__ import annotations

from datetime import date
from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# Several models expose a field literally named `date`, which shadows the type
# inside the class body; annotations use this alias instead.
Date = date


class IncomeSource(str, Enum):
    NEDELKA = "Nedelka"
    OTHER = "Прочее"


class JobStatus(str, Enum):
    APPLIED = "Отклик"
    INTERVIEW = "Собес"
    OFFER = "Оффер"
    REJECTED = "Отказ"


# --------------------------------------------------------------------- debts


class Debt(BaseModel):
    id: int = Field(description="Spreadsheet row number backing this record")
    name: str
    total: float | None = None
    rate: float | None = None
    min_payment: float | None = None
    remaining: float | None = None

    @property
    def paid_ratio(self) -> float | None:
        if not self.total or self.remaining is None:
            return None
        return max(0.0, min(1.0, 1 - self.remaining / self.total))


class DebtCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    total: float = Field(ge=0)
    rate: float | None = Field(default=None, ge=0, le=1000)
    min_payment: float | None = Field(default=None, ge=0)
    remaining: float | None = Field(default=None, ge=0)


class DebtUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    total: float | None = Field(default=None, ge=0)
    rate: float | None = Field(default=None, ge=0, le=1000)
    min_payment: float | None = Field(default=None, ge=0)
    remaining: float | None = Field(default=None, ge=0)


# ------------------------------------------------------------------ cashflow


class CashflowWeek(BaseModel):
    id: int
    period: str
    period_start: Date | None = None
    period_end: Date | None = None
    income_nedelka: float = 0.0
    income_other: float = 0.0
    mandatory: float = 0.0
    to_debt: float = 0.0
    remainder: float = 0.0
    is_current: bool = False


class IncomeCreate(BaseModel):
    """One income entry, folded into the cashflow week containing `date`."""

    amount: float = Field(gt=0, le=1_000_000_000)
    source: IncomeSource = IncomeSource.NEDELKA
    date: Date | None = None


class CashflowUpdate(BaseModel):
    income_nedelka: float | None = Field(default=None, ge=0)
    income_other: float | None = Field(default=None, ge=0)
    mandatory: float | None = Field(default=None, ge=0)
    to_debt: float | None = Field(default=None, ge=0)


# ---------------------------------------------------------------------- body


class BodyEntry(BaseModel):
    id: int
    date: Date | None = None
    weight: float | None = None
    workouts: str | None = None
    note: str | None = None


class BodyCreate(BaseModel):
    weight: float = Field(ge=40, le=200, description="Kilograms")
    note: str | None = Field(default=None, max_length=300)
    workouts: str | None = Field(default=None, max_length=60)
    date: Date | None = None


class BodyUpdate(BaseModel):
    weight: float | None = Field(default=None, ge=40, le=200)
    note: str | None = Field(default=None, max_length=300)
    workouts: str | None = Field(default=None, max_length=60)
    date: Date | None = None


# ---------------------------------------------------------------------- jobs


class JobApplication(BaseModel):
    id: int
    company: str
    role: str | None = None
    applied_on: Date | None = None
    status: JobStatus | None = None
    note: str | None = None


class JobCreate(BaseModel):
    company: str = Field(min_length=1, max_length=120)
    role: str | None = Field(default=None, max_length=120)
    status: JobStatus = JobStatus.APPLIED
    note: str | None = Field(default=None, max_length=300)
    applied_on: Date | None = None


class JobUpdate(BaseModel):
    company: str | None = Field(default=None, min_length=1, max_length=120)
    role: str | None = Field(default=None, max_length=120)
    status: JobStatus | None = None
    note: str | None = Field(default=None, max_length=300)
    applied_on: Date | None = None


# -------------------------------------------------------------------- habits


class HabitEntry(BaseModel):
    id: int | None = None
    date: Date
    spending_ok: bool | None = None
    workout: bool | None = None
    work_done: bool | None = None
    mood: int | None = Field(default=None, ge=1, le=5)

    @property
    def complete(self) -> bool:
        return (
            self.spending_ok is not None
            and self.workout is not None
            and self.work_done is not None
            and self.mood is not None
        )


class HabitUpsert(BaseModel):
    date: Date | None = None
    spending_ok: bool | None = None
    workout: bool | None = None
    work_done: bool | None = None
    mood: int | None = Field(default=None, ge=1, le=5)


# ----------------------------------------------------------------- dashboard


class HistoryItem(BaseModel):
    """One row from any data tab, flattened for the activity feed."""

    model_config = ConfigDict(populate_by_name=True)

    id: int
    type: Literal["finance", "body", "jobs", "habits"]
    kind: str = Field(description="Human label, e.g. 'Вес' or 'Отклик'")
    date: Date | None = None
    title: str
    value: str | None = None
    editable: bool = True


class WeightSummary(BaseModel):
    current: float | None = None
    delta: float | None = None
    recorded_on: Date | None = None


class FunnelSummary(BaseModel):
    applications: int = 0
    interviews: int = 0
    offers: int = 0
    rejections: int = 0
    conversion: float | None = Field(
        default=None, description="Offers / applications, percent"
    )


class WeekSummary(BaseModel):
    period: str | None = None
    income: float = 0.0
    mandatory: float = 0.0
    to_debt: float = 0.0
    remainder: float = 0.0


class Dashboard(BaseModel):
    debt_total: float = 0.0
    debt_initial: float = 0.0
    weight: WeightSummary = Field(default_factory=WeightSummary)
    funnel: FunnelSummary = Field(default_factory=FunnelSummary)
    streak: int = 0
    week: WeekSummary = Field(default_factory=WeekSummary)
    habits_today: HabitEntry | None = None
    recent: list[HistoryItem] = Field(default_factory=list)


class Ok(BaseModel):
    ok: bool = True


class Created(BaseModel):
    ok: bool = True
    id: int
