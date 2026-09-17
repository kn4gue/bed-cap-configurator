"""
Pydantic Schemas for Truck Bed Cap Configurator & Pricing Engine
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator

try:
    from .vin_validator import validate_vin
except ImportError:
    from vin_validator import validate_vin


class VehicleSelection(BaseModel):
    year: str = Field(..., description="Vehicle year or year range (e.g. 2024, 19+)")
    make: str = Field(..., description="Vehicle make (e.g. Ford, Chevrolet, GMC, Toyota, Ram, Jeep)")
    model: str = Field(..., description="Vehicle model (e.g. F-150, Silverado 1500, Tundra, Tacoma)")
    bed_size: str = Field(..., min_length=1, description="Mandatory bed length description (e.g. 5.5ft, 6.5ft, 70in Crew Cab)")
    cab_style: Optional[str] = Field(default="Crew Cab", description="Cab style (Crew Cab, Double Cab, Regular Cab)")
    tailgate_type: Optional[str] = Field(default="Standard", description="Tailgate type (Standard, MultiFlex, MultiPro)")
    vin: Optional[str] = Field(default="", description="17-character vehicle identification number (VIN) or TESTING bypass")
    paint_code: Optional[str] = Field(default="", description="OEM factory paint code (e.g. YZ, PW7, G1E)")
    paint_name: Optional[str] = Field(default="", description="Factory paint color name")
    custom_paint_code: Optional[str] = Field(default="", description="Customer specified custom OEM paint code & color")


class QuoteVehicleSelection(VehicleSelection):
    vin: str = Field(..., description="Mandatory valid 17-character VIN or 'TESTING'/'OVERRIDE'")

    @field_validator("vin")
    @classmethod
    def check_valid_vin(cls, v: str) -> str:
        clean = (v or "").strip().upper()
        if not validate_vin(clean):
            raise ValueError(f"Invalid VIN: '{v}'. Must be a valid 17-character VIN or 'TESTING' / 'OVERRIDE'.")
        return clean


class ConfiguratorOptionsSelection(BaseModel):
    height_profile: Optional[str] = Field(default="cab_high", description="cab_high, mid_rise_wedge, high_rise_29, high_rise_36")
    side_windows_driver: Optional[str] = Field(default=None, description="Driver-side window/door ID")
    side_windows_passenger: Optional[str] = Field(default=None, description="Passenger-side window/door ID")
    front_window: Optional[str] = Field(default=None, description="front_solid_picture or front_drop_down_slider")
    rear_door: Optional[str] = Field(default=None, description="Rear door ID")
    keyless_remote: bool = Field(default=False, description="OEM keyless remote sync")
    roof_reinforcement: Optional[str] = Field(default=None, description="roof_standard_honeycomb, roof_heavy_commercial, roof_track_channels")
    roof_rack: Optional[str] = Field(default=None, description="Roof rack ID (rack_none, rack_rhino_vortex_aero, rack_contractor_ladder, rack_yakima_jetstream, rack_tracks_only)")
    lighting_package: Optional[str] = Field(default=None, description="pkg_1_no_lights through pkg_8_12v_dome_dual42led_prop")
    interior_lighting: Optional[str] = Field(default=None, description="Legacy lighting alias")
    carpet_headliner: bool = Field(default=True, description="Full interior carpet headliner")
    interior_cargo_net: bool = Field(default=False, description="Ceiling storage cargo net")
    interior_usb_fuse_box: bool = Field(default=False, description="Quick disconnect fuse box with USB port")
    interior_clothes_hanger: bool = Field(default=False, description="Folding ceiling clothes hanger")
    interior_rod_holder: bool = Field(default=False, description="Overhead fishing rod holder rack")
    interior_hd_chop_roof: bool = Field(default=False, description="HD thick chop structural roof reinforcement")
    cap_pack_system: Optional[str] = Field(default=None, description="none, cap_pack_standard, cap_pack_divider_set, cap_pack_gun_divider_set")
    side_toolbox: Optional[str] = Field(default=None, description="Legacy toolbox selection")
    toolbox_driver: Optional[str] = Field(default="toolbox_driver_none", description="Driver-side toolbox ID (toolbox_driver_none, toolbox_ds_option_a through toolbox_ds_option_f)")
    toolbox_passenger: Optional[str] = Field(default="toolbox_passenger_none", description="Passenger-side toolbox ID (toolbox_passenger_none, toolbox_ps_option_a through toolbox_ps_option_f)")
    side_toolbox_driver: bool = Field(default=False, description="Driver toolbox flag")
    side_toolbox_passenger: bool = Field(default=False, description="Passenger toolbox flag")
    rear_decal: Optional[str] = Field(default="ranch_large_oval", description="ranch_large_oval, ranch_small_oval, stealth_clean")
    paint_finish: Optional[str] = Field(default="paint_oem_match", description="Paint finish ID (paint_oem_match, paint_matte_black_textured)")
    aluminum_height: Optional[str] = Field(default=None, description="Aluminum cap height profile ID (e.g. height_24_cab_high_full)")
    aluminum_side_layout: Optional[str] = Field(default=None, description="Aluminum side window/door code ID (e.g. win_alum_100_sliding)")
    aluminum_color: Optional[str] = Field(default=None, description="Aluminum color ID (e.g. alum_white)")
    tonneau_locking: Optional[str] = Field(default=None, description="Tonneau lid lock ID (tonneau_rotary_standard, tonneau_keyless_remote_sync)")
    tonneau_lighting: Optional[str] = Field(default=None, description="Tonneau interior light ID (tonneau_light_standard_dome, tonneau_light_undercover_strip)")
    tonneau_rack: Optional[str] = Field(default=None, description="Tonneau lid rack ID (tonneau_rack_none, tonneau_rack_rhino_vortex)")
    installation_preference: Optional[str] = Field(default="pro_install_seneca", description="Mandatory professional installation at Seneca, SC")


class ConfiguratorValidationRequest(BaseModel):
    vehicle: VehicleSelection
    model_id: str
    options: ConfiguratorOptionsSelection


class ValidationRuleAlert(BaseModel):
    type: str = Field(..., description="warning, error, or auto_applied")
    field: str
    message: str
    action_taken: Optional[str] = None


class PriceBreakdownItem(BaseModel):
    item_id: str
    name: str
    category: str
    price: float


class ConfiguratorValidationResponse(BaseModel):
    is_valid: bool
    model_id: str
    model_name: str
    base_price: float
    selected_options: List[PriceBreakdownItem]
    options_total: float
    labor_total: float
    subtotal: float = 0.0
    tax_rate: float = 0.06
    tax_total: float = 0.0
    grand_total: float
    alerts: List[ValidationRuleAlert] = []


class CustomerLeadInfo(BaseModel):
    full_name: str
    email: str
    phone: str
    zip_code: str
    primary_use: Optional[str] = "Personal / Recreation"
    preferred_contact: Optional[str] = "Email"


class QuoteSubmissionRequest(BaseModel):
    customer: CustomerLeadInfo
    vehicle: QuoteVehicleSelection
    model_id: str
    options: ConfiguratorOptionsSelection
    dealer_notes: Optional[str] = None


class QuoteSubmissionResponse(BaseModel):
    success: bool
    quote_reference: str
    lead_unique_id: str
    total_price: float
    status: str
    message: str


class EmployeeQuoteSubmissionRequest(BaseModel):
    customer: CustomerLeadInfo
    vehicle: QuoteVehicleSelection
    model_id: str
    options: ConfiguratorOptionsSelection
    internal_notes: Optional[str] = None
    sales_rep: Optional[str] = "Staff"
    lead_source: Optional[str] = "Employee Desk"
    status: Optional[str] = "draft"


class QuoteUpdateRequest(BaseModel):
    status: Optional[str] = None
    internal_notes: Optional[str] = None
    sales_rep: Optional[str] = None


# =====================================================================
# ADMIN & CATALOG MANAGEMENT SCHEMAS
# =====================================================================

class AdminModelPayload(BaseModel):
    id: str = Field(..., description="Unique model identifier slug, e.g. venturous_alpine")
    name: str = Field(..., description="Model display name")
    brand: str = Field(default="Venturous", description="Brand name (Venturous, Ranch, Unicover, Swiss, Custom)")
    style: str = Field(default="cab_high", description="Style profile: cab_high, mid_rise, high_rise, commercial_aluminum, tonneau_lid")
    category: str = Field(default="fiberglass", description="fiberglass, aluminum, steel, composite")
    cost: float = Field(default=0.0, ge=0.0, description="Base manufacturing/wholesale cost")
    markup_pct: float = Field(default=40.0, description="Markup percentage over cost")
    margin_pct: Optional[float] = Field(default=None, description="Gross margin percentage of retail")
    base_retail_price: float = Field(default=0.0, ge=0.0, description="Customer MSRP retail price")
    manual_price_override: bool = Field(default=False, description="Whether retail price was manually overridden")
    is_active: bool = Field(default=True, description="Whether model is active or archived")
    tagline: Optional[str] = Field(default="", description="Marketing tagline")
    description: Optional[str] = Field(default="", description="Product description")
    warranty: Optional[str] = Field(default="Lifetime Structural & Paint Warranty", description="Warranty terms")
    standard_features: List[str] = Field(default_factory=list, description="Standard included features")
    compatible_options: List[str] = Field(default_factory=list, description="Compatible option item IDs")


class AdminSettingsPayload(BaseModel):
    company_name: str = Field(default="Truck Guy Upfitters", description="Operating company name")
    default_brand: str = Field(default="Venturous", description="Default brand selection")
    default_markup_pct: float = Field(default=40.0, ge=0.0, description="Default markup % across covers")
    tax_rate: float = Field(default=0.06, ge=0.0, le=1.0, description="Sales tax rate")
    currency: str = Field(default="USD", description="Currency code")
    labor_rates: Dict[str, float] = Field(default_factory=lambda: {
        "base_installation": 200.0,
        "keyless_wiring": 120.0,
        "rack_installation": 95.0
    })


class AdminCatalogUpdatePayload(BaseModel):
    metadata: Optional[Dict[str, Any]] = None
    pricing_rules: Optional[Dict[str, Any]] = None
    models: List[AdminModelPayload]
    options_catalog: Optional[Dict[str, Any]] = None
    author: Optional[str] = "Admin"
    change_summary: Optional[str] = "Catalog updated via Admin portal"


class HistoryRestoreRequest(BaseModel):
    version_id: str
    author: Optional[str] = "Admin"

