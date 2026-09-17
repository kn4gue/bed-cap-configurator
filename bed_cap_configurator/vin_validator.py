"""
ISO 3779 / US DOT NHTSA VIN Check-Digit Validator & Decoder Helper
"""
from __future__ import annotations

import re
from typing import Dict, Any, Optional

TRANSLITERATION = {
    'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5, 'F': 6, 'G': 7, 'H': 8,
    'J': 1, 'K': 2, 'L': 3, 'M': 4, 'N': 5, 'P': 7, 'R': 9,
    'S': 2, 'T': 3, 'U': 4, 'V': 5, 'W': 6, 'X': 7, 'Y': 8, 'Z': 9
}

WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2]

# ISO 3779 10th Character Model Year Mapping
YEAR_MAP = {
    "5": "2005", "6": "2006", "7": "2007", "8": "2008", "9": "2009",
    "A": "2010", "B": "2011", "C": "2012", "D": "2013", "E": "2014",
    "F": "2015", "G": "2016", "H": "2017", "J": "2018", "K": "2019",
    "L": "2020", "M": "2021", "N": "2022", "P": "2023", "R": "2024",
    "S": "2025", "T": "2026", "V": "2027", "W": "2028", "X": "2029",
    "Y": "2030", "1": "2031", "2": "2032", "3": "2033", "4": "2034"
}


def validate_vin(vin: str) -> bool:
    """
    Validates a 17-character VIN using the standard ISO 3779 / NHTSA Modulo 11 check digit.
    Also accepts 'TESTING' or 'OVERRIDE' (case-insensitive) as valid testing/manager bypasses.
    """
    if not vin:
        return False
    clean = vin.strip().upper()
    if clean in ('TESTING', 'OVERRIDE'):
        return True
    if len(clean) != 17:
        return False
    # Reject dummy repeating characters (e.g. 11111111111111111, AAAAAAAAAAAAAAAA)
    if len(set(clean)) <= 2:
        return False
    # Characters I, O, Q are prohibited in standard 17-digit VINs
    if re.search(r'[IOQ]', clean):
        return False
    if not re.match(r'^[A-HJ-NPR-Z0-9]{17}$', clean):
        return False

    total = 0
    for i, char in enumerate(clean):
        if char.isdigit():
            val = int(char)
        elif char in TRANSLITERATION:
            val = TRANSLITERATION[char]
        else:
            return False
        total += val * WEIGHTS[i]

    remainder = total % 11
    expected_check = 'X' if remainder == 10 else str(remainder)
    return clean[8] == expected_check


def infer_vehicle_from_vin(vin: str) -> Dict[str, Any]:
    """
    Fast offline WMI prefix and model year inference without network latency.
    """
    clean = (vin or "").strip().upper()
    if not clean:
        return {"valid": False, "make": "Unknown", "model": "Unknown", "year": "2024"}

    if clean in ("TESTING", "OVERRIDE"):
        return {"valid": True, "make": "Ford", "model": "F-150", "year": "2024", "source": "testing_bypass"}

    is_valid = validate_vin(clean)
    est_year = YEAR_MAP.get(clean[9], "2024") if len(clean) >= 10 else "2024"

    est_make = "Ford"
    est_model = "F-150"
    if clean.startswith("1FT") or clean.startswith("1FM"):
        est_make = "Ford"
        est_model = "F-150"
    elif clean.startswith("1GC") or clean.startswith("2GC") or clean.startswith("3GC"):
        est_make = "Chevrolet"
        est_model = "Silverado 1500"
    elif clean.startswith("1GT") or clean.startswith("2GT") or clean.startswith("3GT"):
        est_make = "GMC"
        est_model = "Sierra 1500"
    elif clean.startswith("1C6") or clean.startswith("3C6"):
        est_make = "Ram"
        est_model = "Ram 1500"
    elif clean.startswith("5TF") or clean.startswith("4T1") or clean.startswith("3TM"):
        est_make = "Toyota"
        est_model = "Tacoma" if "TM" in clean[:3] else "Tundra"
    elif clean.startswith("1C4"):
        est_make = "Jeep"
        est_model = "Gladiator"

    return {
        "valid": is_valid,
        "make": est_make,
        "model": est_model,
        "year": est_year,
        "source": "wmi_heuristic"
    }
