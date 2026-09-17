"""
LTA Configurator Rules Engine & Retail Totalizer
Enforces engineering prerequisites, exclusions, auto-resolutions, and transparent MSRP math.
"""

import json
import os
from pathlib import Path
from typing import Dict, List, Tuple

try:
    from .schemas import (
        ConfiguratorOptionsSelection,
        ConfiguratorValidationRequest,
        ConfiguratorValidationResponse,
        PriceBreakdownItem,
        ValidationRuleAlert,
        VehicleSelection,
    )
except ImportError:
    from schemas import (
        ConfiguratorOptionsSelection,
        ConfiguratorValidationRequest,
        ConfiguratorValidationResponse,
        PriceBreakdownItem,
        ValidationRuleAlert,
        VehicleSelection,
    )

DEFAULT_CATALOG_PATH = Path(__file__).resolve().parent / "data" / "master_catalog.json"
MASTER_DATA_PATH = Path(os.environ.get("CONFIGURATOR_MASTER_DATA", str(DEFAULT_CATALOG_PATH)))
if not MASTER_DATA_PATH.exists() and Path("/home/twis7/homunculus-server/data/lta/lta_configurator_master_data.json").exists():
    MASTER_DATA_PATH = Path("/home/twis7/homunculus-server/data/lta/lta_configurator_master_data.json")

_CACHED_MASTER_DATA = None

def get_master_data() -> dict:
    global _CACHED_MASTER_DATA
    if _CACHED_MASTER_DATA is None:
        if os.path.exists(MASTER_DATA_PATH):
            with open(MASTER_DATA_PATH, "r", encoding="utf-8") as f:
                _CACHED_MASTER_DATA = json.load(f)
        else:
            _CACHED_MASTER_DATA = {}
    return _CACHED_MASTER_DATA


def get_model_by_id(model_id: str) -> dict | None:
    data = get_master_data()
    for m in data.get("models", []):
        if m["id"] == model_id:
            return m
    return None


def get_option_by_id(option_id: str) -> dict | None:
    data = get_master_data()
    opt_cat = data.get("options_catalog", {})
    for cat_name, items in opt_cat.items():
        for item in items:
            if item["id"] == option_id:
                return item
    return None


