"""In-memory stand-in for SheetsClient, with real row-shifting semantics.

Row insertion has to actually push later rows down — that is the behaviour the
two-blocks-on-one-tab layout depends on, so the fake models it rather than
just recording calls.
"""

from __future__ import annotations

from typing import Any


class FakeSheets:
    def __init__(self, grids: dict[str, list[list[str]]]) -> None:
        self.grids = {tab: [list(row) for row in rows] for tab, rows in grids.items()}
        self.tabs = list(self.grids)
        self.writes: list[tuple[str, Any]] = []

    # ------------------------------------------------------------------ read

    def read_all(self, *, refresh: bool = False) -> dict[str, list[list[str]]]:
        return {tab: [list(row) for row in rows] for tab, rows in self.grids.items()}

    def read_tab(self, title: str, *, refresh: bool = False) -> list[list[str]]:
        return self.read_all()[title]

    # ----------------------------------------------------------------- write

    def _ensure(self, title: str, row: int) -> list[str]:
        grid = self.grids.setdefault(title, [])
        while len(grid) < row:
            grid.append([])
        return grid[row - 1]

    def _set(self, title: str, row: int, col: int, value: Any) -> None:
        target = self._ensure(title, row)
        while len(target) < col:
            target.append("")
        target[col - 1] = "" if value is None else str(value)

    def update_row(self, title: str, row: int, values: list[Any], *, first_col: int = 1) -> None:
        self.writes.append(("update_row", (title, row, values)))
        for offset, value in enumerate(values):
            self._set(title, row, first_col + offset, value)

    def update_cell(self, title: str, row: int, col: int, value: Any) -> None:
        self.update_cells(title, [(row, col, value)])

    def update_cells(self, title: str, cells: list[tuple[int, int, Any]]) -> None:
        if not cells:
            return
        self.writes.append(("update_cells", (title, list(cells))))
        for row, col, value in cells:
            self._set(title, row, col, value)

    def insert_row(self, title: str, row: int, values: list[Any]) -> None:
        self.writes.append(("insert_row", (title, row, values)))
        grid = self.grids.setdefault(title, [])
        while len(grid) < row - 1:
            grid.append([])
        grid.insert(row - 1, ["" if v is None else str(v) for v in values])

    def delete_row(self, title: str, row: int) -> None:
        self.writes.append(("delete_row", (title, row)))
        grid = self.grids.get(title, [])
        if 0 < row <= len(grid):
            grid.pop(row - 1)

    def invalidate(self) -> None:
        pass
