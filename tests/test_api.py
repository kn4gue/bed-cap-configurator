import pytest
from fastapi.testclient import TestClient
from bed_cap_configurator.app import create_app


@pytest.fixture
def client():
    app = create_app()
    with TestClient(app) as c:
        yield c


def test_api_health(client: TestClient):
    r = client.get("/api/configurator/health")
    assert r.status_code == 200
    assert r.json()["status"] == "healthy"


def test_api_makes_and_models(client: TestClient):
    r_makes = client.get("/api/configurator/makes")
    assert r_makes.status_code == 200
    makes = r_makes.json()
    assert "Ford" in makes
    assert "Chevrolet" in makes

    r_models = client.get("/api/configurator/models?make=Ford")
    assert r_models.status_code == 200
    models = r_models.json()
    assert "F-150" in models


def test_api_decode_vin_testing(client: TestClient):
    r = client.get("/api/configurator/decode-vin?vin=TESTING")
    assert r.status_code == 200
    data = r.json()
    assert data["valid"] is True
    assert data["make"] == "Ford"


def test_api_submit_quote(client: TestClient, tmp_path, monkeypatch):
    monkeypatch.setenv("BED_CAP_QUOTES_DIR", str(tmp_path / "quotes"))
    payload = {
        "customer": {
            "full_name": "Open Source Tester",
            "email": "test@example.com",
            "phone": "864-555-0199",
            "zip_code": "29678",
            "primary_use": "Camping & Work",
            "preferred_contact": "Email"
        },
        "vehicle": {
            "year": "2024",
            "make": "Ford",
            "model": "F-150",
            "bed_size": "5.5ft",
            "cab_style": "SuperCrew",
            "vin": "1FTFW1ED2NFB12345"
        },
        "model_id": "venturous_ozark",
        "options": {
            "side_windows_driver": "win_glass_windoor",
            "side_windows_passenger": "win_glass_windoor",
            "front_window": "front_drop_down_slider",
            "rear_door": "rear_frameless_slam_latch",
            "keyless_remote": True,
            "carpet_headliner": True
        }
    }
    r = client.post("/api/configurator/submit-quote", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert data["success"] is True
    assert "TGU-LTA-" in data["quote_reference"]
    assert data["total_price"] > 3500.0


def test_api_submit_quote_invalid_vin(client: TestClient):
    payload = {
        "customer": {
            "full_name": "Test User",
            "email": "test@example.com",
            "phone": "864-555-0199",
            "zip_code": "29678"
        },
        "vehicle": {
            "year": "2024",
            "make": "Ford",
            "model": "F-150",
            "bed_size": "5.5ft",
            "vin": "SHORT"
        },
        "model_id": "ranch_echo",
        "options": {}
    }
    r = client.post("/api/configurator/submit-quote", json=payload)
    assert r.status_code == 422