def validate_and_price_configuration(req: ConfiguratorValidationRequest) -> ConfiguratorValidationResponse:
    model = get_model_by_id(req.model_id)
    if not model:
        # Fallback default
        model = {
            "id": req.model_id,
            "name": "LTA Custom Cap",
            "base_retail_price": 2625.0,
            "style": "cab_high",
            "standard_features": []
        }

    opts = req.options
    alerts: List[ValidationRuleAlert] = []
    selected_items: List[PriceBreakdownItem] = []
    base_price = float(model.get("base_retail_price", 2625.0))

    # Check Model Style
    is_lid = model.get("style") in ["tonneau_lid", "lid"] or req.model_id in ["ranch_legacy_lid", "ranch_sportwrap_lid", "ranch_fusion_lid", "unicover_aurora_lid"]
    is_aluminum = model.get("style") in ["aluminum_cap", "aluminum_commercial"] or req.model_id in ["ranch_pro_series", "unicover_light_duty", "unicover_heavy_duty", "swiss_heavy_duty"]

    if is_lid:
        if opts.roof_rack and opts.roof_rack != "rack_none":
            alerts.append(ValidationRuleAlert(
                type="warning",
                field="roof_rack",
                message="Roof racks cannot be mounted to low-profile fiberglass tonneau lids.",
                action_taken="Roof rack deselected"
            ))
            opts.roof_rack = None

        if opts.tonneau_locking == "tonneau_keyless_remote_sync" or opts.keyless_remote:
            selected_items.append(PriceBreakdownItem(
                item_id="tonneau_keyless_remote_sync",
                name="Keyless Remote Lock Sync",
                category="locks",
                price=245.0
            ))
        if opts.tonneau_lighting == "tonneau_light_undercover_strip":
            selected_items.append(PriceBreakdownItem(
                item_id="tonneau_light_undercover_strip",
                name="48\" Under-Cover LED Light Strip",
                category="lighting",
                price=125.0
            ))
        if opts.tonneau_rack == "tonneau_rack_rhino_vortex":
            selected_items.append(PriceBreakdownItem(
                item_id="tonneau_rack_rhino_vortex",
                name="Rhino-Rack Vortex Tonneau Crossbars",
                category="roof_rack",
                price=495.0
            ))

    # Aluminum specific rules & pricing
    if is_aluminum:
        # Aluminum Height Profile
        if opts.aluminum_height:
            h_data = get_option_by_id(opts.aluminum_height)
            if h_data and h_data.get("price", 0) > 0:
                selected_items.append(PriceBreakdownItem(
                    item_id=h_data["id"],
                    name=f"Height: {h_data['name']}",
                    category="aluminum_height",
                    price=float(h_data["price"])
                ))

        # Aluminum Side Layout (#100 - #1200)
        if opts.aluminum_side_layout:
            bed_sz = getattr(req.vehicle, "bed_size", getattr(req.vehicle, "bed_length", "5.5ft"))
            if opts.aluminum_side_layout == "win_alum_1000_quad_utility" and bed_sz not in ["8.0ft", "8ft", "8.0", "8.1ft"]:
                alerts.append(ValidationRuleAlert(
                    type="warning",
                    field="aluminum_side_layout",
                    message="#1000 Quad 44\" Utility Doors require an 8 ft long bed configuration.",
                    action_taken="Quad doors selected for 8ft bed"
                ))
            s_data = get_option_by_id(opts.aluminum_side_layout)
            if s_data and s_data.get("price", 0) > 0:
                selected_items.append(PriceBreakdownItem(
                    item_id=s_data["id"],
                    name=f"Side Windows: {s_data['name']}",
                    category="aluminum_side_windows",
                    price=float(s_data["price"])
                ))

        # Aluminum Color / Finish
        if opts.aluminum_color:
            c_data = get_option_by_id(opts.aluminum_color)
            if c_data and c_data.get("price", 0) > 0:
                selected_items.append(PriceBreakdownItem(
                    item_id=c_data["id"],
                    name=f"Color: {c_data['name']}",
                    category="paint_finish",
                    price=float(c_data["price"])
                ))

    # Rule 1: Driver-Side Toolbox requires Solid Side Access Door
    if opts.side_toolbox_driver and opts.side_windows_driver != "win_solid_aluminum_door":
        alerts.append(ValidationRuleAlert(
            type="auto_applied",
            field="side_windows_driver",
            message="Driver-side commercial toolbox requires a solid lift-up access door instead of glass.",
            action_taken="Auto-selected Solid Aluminum Door for Driver Side"
        ))
        opts.side_windows_driver = "win_solid_aluminum_door"

    # Rule 2: Passenger-Side Toolbox requires Solid Side Access Door
    if opts.side_toolbox_passenger and opts.side_windows_passenger != "win_solid_aluminum_door":
        alerts.append(ValidationRuleAlert(
            type="auto_applied",
            field="side_windows_passenger",
            message="Passenger-side commercial toolbox requires a solid lift-up access door instead of glass.",
            action_taken="Auto-selected Solid Aluminum Door for Passenger Side"
        ))
        opts.side_windows_passenger = "win_solid_aluminum_door"

    # Rule 3: Heavy Duty Ladder Racks & Commercial Upgrades
    if opts.roof_rack == "rack_commercial_ladder_2bar" and model.get("style") not in ["commercial", "aluminum_commercial", "commercial_fiberglass"]:
        alerts.append(ValidationRuleAlert(
            type="warning",
            field="roof_rack",
            message="Commercial 2-bar ladder rack includes Honeycomb Roof Reinforcement for 500 lb load capacity.",
            action_taken="Reinforcement core bundled"
        ))

    # Rule 4: Keyless Remote Compatibility Check
    frameless_models = ["ranch_icon", "ranch_icon_premier", "ranch_fusion", "ranch_fusion_classic", "venturous_ozark", "ranch_legacy_lid", "ranch_sportwrap_lid", "ranch_fusion_lid", "unicover_aurora_lid"]
    if opts.keyless_remote and req.model_id not in frameless_models:
        alerts.append(ValidationRuleAlert(
            type="warning",
            field="keyless_remote",
            message="Remote Keyless Entry requires a single-handle frameless all-glass rear door. Upgrade to the Ranch Fusion or Ranch Icon to unlock keyless entry.",
            action_taken="Keyless Remote option noted for upgrade"
        ))

    # Rule 5: Commercial 600 lb Capacity Upgrade Check
    commercial_models = ["ranch_workforce", "ranch_pro_series", "unicover_heavy_duty", "swiss_heavy_duty"]
    if (opts.roof_reinforcement == "hd_600lb_roof_reinforce" or opts.interior_hd_chop_roof) and req.model_id not in commercial_models:
        alerts.append(ValidationRuleAlert(
            type="warning",
            field="roof_reinforcement",
            message="600 lb internal reinforced roof structure requires a commercial shell. Upgrade to the Ranch WorkForce (Fiberglass) or Ranch Pro Series (Aluminum).",
            action_taken="600 lb structure flagged for commercial shell"
        ))

    # Rule 6: SportWrap vs Legacy Carpet Headliner Check
    if req.model_id == "ranch_sportwrap_lid" and opts.carpet_headliner:
        alerts.append(ValidationRuleAlert(
            type="warning",
            field="carpet_headliner",
            message="The Ranch SportWrap features a smooth-top interior. Upgrade to the Ranch Legacy Tonneau Cover for a pre-installed recycled carpet headliner.",
            action_taken="Headliner noted for Legacy upgrade"
        ))

    # Rule 7: Solid Fiberglass Sides (No Windows) on Frameless Glass Models
    frameless_glass_models = ["ranch_icon", "ranch_icon_premier", "venturous_ozark"]
    if req.model_id in frameless_glass_models:
        if opts.side_windows_driver == "win_solid_fiberglass_no_window":
            alerts.append(ValidationRuleAlert(
                type="auto_applied",
                field="side_windows_driver",
                message="Solid fiberglass sides delete is not available on frameless all-glass models. Reverted to signature frameless side glass.",
                action_taken="Auto-selected Frameless Glass for Driver Side"
            ))
            opts.side_windows_driver = "win_sliders_screen"
        if opts.side_windows_passenger == "win_solid_fiberglass_no_window":
            alerts.append(ValidationRuleAlert(
                type="auto_applied",
                field="side_windows_passenger",
                message="Solid fiberglass sides delete is not available on frameless all-glass models. Reverted to signature frameless side glass.",
                action_taken="Auto-selected Frameless Glass for Passenger Side"
            ))
            opts.side_windows_passenger = "win_sliders_screen"

    # Build Price Items
    # 1. Driver Window/Door (for fiberglass models)
    if not is_lid and not is_aluminum and opts.side_windows_driver:
        win_d = get_option_by_id(opts.side_windows_driver)
        if win_d and win_d.get("retail_price", 0) != 0:
            selected_items.append(PriceBreakdownItem(
                item_id=win_d["id"],
                name=f"Driver Side: {win_d['name']}",
                category="side_access",
                price=float(win_d["retail_price"])
            ))

    # 2. Passenger Window/Door (for fiberglass models)
    if not is_lid and not is_aluminum and opts.side_windows_passenger:
        win_p = get_option_by_id(opts.side_windows_passenger)
        if win_p and win_p.get("retail_price", 0) != 0:
            selected_items.append(PriceBreakdownItem(
                item_id=win_p["id"],
                name=f"Passenger Side: {win_p['name']}",
                category="side_access",
                price=float(win_p["retail_price"])
            ))

    # 3. Front Window Options (Hinged drop-downs, sliders, solid fiberglass, picture, cutout)
    if not is_lid and not is_aluminum and opts.front_window:
        front_map = {
            "front_picture": ("Front Picture Window", 0.0),
            "front_solid_picture": ("Front Picture Window", 0.0),
            "front_drop_down_picture": ("Front Drop Down Picture", 95.0),
            "front_solid_fiberglass": ("Front Solid Fiberglass (No Window)", 0.0),
            "front_sliding_window": ("Front Sliding Window", 75.0),
            "front_sliding": ("Front Sliding Window", 75.0),
            "front_drop_down_slider": ("Front Drop Down Slider", 145.0),
            "front_cutout_hole": ("Front Cutout Hole Only", 0.0)
        }
        if opts.front_window in front_map:
            name, price = front_map[opts.front_window]
            if price != 0.0:
                selected_items.append(PriceBreakdownItem(
                    item_id=opts.front_window,
                    name=name,
                    category="front_window",
                    price=price
                ))

    # 4. Rear Door (Solid aluminum double doors not available on fiberglass models)
    if not is_lid and opts.rear_door:
        if opts.rear_door == "rear_commercial_double" and not is_aluminum:
            alerts.append(ValidationRuleAlert(
                type="auto_applied",
                field="rear_door",
                message="Solid Aluminum Double Walk-In Cargo Doors are exclusive to commercial aluminum caps. Heavy-Duty Framed Glass Door selected for fiberglass shell.",
                action_taken="Auto-selected Heavy-Duty Framed Glass Door"
            ))
            opts.rear_door = "rear_framed_dual_t"

        rear_d = get_option_by_id(opts.rear_door)
        std_rear = any("frameless" in s.lower() for s in model.get("standard_features", []))
        if rear_d and rear_d.get("retail_price", 0) > 0 and not std_rear:
            selected_items.append(PriceBreakdownItem(
                item_id=rear_d["id"],
                name=rear_d["name"],
                category="rear_door",
                price=float(rear_d["retail_price"])
            ))

    # 5. Keyless Remote Sync (Compatible with frameless all-glass single handle rear doors & lids)
    if opts.keyless_remote:
        keyless_opt = get_option_by_id("rear_keyless_remote_sync")
        price = float(keyless_opt["retail_price"]) if keyless_opt else 245.0
        selected_items.append(PriceBreakdownItem(
            item_id="rear_keyless_remote_sync",
            name="OEM Keyless Remote Lock Integration",
            category="rear_door",
            price=price
        ))

    # 6. Roof Reinforcement
    if not is_lid and opts.roof_reinforcement:
        if opts.roof_reinforcement in ["roof_heavy_commercial", "hd_600lb_roof_reinforce"]:
            selected_items.append(PriceBreakdownItem(
                item_id="roof_heavy_commercial",
                name="Commercial Heavy-Duty Internal Roof Skeleton (600 lbs Rating)",
                category="roof_structure",
                price=295.0
            ))
        elif opts.roof_reinforcement == "roof_track_channels":
            selected_items.append(PriceBreakdownItem(
                item_id="roof_track_channels",
                name="Integrated Heavy-Duty Roof Mounting Track Channels",
                category="roof_structure",
                price=195.0
            ))

    # 7. Roof Rack System
    if not is_lid and opts.roof_rack and opts.roof_rack != "rack_none":
        rack_pricing = {
            "rack_rhino_vortex_aero": ("Rhino-Rack Vortex Aero Crossbar System", 495.0),
            "rack_contractor_ladder": ("Commercial Heavy-Duty 2-Bar Contractor Ladder Rack", 425.0),
            "rack_yakima_jetstream": ("Yakima JetStream Aerodynamic Overlanding Roof Rack", 545.0),
            "rack_tracks_only": ("Aerodynamic Factory Roof Mounting Tracks Only", 195.0)
        }
        if opts.roof_rack in rack_pricing:
            name, price = rack_pricing[opts.roof_rack]
            selected_items.append(PriceBreakdownItem(
                item_id=opts.roof_rack,
                name=name,
                category="roof_rack",
                price=price
            ))

    # 8. Interior Carpet Headliner (Standard on Sierra Xtra, Icon, Icon Premier, Fusion, Fusion Classic, Legacy Lid, Ozark)
    std_headliner_models = [
        "ranch_sierra_xtra", "ranch_icon", "ranch_icon_premier",
        "ranch_fusion", "ranch_fusion_classic", "ranch_legacy_lid", "venturous_ozark"
    ]
    is_std_headliner = req.model_id in std_headliner_models or any(
        "headliner" in s.lower() or "carpet" in s.lower() for s in model.get("standard_features", [])
    )
    if opts.carpet_headliner and not is_std_headliner and not is_lid:
        selected_items.append(PriceBreakdownItem(
            item_id="int_carpet_headliner",
            name="Interior Charcoal Carpet Headliner",
            category="interior",
            price=175.0
        ))

    # 9. Official 8-Tier Lighting Packages
    std_dome_models = [
        "ranch_sierra_xtra", "ranch_icon", "ranch_icon_premier",
        "ranch_fusion", "ranch_fusion_classic", "venturous_ozark"
    ]
    is_std_dome = req.model_id in std_dome_models or any(
        "dome light" in s.lower() for s in model.get("standard_features", [])
    )

    pkg_map = {
        "pkg_1_no_lights": ("Lighting Package 1: No Lights", 0.0),
        "pkg_2_batt_dome": ("Lighting Package 2: Battery Dome Light (Rear Door)", 0.0 if is_std_dome else 45.0),
        "pkg_3_12v_dome": ("Lighting Package 3: 12V Dome Light (Rear Door)", 0.0 if is_std_dome else 75.0),
        "pkg_4_12v_dome_prop": ("Lighting Package 4: 12V Dome Light w/ Prop Switch", 40.0 if is_std_dome else 115.0),
        "pkg_5_12v_dome_42led": ("Lighting Package 5: 12V Dome + 42\" LED Center Roof Light", 120.0 if is_std_dome else 195.0),
        "pkg_6_12v_dome_42led_prop": ("Lighting Package 6: 12V Dome + 42\" LED + Prop Switch", 170.0 if is_std_dome else 245.0),
        "pkg_7_12v_dome_dual42led": ("Lighting Package 7: 12V Dome + Dual 42\" LED Roof Lights", 220.0 if is_std_dome else 295.0),
        "pkg_8_12v_dome_dual42led_prop": ("Lighting Package 8: 12V Dome + Dual 42\" LEDs + Prop Switch", 270.0 if is_std_dome else 345.0),
        # Legacy aliases
        "light_12v_dome": ("Lighting Package 3: 12V Dome Light (Rear Door)", 0.0 if is_std_dome else 75.0),
        "light_48_center_strip": ("Lighting Package 5: 12V Dome + 42\" LED Center Roof Light", 120.0 if is_std_dome else 195.0),
        "light_dual_48_parallel": ("Lighting Package 7: 12V Dome + Dual 42\" LED Roof Lights", 220.0 if is_std_dome else 295.0),
        "light_perimeter_3side": ("Lighting Package 8: 12V Dome + Dual 42\" LEDs + Prop Switch", 270.0 if is_std_dome else 345.0),
        "light_door_prop_switch": ("Lighting Package 4: 12V Dome Light w/ Prop Switch", 40.0 if is_std_dome else 115.0),
        "light_ext_rear_floods": ("Dual Exterior High-Output LED Work / Reverse Flood Lights", 195.0),
        "light_side_toolbox_strips": ("Dual Side Access Door LED Courtesy Lighting Strips", 165.0),
        "light_motion_battery_pod": ("Lighting Package 2: Battery Dome Light (Rear Door)", 0.0 if is_std_dome else 45.0)
    }
    chosen_pkg = opts.lighting_package or opts.interior_lighting
    if chosen_pkg in pkg_map:
        name, price = pkg_map[chosen_pkg]
        if price > 0:
            selected_items.append(PriceBreakdownItem(
                item_id=chosen_pkg,
                name=name,
                category="lighting",
                price=price
            ))

    # 10. Interior Gear & Accessories
    if not is_lid:
        if opts.interior_cargo_net:
            selected_items.append(PriceBreakdownItem(
                item_id="int_cargo_net",
                name="Ceiling Storage Cargo Net",
                category="interior_gear",
                price=45.0
            ))
        if opts.interior_usb_fuse_box:
            selected_items.append(PriceBreakdownItem(
                item_id="int_usb_fuse_box",
                name="Quick Disconnect 12V Fuse Box w/ Dual USB Port",
                category="interior_gear",
                price=95.0
            ))
        if opts.interior_clothes_hanger:
            selected_items.append(PriceBreakdownItem(
                item_id="int_clothes_hanger",
                name="Folding Ceiling Clothes Hanger Hooks",
                category="interior_gear",
                price=35.0
            ))
        if opts.interior_rod_holder:
            selected_items.append(PriceBreakdownItem(
                item_id="int_rod_holder",
                name="Overhead Dual Fishing Rod Holder Rack",
                category="interior_gear",
                price=75.0
            ))
        if opts.interior_hd_chop_roof:
            selected_items.append(PriceBreakdownItem(
                item_id="int_hd_chop_roof",
                name="HD Thick Chop Structural Roof Reinforcement",
                category="roof_structure",
                price=195.0
            ))

    # 11. Cap-Pack Ceiling Pull-Out Drawer Systems
    if not is_lid and opts.cap_pack_system and opts.cap_pack_system != "none":
        cap_pack_map = {
            "cap_pack_standard": ("Cap-Pack Ceiling Storage Drawer System", 1895.0),
            "cap_pack_divider_set": ("Cap-Pack Ceiling Drawer w/ Gear Divider Set", 2040.0),
            "cap_pack_gun_divider_set": ("Cap-Pack Ceiling Drawer w/ Foam Gun Divider Set", 2090.0)
        }
        if opts.cap_pack_system in cap_pack_map:
            name, price = cap_pack_map[opts.cap_pack_system]
            selected_items.append(PriceBreakdownItem(
                item_id=opts.cap_pack_system,
                name=name,
                category="cap_pack",
                price=price
            ))

    # 12. Side Tool Boxes & Reinforcements
    ds_toolbox_map = {
        "toolbox_ds_option_a": ("Driver Side Option A 2.0", 335.0),
        "toolbox_ds_option_b": ("Driver Side Option B 2.0", 335.0),
        "toolbox_ds_option_c": ("Driver Side Option C 2.0", 425.0),
        "toolbox_ds_option_d": ("Driver Side Option D 2.0", 335.0),
        "toolbox_ds_option_e": ("Driver Side Option E 2.0", 335.0),
        "toolbox_ds_option_f": ("Driver Side Option F 2.0", 425.0),
        "toolbox_driver_galvanized": ("Driver Side Option A 2.0", 335.0),
        "toolbox_shelf_opt_a": ("Driver Side Option A 2.0", 335.0),
        "toolbox_shelf_opt_b": ("Driver Side Option B 2.0", 335.0),
        "toolbox_shelf_opt_c": ("Driver Side Option C 2.0", 425.0),
    }

    ps_toolbox_map = {
        "toolbox_ps_option_a": ("Passenger Side Option A 2.0", 335.0),
        "toolbox_ps_option_b": ("Passenger Side Option B 2.0", 335.0),
        "toolbox_ps_option_c": ("Passenger Side Option C 2.0", 425.0),
        "toolbox_ps_option_d": ("Passenger Side Option D 2.0", 335.0),
        "toolbox_ps_option_e": ("Passenger Side Option E 2.0", 335.0),
        "toolbox_ps_option_f": ("Passenger Side Option F 2.0", 425.0),
        "toolbox_passenger_galvanized": ("Passenger Side Option A 2.0", 335.0),
    }

    toolbox_compatible_models = [
        "ranch_icon", "ranch_icon_premier", "ranch_fusion", "ranch_fusion_classic",
        "ranch_echo", "ranch_sierra", "ranch_sierra_xtra", "ranch_skyline", "venturous_ozark",
        "unicover_heavy_duty", "swiss_heavy_duty", "ranch_workforce"
    ]
    fiberglass_caps = [
        "ranch_icon", "ranch_icon_premier", "ranch_fusion", "ranch_fusion_classic",
        "ranch_echo", "ranch_sierra", "ranch_sierra_xtra", "ranch_skyline", "venturous_ozark"
    ]
    is_fiberglass = req.model_id in fiberglass_caps

    # Driver Side Toolbox
    chosen_ds = opts.toolbox_driver
    if not chosen_ds or chosen_ds == "toolbox_driver_none":
        if opts.side_toolbox_driver or opts.side_toolbox in ["toolbox_driver_galvanized", "toolbox_dual_sides", "toolbox_shelf_opt_a", "toolbox_shelf_opt_b", "toolbox_shelf_opt_c", "toolbox_driver_full"]:
            chosen_ds = "toolbox_ds_option_a"

    if not is_lid and chosen_ds and chosen_ds != "toolbox_driver_none" and chosen_ds in ds_toolbox_map:
        name, price = ds_toolbox_map[chosen_ds]
        selected_items.append(PriceBreakdownItem(
            item_id=chosen_ds,
            name=f"Toolbox - Driver Side: {name}",
            category="toolboxes",
            price=price
        ))
        if is_fiberglass:
            selected_items.append(PriceBreakdownItem(
                item_id="reinforcement_ds_toolbox",
                name="DS Toolbox Reinforcement (Fiberglass Shell Mandatory)",
                category="toolboxes",
                price=50.0
            ))

    # Passenger Side Toolbox
    chosen_ps = opts.toolbox_passenger
    if not chosen_ps or chosen_ps == "toolbox_passenger_none":
        if opts.side_toolbox_passenger or opts.side_toolbox in ["toolbox_passenger_galvanized", "toolbox_dual_sides", "toolbox_passenger_full"]:
            chosen_ps = "toolbox_ps_option_a"

    if not is_lid and chosen_ps and chosen_ps != "toolbox_passenger_none" and chosen_ps in ps_toolbox_map:
        name, price = ps_toolbox_map[chosen_ps]
        selected_items.append(PriceBreakdownItem(
            item_id=chosen_ps,
            name=f"Toolbox - Passenger Side: {name}",
            category="toolboxes",
            price=price
        ))
        if is_fiberglass:
            selected_items.append(PriceBreakdownItem(
                item_id="reinforcement_ps_toolbox",
                name="PS Toolbox Reinforcement (Fiberglass Shell Mandatory)",
                category="toolboxes",
                price=50.0
            ))

    has_toolbox = (chosen_ds and chosen_ds != "toolbox_driver_none") or (chosen_ps and chosen_ps != "toolbox_passenger_none")
    if has_toolbox and req.model_id not in toolbox_compatible_models:
        alerts.append(ValidationRuleAlert(
            type="warning",
            field="toolboxes",
            message="Side toolboxes are only available on fiberglass caps, aluminum heavy-duty covers, and the Ranch WorkForce.",
            action_taken="Toolbox configuration flagged"
        ))

    # 11. Mandatory Shop Installation (Seneca, SC) + Keyless Wiring Integration
    has_keyless = bool(opts.keyless_remote or opts.tonneau_locking == "tonneau_keyless_remote_sync")
    labor_price = 320.0 if has_keyless else 200.0
    labor_name = (
        "Professional Shop Installation (Base $200 + $120 Keyless Remote Wiring)"
        if has_keyless
        else "Professional Shop Installation (Seneca, SC - Mandatory)"
    )
    selected_items.append(PriceBreakdownItem(
        item_id="pro_install_seneca",
        name=labor_name,
        category="labor",
        price=labor_price
    ))

    options_total = sum(i.price for i in selected_items if i.category != "labor")
    subtotal = base_price + options_total
    # South Carolina State Sales Tax (6%)
    tax_rate = 0.06
    tax_total = round((subtotal + labor_price) * tax_rate, 2)
    grand_total = round(subtotal + labor_price + tax_total, 2)

    return ConfiguratorValidationResponse(
        is_valid=True,
        model_id=model["id"],
        model_name=model["name"],
        base_price=base_price,
        selected_options=selected_items,
        options_total=options_total,
        labor_total=labor_price,
        subtotal=subtotal,
        tax_rate=tax_rate,
        tax_total=tax_total,
        grand_total=grand_total,
        alerts=alerts
    )
