"""End-to-end checks through the HTTP layer, including the auth guard."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.repository import Repository, get_repository

from .test_auth import make_init_data


@pytest.fixture
def client(fake):
    app.dependency_overrides[get_repository] = lambda: Repository(sheets=fake)
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def auth() -> dict:
    return {"X-Telegram-Init-Data": make_init_data(user_id=42)}


def test_health_needs_no_auth(client):
    payload = client.get("/health").json()
    assert payload["ok"] is True
    # Names the live bundle, so a cached Mini App shell can be spotted from
    # outside without reading a deploy log.
    assert "bundle" in payload


def test_the_shell_is_never_cached_but_hashed_assets_are(client):
    # A stale shell keeps pointing at a bundle the deploy already replaced,
    # which makes every version of a bug look identical from the outside.
    assert "no-cache" in client.get("/health").headers["cache-control"]

    api = client.get("/api/dashboard")
    assert "cache-control" not in api.headers


def test_api_rejects_an_unauthenticated_request(client):
    assert client.get("/api/dashboard").status_code == 403


def test_api_rejects_another_telegram_user(client):
    response = client.get(
        "/api/dashboard", headers={"X-Telegram-Init-Data": make_init_data(user_id=777)}
    )
    assert response.status_code == 403
    # The message has to carry the caller's own id: that number is what
    # ALLOWED_TELEGRAM_ID should have been set to, and without it a denied
    # screen says nothing about how to fix the configuration.
    assert "777" in response.json()["detail"]


def test_api_accepts_the_authorization_header_form(client):
    response = client.get(
        "/api/dashboard", headers={"Authorization": f"tma {make_init_data()}"}
    )
    assert response.status_code == 200


def test_dashboard_payload(client, auth):
    body = client.get("/api/dashboard", headers=auth).json()
    assert body["debt_total"] == 220000
    assert body["weight"]["current"] == 83.2
    assert body["funnel"]["conversion"] == 25.0
    assert len(body["recent"]) <= 10


def test_post_income_then_read_it_back(client, auth):
    created = client.post(
        "/api/finance/cashflow",
        json={"amount": 5000, "source": "Nedelka", "date": "2025-09-03"},
        headers=auth,
    )
    assert created.status_code == 201

    weeks = client.get("/api/finance/cashflow", headers=auth).json()
    week = next(w for w in weeks if w["period"].startswith("01.09"))
    assert week["income_nedelka"] == 155000


def test_post_body_validates_the_weight_range(client, auth):
    assert client.post("/api/body", json={"weight": 5}, headers=auth).status_code == 422
    assert client.post("/api/body", json={"weight": 250}, headers=auth).status_code == 422
    assert client.post("/api/body", json={"weight": 82.5}, headers=auth).status_code == 201


def test_habits_today_and_upsert(client, auth):
    today = client.get("/api/habits/today", headers=auth).json()
    assert today["id"] is None  # nothing recorded for today in the fixture

    client.post(
        "/api/habits",
        json={"meditation": True, "workout": False, "work_done": True, "mood": 4},
        headers=auth,
    )
    updated = client.get("/api/habits/today", headers=auth).json()
    assert updated["mood"] == 4
    assert updated["workout"] is False


def test_job_status_patch(client, auth):
    assert client.patch(
        "/api/jobs/2", json={"status": "Оффер"}, headers=auth
    ).status_code == 200
    jobs = client.get("/api/jobs", headers=auth).json()
    assert next(j for j in jobs if j["id"] == 2)["status"] == "Оффер"


def test_job_status_rejects_an_unknown_value(client, auth):
    response = client.patch("/api/jobs/2", json={"status": "Может быть"}, headers=auth)
    assert response.status_code == 422


def test_history_filter_and_limit(client, auth):
    items = client.get("/api/history?type=jobs&limit=2", headers=auth).json()
    assert len(items) == 2
    assert all(item["type"] == "jobs" for item in items)


def test_delete_returns_404_for_a_row_outside_the_block(client, auth):
    assert client.delete("/api/body/999", headers=auth).status_code == 404
