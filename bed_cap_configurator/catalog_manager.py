"""
Master Catalog & History Manager for Bed Cap Configurator
Handles dynamic pricing synchronization (Cost, Markup %, Margin %, MSRP Retail),
model lifecycle (Add, Edit, Remove, Archive), and permanent immutable version history.
"""
from __future__ import annotations

import copy
import datetime
import json
import os
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

DATA_DIR = Path(__file__).resolve().parent / "data"
CATALOG_PATH = Path(os.environ.get("CONFIGURATOR_MASTER_DATA", str(DATA_DIR / "master_catalog.json")))
HISTORY_PATH = Path(os.environ.get("CONFIGURATOR_HISTORY_DATA", str(DATA_DIR / "catalog_history.json")))

_CACHED_CATALOG: Optional[Dict[str, Any]] = None


# =====================================================================
# PRICING CALCULATION HELPERS
# =====================================================================

def calc_markup_from_margin(margin_pct: float) -> float:
    """Markup % = (Margin / (100 - Margin)) * 100"""
    if margin_pct >= 100.0:
        return 999.0
    return round((margin_pct / (100.0 - margin_pct)) * 100.0, 2)


def calc_margin_from_markup(markup_pct: float) -> float:
    """Margin % = (Markup / (100 + Markup)) * 100"""
    if markup_pct <= -100.0:
        return 0.0
    return round((markup_pct / (100.0 + markup_pct)) * 100.0, 2)


def calc_retail_from_markup(cost: float, markup_pct: float) -> float:
    """Retail = Cost * (1 + Markup / 100)"""
    return round(cost * (1.0 + (markup_pct / 100.0)), 2)


def calc_retail_from_margin(cost: float, margin_pct: float) -> float:
    """Retail = Cost / (1 - Margin / 100)"""
    if margin_pct >= 100.0:
        return round(cost * 2.0, 2)
    return round(cost / (1.0 - (margin_pct / 100.0)), 2)


def calc_cost_from_retail_and_markup(retail: float, markup_pct: float) -> float:
    """Cost = Retail / (1 + Markup / 100)"""
    if markup_pct <= -100.0:
        return retail
    return round(retail / (1.0 + (markup_pct / 100.0)), 2)


def recompute_model_pricing(model: Dict[str, Any], default_markup: float = 40.0) -> Dict[str, Any]:
    """
    Synchronizes Cost, Markup %, Margin %, and Base Retail Price for a model.
    Honors manual_price_override if set.
    """
    m = copy.deepcopy(model)
    cost = float(m.get("cost", 0.0))
    retail = float(m.get("base_retail_price", 0.0))
    markup = float(m.get("markup_pct", default_markup))
    override = bool(m.get("manual_price_override", False))

    if cost <= 0.0 and retail > 0.0:
        # Compute cost from retail assuming standard 40% markup
        cost = calc_cost_from_retail_and_markup(retail, markup)
        m["cost"] = cost

    if override and retail > 0.0 and cost > 0.0:
        # Fixed retail: recompute markup & margin
        m["markup_pct"] = round(((retail - cost) / cost) * 100.0, 2)
        m["margin_pct"] = round(((retail - cost) / retail) * 100.0, 2)
    elif cost > 0.0:
        # Standard auto-calculation
        m["markup_pct"] = markup
        m["margin_pct"] = calc_margin_from_markup(markup)
        m["base_retail_price"] = calc_retail_from_markup(cost, markup)

    m["profit_dollars"] = round(float(m.get("base_retail_price", 0.0)) - float(m.get("cost", 0.0)), 2)
    return m


# =====================================================================
# CATALOG PERSISTENCE & HISTORY
# =====================================================================

