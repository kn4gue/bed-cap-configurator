import pytest
from bed_cap_configurator.rules_engine import (
    get_master_data,
    get_model_by_id,
    validate_and_price_configuration,
)
from bed_cap_configurator.schemas import (
    ConfiguratorOptionsSelection,
    ConfiguratorValidationRequest,
    VehicleSelection,
)


def test_master_data_loaded():
    data = get_master_data()
    assert "models" in data
    assert len(data["models"]) >= 5
    assert "options_catalog" in data
    assert "fitment_rules" in data
    assert len(data["fitment_rules"]) >= 50


def test_rule_toolbox_auto_selects_solid_door():
    veh = VehicleSelection(
        year="2024",
        make="Ford",
        model="F-150",
        bed_size="5.5ft",
        vin="1FTFW1ED2NFB12345"
    )
    opts = ConfiguratorOptionsSelection(
        side_windows_driver="win_sliders_screen",
        side_toolbox_driver=True,
        installation_preference="pro_install_seneca"
    )
    req = ConfiguratorValidationRequest(
        vehicle=veh,
        model_id="ranch_echo",
        options=opts
    )
    res = validate_and_price_configuration(req)
    assert res.is_valid is True
    auto_alerts = [a for a in res.alerts if a.type == "auto_applied"]
    assert len(auto_alerts) >= 1
    assert "Solid Aluminum Door" in auto_alerts[0].action_taken
    assert res.grand_total > 3500.0


def test_rule_tonneau_lid_deselection():
    veh = VehicleSelection(
        year="2024",
        make="Chevrolet",
        model="Silverado 1500",
        bed_size="5.8ft",
        vin="1GCUDYED8NZ123456"
    )
    opts = ConfiguratorOptionsSelection(
        roof_rack="rack_rhino_vortex_aero",
        installation_preference="pickup_assembled"
    )
    req = ConfiguratorValidationRequest(
        vehicle=veh,
        model_id="ranch_fusion_lid",
        options=opts
    )
    res = validate_and_price_configuration(req)
    assert res.is_valid is True
    warnings = [a for a in res.alerts if a.type == "warning"]
    assert any("Roof racks cannot be mounted" in w.message for w in warnings)


def test_ranch_sierra_xtra_includes_headliner():
    veh = VehicleSelection(
        year="2024",
        make="Ford",
        model="F-150",
        bed_size="5.5ft",
        vin="OVERRIDE"
    )
    opts = ConfiguratorOptionsSelection(
        carpet_headliner=True,
        lighting_package="pkg_3_12v_dome",
        front_window="front_drop_down_slider"
    )
    req = ConfiguratorValidationRequest(
        vehicle=veh,
        model_id="ranch_sierra_xtra",
        options=opts
    )
    res = validate_and_price_configuration(req)
    assert res.is_valid is True
    headliner_items = [i for i in res.selected_options if i.item_id == "int_carpet_headliner"]
    assert len(headliner_items) == 0


def test_dual_side_toolbox_reinforcements():
    veh = VehicleSelection(
        year="2024",
        make="Ford",
        model="F-150",
        bed_size="5.5ft",
        vin="TESTING"
    )
    req = ConfiguratorValidationRequest(
        vehicle=veh,
        model_id="ranch_icon",
        options=ConfiguratorOptionsSelection(
            toolbox_driver="toolbox_ds_option_c",
            toolbox_passenger="toolbox_ps_option_f"
        )
    )
    res = validate_and_price_configuration(req)
    assert res.is_valid is True
    ds_reinf = next((o for o in res.selected_options if o.item_id == "reinforcement_ds_toolbox"), None)
    ps_reinf = next((o for o in res.selected_options if o.item_id == "reinforcement_ps_toolbox"), None)
    assert ds_reinf is not None
    assert ps_reinf is not None
    assert ds_reinf.price == 50.0
    assert ps_reinf.price == 50.0


def test_aluminum_heavy_duty_reinforcement_exemption():
    veh = VehicleSelection(
        year="2024",
        make="Ford",
        model="F-150",
        bed_size="5.5ft",
        vin="TESTING"
    )
    for model_id in ["unicover_heavy_duty", "swiss_heavy_duty", "ranch_workforce"]:
        req = ConfiguratorValidationRequest(
            vehicle=veh,
            model_id=model_id,
            options=ConfiguratorOptionsSelection(
                toolbox_driver="toolbox_ds_option_a",
                toolbox_passenger="toolbox_ps_option_d"
            )
        )
        res = validate_and_price_configuration(req)
        assert res.is_valid is True
        ds_reinf = next((o for o in res.selected_options if o.item_id == "reinforcement_ds_toolbox"), None)
        assert ds_reinf is None
