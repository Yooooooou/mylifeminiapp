"""Thin gspread wrapper: batched reads, guarded writes, retry with backoff.

Google Sheets is the source of truth. Everything the Mini App shows is derived
in Python from the raw cell values read here — no dependency on the formulas
living in the spreadsheet's own Dashboard tab.
"""

from __future__ import annotations

import logging
import random
import threading
import time
from typing import Any, Callable, TypeVar

import gspread
from google.oauth2.service_account import Credentials
from gspread.exceptions import APIError, SpreadsheetNotFound, WorksheetNotFound

from .config import get_settings

logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

# Google returns 429 for quota and 5xx for transient backend trouble; both are
# worth retrying. Anything else (403 on a missing share, 404 on a bad id) is a
# configuration problem and must surface immediately.
RETRYABLE_STATUS = {429, 500, 502, 503, 504}
MAX_ATTEMPTS = 5

T = TypeVar("T")


class SheetsUnavailable(Exception):
    """Sheets could not be reached after retrying — shown to the user as-is."""


class SheetsConfigError(Exception):
    """The spreadsheet or a tab is missing / not shared with the service account."""


def _status_of(error: APIError) -> int | None:
    response = getattr(error, "response", None)
    return getattr(response, "status_code", None)


def with_retry(operation: Callable[[], T], *, what: str) -> T:
    """Run a Sheets call, retrying transient failures with exponential backoff."""
    delay = 0.5
    last: Exception | None = None

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            return operation()
        except APIError as exc:
            status = _status_of(exc)
            if status not in RETRYABLE_STATUS:
                logger.error("Sheets %s failed permanently (status=%s)", what, status)
                raise SheetsConfigError(
                    "Google Sheets rejected the request. Check that the sheet is "
                    "shared with the service account and SPREADSHEET_ID is correct."
                ) from exc
            last = exc
            if attempt == MAX_ATTEMPTS:
                break
            # Jitter keeps repeated dashboard polls from retrying in lockstep.
            sleep_for = delay + random.uniform(0, delay / 2)
            logger.warning(
                "Sheets %s hit status %s, retry %s/%s in %.1fs",
                what, status, attempt, MAX_ATTEMPTS, sleep_for,
            )
            time.sleep(sleep_for)
            delay *= 2
        except (SpreadsheetNotFound, WorksheetNotFound) as exc:
            raise SheetsConfigError(str(exc)) from exc

    raise SheetsUnavailable(
        "Google Sheets is temporarily unavailable. Try again in a moment."
    ) from last


class _Cache:
    """Tiny TTL cache so one dashboard load doesn't re-read every tab twice."""

    def __init__(self, ttl: int) -> None:
        self._ttl = ttl
        self._lock = threading.Lock()
        self._value: dict[str, list[list[str]]] | None = None
        self._stored_at = 0.0

    def get(self) -> dict[str, list[list[str]]] | None:
        if self._ttl <= 0:
            return None
        with self._lock:
            if self._value is None or time.time() - self._stored_at > self._ttl:
                return None
            return self._value

    def set(self, value: dict[str, list[list[str]]]) -> None:
        with self._lock:
            self._value = value
            self._stored_at = time.time()

    def clear(self) -> None:
        with self._lock:
            self._value = None


