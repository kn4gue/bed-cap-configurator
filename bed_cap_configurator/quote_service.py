"""
Bed Cap Configurator Quote Submission & Local Lead Management Service
"""
from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    from .rules_engine import validate_and_price_configuration
    from .schemas import (
        ConfiguratorValidationRequest,
        EmployeeQuoteSubmissionRequest,
        QuoteSubmissionRequest,
        QuoteSubmissionResponse,
        QuoteUpdateRequest,
    )
except ImportError:
    from rules_engine import validate_and_price_configuration
    from schemas import (
        ConfiguratorValidationRequest,
        EmployeeQuoteSubmissionRequest,
        QuoteSubmissionRequest,
        QuoteSubmissionResponse,
        QuoteUpdateRequest,
    )

QUOTES_DIR = Path(os.environ.get("BED_CAP_QUOTES_DIR", "quotes"))


def save_quote_lead(req: QuoteSubmissionRequest) -> QuoteSubmissionResponse:
    QUOTES_DIR.mkdir(parents=True, exist_ok=True)

    val_req = ConfiguratorValidationRequest(
        vehicle=req.vehicle,
        model_id=req.model_id,
        options=req.options
    )
    pricing = validate_and_price_configuration(val_req)

    now = datetime.now(timezone.utc)
    short_id = uuid.uuid4().hex[:6].upper()
    quote_ref = f"TGU-LTA-{now.strftime('%Y%m')}-{short_id}"
    lead_id = f"LTA-LEAD-{now.strftime('%d%H%M')}-{short_id[:4]}"

    quote_record = {
        "quote_reference": quote_ref,
        "lead_unique_id": lead_id,
        "created_at": now.isoformat(),
        "status": "quoted",
        "customer": req.customer.model_dump(),
        "vehicle": req.vehicle.model_dump(),
        "raw_options": req.options.model_dump(),
        "build": {
            "model_id": pricing.model_id,
            "model_name": pricing.model_name,
            "base_price": pricing.base_price,
            "options": [o.model_dump() for o in pricing.selected_options],
            "options_total": pricing.options_total,
            "labor_total": pricing.labor_total,
            "subtotal": pricing.subtotal,
            "tax_rate": pricing.tax_rate,
            "tax_total": pricing.tax_total,
            "grand_total": pricing.grand_total,
            "alerts": [a.model_dump() for a in pricing.alerts]
        },
        "dealer_notes": req.dealer_notes
    }

    quote_file = QUOTES_DIR / f"{quote_ref}.json"
    with open(quote_file, "w", encoding="utf-8") as f:
        json.dump(quote_record, f, indent=2)

    return QuoteSubmissionResponse(
        success=True,
        quote_reference=quote_ref,
        lead_unique_id=lead_id,
        total_price=pricing.grand_total,
        status="quoted",
        message="Quote saved successfully."
    )


def save_employee_quote(req: EmployeeQuoteSubmissionRequest) -> QuoteSubmissionResponse:
    QUOTES_DIR.mkdir(parents=True, exist_ok=True)

    val_req = ConfiguratorValidationRequest(
        vehicle=req.vehicle,
        model_id=req.model_id,
        options=req.options
    )
    pricing = validate_and_price_configuration(val_req)

    now = datetime.now(timezone.utc)
    short_id = uuid.uuid4().hex[:6].upper()
    quote_ref = f"TGU-LTA-{now.strftime('%Y%m')}-{short_id}"
    lead_id = f"LTA-EMP-{now.strftime('%d%H%M')}-{short_id[:4]}"

    quote_record = {
        "quote_reference": quote_ref,
        "lead_unique_id": lead_id,
        "created_at": now.isoformat(),
        "status": req.status or "draft",
        "customer": req.customer.model_dump(),
        "vehicle": req.vehicle.model_dump(),
        "raw_options": req.options.model_dump(),
        "build": {
            "model_id": pricing.model_id,
            "model_name": pricing.model_name,
            "base_price": pricing.base_price,
            "options": [o.model_dump() for o in pricing.selected_options],
            "options_total": pricing.options_total,
            "labor_total": pricing.labor_total,
            "subtotal": pricing.subtotal,
            "tax_rate": pricing.tax_rate,
            "tax_total": pricing.tax_total,
            "grand_total": pricing.grand_total,
            "alerts": [a.model_dump() for a in pricing.alerts]
        },
        "internal_notes": req.internal_notes,
        "sales_rep": req.sales_rep,
        "lead_source": req.lead_source
    }

    quote_file = QUOTES_DIR / f"{quote_ref}.json"
    with open(quote_file, "w", encoding="utf-8") as f:
        json.dump(quote_record, f, indent=2)

    return QuoteSubmissionResponse(
        success=True,
        quote_reference=quote_ref,
        lead_unique_id=lead_id,
        total_price=pricing.grand_total,
        status=req.status or "draft",
        message="Employee quote saved successfully."
    )


def get_quote_by_ref(quote_ref: str) -> Optional[Dict[str, Any]]:
    quote_file = QUOTES_DIR / f"{quote_ref}.json"
    if not quote_file.exists():
        return None
    with open(quote_file, "r", encoding="utf-8") as f:
        return json.load(f)


def search_quotes(q: Optional[str] = None, status: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
    if not QUOTES_DIR.exists():
        return []

    results = []
    for p in QUOTES_DIR.glob("*.json"):
        try:
            with open(p, "r", encoding="utf-8") as f:
                data = json.load(f)

            if status and data.get("status") != status:
                continue

            if q:
                q_clean = q.lower()
                c = data.get("customer", {})
                v = data.get("vehicle", {})
                search_blob = f"{data.get('quote_reference','')} {c.get('full_name','')} {c.get('email','')} {c.get('phone','')} {v.get('vin','')} {v.get('make','')} {v.get('model','')}".lower()
                if q_clean not in search_blob:
                    continue

            results.append(data)
        except Exception:
            continue

    # Sort newest first
    results.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return results[:limit]


def update_quote(quote_ref: str, req: QuoteUpdateRequest) -> Optional[Dict[str, Any]]:
    quote_file = QUOTES_DIR / f"{quote_ref}.json"
    if not quote_file.exists():
        return None

    with open(quote_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    if req.status is not None:
        data["status"] = req.status
    if req.internal_notes is not None:
        data["internal_notes"] = req.internal_notes
    if req.sales_rep is not None:
        data["sales_rep"] = req.sales_rep

    data["updated_at"] = datetime.now(timezone.utc).isoformat()

    with open(quote_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    return data