def load_catalog(force_reload: bool = False) -> Dict[str, Any]:
    global _CACHED_CATALOG
    if _CACHED_CATALOG is None or force_reload:
        if CATALOG_PATH.exists():
            with open(CATALOG_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
        else:
            data = _generate_default_catalog()

        # Ensure all models have standardized pricing keys
        default_markup = data.get("metadata", {}).get("default_markup_pct", 40.0)
        models = data.get("models", [])
        updated_models = []
        for m in models:
            m_synced = recompute_model_pricing(m, default_markup=default_markup)
            if "is_active" not in m_synced:
                m_synced["is_active"] = True
            updated_models.append(m_synced)
        data["models"] = updated_models
        _CACHED_CATALOG = data

    return _CACHED_CATALOG


def _generate_default_catalog() -> Dict[str, Any]:
    return {
        "metadata": {
            "name": "Bed Cap Configurator Master Rules & Options Catalog",
            "company_name": "Truck Guy Upfitters",
            "default_brand": "Venturous",
            "default_markup_pct": 40.0,
            "default_margin_pct": 28.57,
            "currency": "USD",
            "tax_rate": 0.06,
            "version": "1.0.0",
            "effective_date": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
        },
        "pricing_rules": {
            "currency": "USD",
            "price_type": "MSRP_retail",
            "default_markup_pct": 40.0,
            "labor_rates": {
                "base_installation": 200.0,
                "keyless_wiring": 120.0,
                "rack_installation": 95.0
            }
        },
        "models": [],
        "options_catalog": {}
    }


def load_history() -> List[Dict[str, Any]]:
    if HISTORY_PATH.exists():
        try:
            with open(HISTORY_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []
    return []


def save_catalog_with_history(
    catalog: Dict[str, Any],
    author: str = "Admin",
    change_summary: str = "Catalog updated"
) -> Tuple[Dict[str, Any], str]:
    """
    Saves catalog to disk and records an immutable historical snapshot in catalog_history.json.
    Returns (saved_catalog, version_id).
    """
    global _CACHED_CATALOG
    now = datetime.datetime.now(datetime.timezone.utc)
    version_id = f"v{now.strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:6]}"

    # Update metadata
    if "metadata" not in catalog:
        catalog["metadata"] = {}
    catalog["metadata"]["version"] = version_id
    catalog["metadata"]["last_updated"] = now.isoformat()
    catalog["metadata"]["last_author"] = author

    # Ensure all models are price synchronized
    default_markup = float(catalog.get("metadata", {}).get("default_markup_pct", 40.0))
    synced_models = []
    for m in catalog.get("models", []):
        synced_models.append(recompute_model_pricing(m, default_markup=default_markup))
    catalog["models"] = synced_models

    # Save master catalog
    CATALOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(CATALOG_PATH, "w", encoding="utf-8") as f:
        json.dump(catalog, f, indent=2)

    # Append to History
    history = load_history()
    snapshot = {
        "version_id": version_id,
        "timestamp": now.isoformat(),
        "author": author,
        "summary": change_summary,
        "models_count": len(catalog.get("models", [])),
        "active_models_count": len([m for m in catalog.get("models", []) if m.get("is_active", True)]),
        "company_name": catalog.get("metadata", {}).get("company_name", "Truck Guy Upfitters"),
        "default_brand": catalog.get("metadata", {}).get("default_brand", "Venturous"),
        "default_markup_pct": default_markup,
        "models_brief": [
            {
                "id": m["id"],
                "name": m.get("name"),
                "brand": m.get("brand"),
                "cost": m.get("cost"),
                "base_retail_price": m.get("base_retail_price"),
                "markup_pct": m.get("markup_pct"),
                "is_active": m.get("is_active", True)
            }
            for m in catalog.get("models", [])
        ],
        "catalog_snapshot": copy.deepcopy(catalog)
    }
    history.insert(0, snapshot)

    # Cap history at 100 snapshots
    if len(history) > 100:
        history = history[:100]

    with open(HISTORY_PATH, "w", encoding="utf-8") as f:
        json.dump(history, f, indent=2)

    _CACHED_CATALOG = catalog
    return catalog, version_id


def restore_version(version_id: str, author: str = "Admin") -> Optional[Dict[str, Any]]:
    history = load_history()
    for entry in history:
        if entry["version_id"] == version_id:
            restored_catalog = entry["catalog_snapshot"]
            save_catalog_with_history(
                restored_catalog,
                author=author,
                change_summary=f"Restored version {version_id} (originally created {entry.get('timestamp')})"
            )
            return restored_catalog
    return None


def get_model_history(model_id: str) -> List[Dict[str, Any]]:
    """Traces pricing and configuration history of a specific cover/model."""
    history = load_history()
    timeline = []
    for entry in history:
        for m in entry.get("models_brief", []):
            if m["id"] == model_id:
                timeline.append({
                    "version_id": entry["version_id"],
                    "timestamp": entry["timestamp"],
                    "author": entry.get("author", "Admin"),
                    "summary": entry.get("summary", ""),
                    "cost": m.get("cost"),
                    "retail": m.get("base_retail_price"),
                    "markup_pct": m.get("markup_pct"),
                    "is_active": m.get("is_active", True)
                })
                break
    return timeline