class SheetsClient:
    """Authorized access to the one spreadsheet backing the tracker."""

    def __init__(self) -> None:
        settings = get_settings()
        self._settings = settings
        self._lock = threading.Lock()
        self._spreadsheet: gspread.Spreadsheet | None = None
        self._cache = _Cache(settings.cache_ttl)
        self.tabs = [
            settings.sheet_finance,
            settings.sheet_body,
            settings.sheet_jobs,
            settings.sheet_habits,
        ]

    # ---------------------------------------------------------------- client

    def _open(self) -> gspread.Spreadsheet:
        with self._lock:
            if self._spreadsheet is None:
                credentials = Credentials.from_service_account_info(
                    self._settings.google_credentials(), scopes=SCOPES
                )
                client = gspread.authorize(credentials)
                self._spreadsheet = with_retry(
                    lambda: client.open_by_key(self._settings.spreadsheet_id),
                    what="open spreadsheet",
                )
            return self._spreadsheet

    def _worksheet(self, title: str) -> gspread.Worksheet:
        spreadsheet = self._open()
        try:
            return with_retry(
                lambda: spreadsheet.worksheet(title), what=f"open tab {title!r}"
            )
        except SheetsConfigError as exc:
            raise SheetsConfigError(
                f"Tab {title!r} was not found in the spreadsheet."
            ) from exc

    # ----------------------------------------------------------------- reads

    def read_all(self, *, refresh: bool = False) -> dict[str, list[list[str]]]:
        """Read every data tab in one batched call.

        Returns raw, unpadded cell values keyed by tab name. Rows are ragged —
        Sheets omits trailing empty cells — so callers must index defensively.
        """
        if not refresh:
            cached = self._cache.get()
            if cached is not None:
                return cached

        spreadsheet = self._open()
        ranges = [f"'{tab}'" for tab in self.tabs]
        batch = with_retry(
            lambda: spreadsheet.values_batch_get(
                ranges, params={"majorDimension": "ROWS"}
            ),
            what="batch read",
        )

        result: dict[str, list[list[str]]] = {}
        for tab, value_range in zip(self.tabs, batch.get("valueRanges", [])):
            result[tab] = value_range.get("values", []) or []

        self._cache.set(result)
        return result

    def read_tab(self, title: str, *, refresh: bool = False) -> list[list[str]]:
        return self.read_all(refresh=refresh).get(title, [])

    # ---------------------------------------------------------------- writes

    def update_row(self, title: str, row: int, values: list[Any], *, first_col: int = 1) -> None:
        """Overwrite a contiguous span of cells on `row` (1-indexed)."""
        worksheet = self._worksheet(title)
        end_col = first_col + len(values) - 1
        a1 = gspread.utils.rowcol_to_a1(row, first_col)
        b1 = gspread.utils.rowcol_to_a1(row, end_col)
        with_retry(
            lambda: worksheet.update(
                values=[values], range_name=f"{a1}:{b1}", value_input_option="USER_ENTERED"
            ),
            what=f"update {title}!{a1}:{b1}",
        )
        self._cache.clear()

    def update_cell(self, title: str, row: int, col: int, value: Any) -> None:
        self.update_cells(title, [(row, col, value)])

    def update_cells(self, title: str, cells: list[tuple[int, int, Any]]) -> None:
        """Write scattered cells in a single API call.

        Editing a record touches only the columns the Mini App manages, so the
        writes are sparse; batching them keeps one save at one request instead
        of one per field.
        """
        if not cells:
            return
        worksheet = self._worksheet(title)
        payload = [
            {
                "range": gspread.utils.rowcol_to_a1(row, col),
                "values": [[value]],
            }
            for row, col, value in cells
        ]
        with_retry(
            lambda: worksheet.batch_update(payload, value_input_option="USER_ENTERED"),
            what=f"batch update {title} ({len(payload)} cells)",
        )
        self._cache.clear()

    def insert_row(self, title: str, row: int, values: list[Any]) -> None:
        """Insert a new row *at* `row`, pushing existing rows down.

        Used instead of a plain append because the Финансы tab stacks two
        tables: a debt row has to land inside its own block, not after the
        cashflow table at the bottom of the sheet.
        """
        worksheet = self._worksheet(title)
        with_retry(
            lambda: worksheet.insert_row(
                values, index=row, value_input_option="USER_ENTERED"
            ),
            what=f"insert row into {title} at {row}",
        )
        self._cache.clear()

    def delete_row(self, title: str, row: int) -> None:
        worksheet = self._worksheet(title)
        with_retry(lambda: worksheet.delete_rows(row), what=f"delete {title} row {row}")
        self._cache.clear()

    def invalidate(self) -> None:
        self._cache.clear()


_client: SheetsClient | None = None
_client_lock = threading.Lock()


def get_sheets() -> SheetsClient:
    global _client
    with _client_lock:
        if _client is None:
            _client = SheetsClient()
        return _client
