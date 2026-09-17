import pytest
from bed_cap_configurator.vin_validator import validate_vin, infer_vehicle_from_vin


def test_valid_vin_check_digits():
    # Valid Ford F-150 VIN
    assert validate_vin("1FTFW1ED2NFB12345") is True
    # Valid GM VIN
    assert validate_vin("1GCUDYED5NZ123456") is True


def test_testing_and_override_bypass():
    assert validate_vin("TESTING") is True
    assert validate_vin("testing") is True
    assert validate_vin("OVERRIDE") is True
    assert validate_vin("override") is True


def test_invalid_vins():
    assert validate_vin("") is False
    assert validate_vin(None) is False
    assert validate_vin("SHORT_VIN") is False
    # Repeating characters
    assert validate_vin("11111111111111111") is False
    assert validate_vin("AAAAAAAAAAAAAAAA") is False
    # Prohibited characters (I, O, Q)
    assert validate_vin("1FTFW1ED4NIB12345") is False
    assert validate_vin("1FTFW1ED4NOB12345") is False
    assert validate_vin("1FTFW1ED4NQB12345") is False


def test_infer_vehicle():
    res_ford = infer_vehicle_from_vin("1FTFW1ED4NFB12345")
    assert res_ford["make"] == "Ford"
    assert res_ford["model"] == "F-150"

    res_chevy = infer_vehicle_from_vin("1GCUDYED8NZ123456")
    assert res_chevy["make"] == "Chevrolet"
    assert res_chevy["model"] == "Silverado 1500"

    res_bypass = infer_vehicle_from_vin("TESTING")
    assert res_bypass["valid"] is True
    assert res_bypass["make"] == "Ford"
