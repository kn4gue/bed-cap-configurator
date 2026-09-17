"""
Unit & Integration Tests for Bed Cap Configurator Admin API & Pricing Engine
Validates dynamic pricing math (Cost, Markup %, Margin %, MSRP),
model CRUD operations, history persistence, and version snapshot restoration.
"""
import copy
import pytest
from fastapi.testclient import TestClient

from bed_cap_configurator.app import app
from bed_cap_configurator.catalog_manager import (
    calc_margin_from_markup,
    calc_markup_from_margin,
    calc_retail_from_markup,
    calc_retail_from_margin,
    load_catalog,
    load_history,
)


@pytest.fixture
def client():
    return TestClient(app)


def test_pricing_math_formulas():
    # 40% markup -> 28.57% margin
    markup = 40.0
    margin = calc_margin_from_markup(markup)
    assert abs(margin - 28.57) < 0.05

    # Reverse 28.57% margin -> 40% markup
    computed_markup = calc_markup_from_margin(margin)
    assert abs(computed_markup - 40.0) < 0.1

    # Retail calculation: $2000 cost @ 40% markup = $2800
    cost = 2000.0
    retail = calc_retail_from_markup(cost, markup)
    assert retail == 2800.0

    # Retail from margin: $2000 cost @ 28.5714% margin = $2800
    retail_from_margin = calc_retail_from_margin(cost, 28.57142857)
    assert abs(retail_from_margin - 2800.0) < 0.5


def test_get_admin_catalog(client):
    response = client.get("/api/configurator/admin/catalog")
    assert response.status_code == 200
    data = response.json()
    assert "models" in data
    assert "metadata" in data
    assert len(data["models"]) >= 10
    assert data["metadata"]["company_name"] == "Truck Guy Upfitters"
    assert data["metadata"]["default_brand"] == "Venturous"


def test_create_and_update_model(client):
    new_model = {
        "id": "test_alpine_overland",
        "name": "Venturous Alpine Overland",
        "brand": "Venturous",
        "style": "cab_high",
        "category": "fiberglass",
        "cost": 2500.0,
        "markup_pct": 40.0,
        "base_retail_price": 3500.0,
        "manual_price_override": False,
        "is_active": True,
        "tagline": "Extreme Overland Cap",
        "description": "Reinforced roof with dual windoors.",
        "warranty": "Lifetime Warranty",
        "standard_features": ["Reinforced Roof", "Dual Windoors"],
        "compatible_options": ["rack_rhino_vortex_aero"]
    }

    # Add Model
    post_res = client.post("/api/configurator/admin/models", json=new_model)
    assert post_res.status_code == 200
    data = post_res.json()
    assert data["success"] is True
    assert data["model"]["id"] == "test_alpine_overland"
    assert data["model"]["base_retail_price"] == 3500.0
    assert data["model"]["cost"] == 2500.0

    # Verify model history exists
    hist_res = client.get("/api/configurator/admin/models/test_alpine_overland/history")
    assert hist_res.status_code == 200
    hist_data = hist_res.json()
    assert len(hist_data) >= 1
    assert hist_data[0]["cost"] == 2500.0

    # Clean up / Delete model
    del_res = client.delete("/api/configurator/admin/models/test_alpine_overland?permanent=true")
    assert del_res.status_code == 200
    del_data = del_res.json()
    assert del_data["success"] is True


def test_history_audit_log_and_restore(client):
    # 1. Fetch current history
    h_res = client.get("/api/configurator/admin/history")
    assert h_res.status_code == 200
    history = h_res.json()
    assert len(history) >= 1

    first_version = history[0]["version_id"]

    # 2. Test restore endpoint
    restore_res = client.post("/api/configurator/admin/history/restore", json={
        "version_id": first_version,
        "author": "Test Suite"
    })
    assert restore_res.status_code == 200
    r_data = restore_res.json()
    assert r_data["success"] is True


def test_update_admin_settings(client):
    settings_payload = {
        "company_name": "Truck Guy Upfitters",
        "default_brand": "Venturous",
        "default_markup_pct": 42.0,
        "tax_rate": 0.06,
        "currency": "USD",
        "labor_rates": {
            "base_installation": 225.0,
            "keyless_wiring": 125.0,
            "rack_installation": 100.0
        }
    }

    res = client.post("/api/configurator/admin/settings", json=settings_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["settings"]["default_markup_pct"] == 42.0


def test_admin_portal_page_served(client):
    res = client.get("/admin")
    assert res.status_code == 200
    assert "Bed Cap Configurator" in res.text
    assert "Truck Guy Upfitters" in res.text
