"""
FastAPI Application & REST API for Bed Cap Configurator
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, APIRouter, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

try:
    from .quote_service import (
        get_quote_by_ref,
        save_employee_quote,
        save_quote_lead,
        search_quotes,
        update_quote,
    )
    from .rules_engine import (
        get_master_data,
        validate_and_price_configuration,
    )
    from .schemas import (
        ConfiguratorValidationRequest,
        ConfiguratorValidationResponse,
        EmployeeQuoteSubmissionRequest,
        QuoteSubmissionRequest,
        QuoteSubmissionResponse,
        QuoteUpdateRequest,
    )
    from .vin_validator import infer_vehicle_from_vin, validate_vin
except ImportError:
    from quote_service import (
        get_quote_by_ref,
        save_employee_quote,
        save_quote_lead,
        search_quotes,
        update_quote,
    )
    from rules_engine import (
        get_master_data,
        validate_and_price_configuration,
    )
    from schemas import (
        ConfiguratorValidationRequest,
        ConfiguratorValidationResponse,
        EmployeeQuoteSubmissionRequest,
        QuoteSubmissionRequest,
        QuoteSubmissionResponse,
        QuoteUpdateRequest,
    )
    from vin_validator import infer_vehicle_from_vin, validate_vin

router = APIRouter(prefix="/api/configurator", tags=["Configurator"])


@router.get("/health")
async def configurator_health():
    return {
        "status": "healthy",
        "service": "bed_cap_configurator",
        "version": "1.0.0"
    }


@router.get("/decode-vin")
async def decode_vin_endpoint(vin: str = Query(..., min_length=3, description="VIN to decode or 'TESTING'")):
    clean = vin.strip().upper()
    heuristic = infer_vehicle_from_vin(clean)

    if clean in ("TESTING", "OVERRIDE"):
        return heuristic

    # Optional NHTSA VPIC online lookup with timeout
    try:
        import httpx
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/{clean}?format=json")
            if resp.status_code == 200:
                data = resp.json()
                results = data.get("Results", [{}])[0]
                make = results.get("Make", "").strip()
                model = results.get("Model", "").strip()
                year = results.get("ModelYear", "").strip()

                if make:
                    if "Chevy" in make or "Chevrolet" in make: make = "Chevrolet"
                    elif "GMC" in make: make = "GMC"
                    elif "Ram" in make or "Dodge" in make: make = "Ram"
                    elif "Toyota" in make: make = "Toyota"
                    elif "Ford" in make: make = "Ford"
                    elif "Jeep" in make: make = "Jeep"

                if make and model:
                    return {
                        "valid": heuristic["valid"],
                        "make": make,
                        "model": model,
                        "year": year or heuristic["year"],
                        "source": "nhtsa_vpic"
                    }
    except Exception:
        pass

    return heuristic


@router.get("/makes", response_model=List[str])
async def get_supported_makes():
    """Returns list of supported truck manufacturers."""
    master = get_master_data()
    records = master.get("fitment_rules", [])
    makes = set()
    for r in records:
        for k in r.keys():
            if "/" in k or "make" in k or k in ["ford", "toyota", "dodge", "ram", "jeep", "nissan", "chevrolet/gmc"]:
                val = str(r[k])
                if "Chevy" in val or "Chevrolet" in val:
                    makes.add("Chevrolet")
                elif "GMC" in val:
                    makes.add("GMC")
                elif "Ford" in val:
                    makes.add("Ford")
                elif "Toyota" in val:
                    makes.add("Toyota")
                elif "Ram" in val or "Dodge" in val:
                    makes.add("Ram")
                elif "Jeep" in val:
                    makes.add("Jeep")
                elif "Nissan" in val:
                    makes.add("Nissan")
    if not makes:
        makes = {"Ford", "Chevrolet", "GMC", "Ram", "Toyota", "Jeep", "Nissan"}
    return sorted(list(makes))


@router.get("/models")
async def get_models_for_make(make: str = Query(..., description="Vehicle make")):
    """Returns supported truck models for a make."""
    models_map = {
        "Ford": ["F-150", "F-250 / F-350 Super Duty", "Ranger", "Maverick"],
        "Chevrolet": ["Silverado 1500", "Silverado 2500 / 3500 HD", "Colorado"],
        "GMC": ["Sierra 1500", "Sierra 2500 / 3500 HD", "Canyon"],
        "Ram": ["Ram 1500", "Ram 2500 / 3500 HD"],
        "Toyota": ["Tacoma", "Tundra"],
        "Jeep": ["Gladiator"],
        "Nissan": ["Frontier", "Titan"]
    }
    return models_map.get(make, ["Universal / Custom"])


@router.get("/bed-sizes")
async def get_bed_sizes(
    make: str = Query(...),
    model: str = Query(...),
):
    """Returns available bed sizes and cab styles for the chosen make and model."""
    if "F-150" in model:
        bed_options = [
            {"id": "5.5ft", "name": "5'6\" (5.5 ft) Short Bed - SuperCrew", "length_inches": 66},
            {"id": "6.5ft", "name": "6'6\" (6.5 ft) Standard Bed - SuperCab / SuperCrew", "length_inches": 78},
            {"id": "8.0ft", "name": "8'0\" (8.0 ft) Long Bed - Regular Cab", "length_inches": 96}
        ]
    elif "Super Duty" in model or "250" in model or "350" in model:
        bed_options = [
            {"id": "6.75ft", "name": "6'9\" (6.75 ft) Short Bed - Crew Cab / SuperCab", "length_inches": 81},
            {"id": "8.0ft", "name": "8'2\" (8.0 ft) Long Bed - Crew Cab / Regular Cab", "length_inches": 98}
        ]
    elif "Silverado 1500" in model or "Sierra 1500" in model:
        bed_options = [
            {"id": "5.8ft", "name": "5'8\" (70 in) Short Bed - Crew Cab", "length_inches": 70, "tailgate_support": ["Standard", "MultiFlex / MultiPro"]},
            {"id": "6.6ft", "name": "6'6\" (79.5 in) Standard Bed - Double Cab / Crew Cab", "length_inches": 79.5, "tailgate_support": ["Standard", "MultiFlex / MultiPro"]},
            {"id": "8.0ft", "name": "8'0\" (98 in) Long Bed - Regular Cab", "length_inches": 98}
        ]
    elif "Silverado 2500" in model or "Sierra 2500" in model:
        bed_options = [
            {"id": "6.9ft", "name": "6'9\" (82.2 in) Standard Bed - Crew Cab", "length_inches": 82.2},
            {"id": "8.0ft", "name": "8'0\" (98 in) Long Bed - Crew Cab / Regular Cab", "length_inches": 98}
        ]
    elif "Tacoma" in model:
        bed_options = [
            {"id": "5.0ft", "name": "5'0\" (60 in) Short Bed - Double Cab", "length_inches": 60},
            {"id": "6.0ft", "name": "6'0\" (73 in) Long Bed - Double Cab / Access Cab", "length_inches": 73}
        ]
    elif "Tundra" in model:
        bed_options = [
            {"id": "5.5ft", "name": "5'6\" (66 in) Short Bed - CrewMax", "length_inches": 66},
            {"id": "6.5ft", "name": "6'6\" (78 in) Standard Bed - Double Cab / CrewMax", "length_inches": 78},
            {"id": "8.1ft", "name": "8'1\" (97 in) Long Bed - Double Cab", "length_inches": 97}
        ]
    elif "Ram 1500" in model:
        bed_options = [
            {"id": "5.7ft", "name": "5'7\" (67 in) Short Bed - Crew Cab", "length_inches": 67},
            {"id": "6.4ft", "name": "6'4\" (76 in) Standard Bed - Quad Cab / Crew Cab", "length_inches": 76},
            {"id": "8.0ft", "name": "8'0\" (96 in) Long Bed - Regular Cab", "length_inches": 96}
        ]
    elif "Gladiator" in model:
        bed_options = [
            {"id": "5.0ft", "name": "5'0\" (60 in) Bed - 4-Door Crew Cab", "length_inches": 60}
        ]
    elif "Maverick" in model:
        bed_options = [
            {"id": "4.5ft", "name": "4'6\" (54 in) Bed - SuperCrew", "length_inches": 54}
        ]
    else:
        bed_options = [
            {"id": "short_bed", "name": "5.5 ft Short Bed", "length_inches": 66},
            {"id": "std_bed", "name": "6.5 ft Standard Bed", "length_inches": 78},
            {"id": "long_bed", "name": "8.0 ft Long Bed", "length_inches": 96}
        ]
    return bed_options


@router.get("/catalog")
async def get_configurator_catalog():
    """Returns the full master catalog of models, option hierarchies, and features."""
    master = get_master_data()
    return master


@router.post("/validate", response_model=ConfiguratorValidationResponse)
@router.post("/validate-configuration", response_model=ConfiguratorValidationResponse)
async def validate_configuration(payload: ConfiguratorValidationRequest):
    """Validates configuration state against prerequisites and returns computed price totalizer."""
    return validate_and_price_configuration(payload)


@router.post("/submit-quote", response_model=QuoteSubmissionResponse)
async def submit_quote_endpoint(req: QuoteSubmissionRequest):
    return save_quote_lead(req)


@router.get("/quotes")
async def get_quotes(
    q: Optional[str] = Query(None, description="Search term across name, phone, VIN, quote ref"),
    status: Optional[str] = Query(None, description="Filter by status: draft, quoted, approved, ordered"),
    limit: int = Query(50, ge=1, le=200)
):
    return search_quotes(q=q, status=status, limit=limit)


@router.get("/quotes/{quote_ref}")
async def get_single_quote(quote_ref: str):
    record = get_quote_by_ref(quote_ref)
    if not record:
        raise HTTPException(status_code=404, detail="Quote not found")
    return record


@router.post("/quotes/employee/submit", response_model=QuoteSubmissionResponse)
async def submit_employee_quote_endpoint(req: EmployeeQuoteSubmissionRequest):
    return save_employee_quote(req)


@router.patch("/quotes/{quote_ref}")
async def update_quote_endpoint(quote_ref: str, req: QuoteUpdateRequest):
    updated = update_quote(quote_ref, req)
    if not updated:
        raise HTTPException(status_code=404, detail="Quote not found")
    return updated


def create_app() -> FastAPI:
    app = FastAPI(
        title="Bed Cap Configurator & Pricing Engine",
        description="Standalone open-source rules engine, NHTSA VIN decoder, and retail pricing totalizer for truck bed caps.",
        version="1.0.0"
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(router)

    # Mount static files if present
    static_dir = Path(__file__).resolve().parent / "static"
    if static_dir.exists():
        app.mount("/configurator", StaticFiles(directory=str(static_dir), html=True), name="configurator_static")

        @app.get("/")
        async def serve_root():
            index_path = static_dir / "index.html"
            if index_path.exists():
                return FileResponse(index_path)
            return {"status": "ok", "docs": "/docs", "api": "/api/configurator/health"}

    return app


app = create_app()
