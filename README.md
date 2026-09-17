# Truck & Commercial Bed Cap Configurator

An open-source, production-ready rules engine, NHTSA VIN validator, and interactive web widget for configuring, validating, and pricing truck bed caps and tonneau covers (Venturous, Ranch, Unicover, Swiss, and custom upfits).

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)

---

## ⚡ Features

- **Engineering Fitment & Constraint Solver**: Enforces physical manufacturing rules (e.g. side toolboxes require solid aluminum lift-up doors; commercial walk-in double doors require commercial aluminum structural shells; fiberglass roofs require reinforcement brackets for internal toolboxes).
- **ISO 3779 / NHTSA VIN Validation & Decoding**: Validates 17-digit vehicle identification numbers using the official Modulo 11 check digit algorithm, with fast offline WMI heuristic inference and optional live NHTSA VPIC integration.
- **Transparent Totalization**: Real-time MSRP calculation with granular option itemization, custom paint options, sales tax, and labor rate breakdowns.
- **Interactive Web Widget**: Embeddable dark/light responsive frontend (`configurator.js` / `configurator.css`) with 5-step intuitive flow (Vehicle Selection → Model Selection → Options & Windows → Accessories & Lighting → Review & Quote).
- **FastAPI REST API**: Comprehensive endpoints for VIN decoding, makes/models/bed sizes query, configuration validation, quote submission, and employee sales desks.

---

## 🚀 Quick Start

### 1. Installation

```bash
git clone https://github.com/kn4gue/bed-cap-configurator.git
cd bed-cap-configurator
pip install -e ".[dev]"
```

### 2. Run Test Suite

```bash
pytest
```

### 3. Launch the Server & UI

```bash
bed-cap-configurator serve --port 8000
```

Open your browser at `http://127.0.0.1:8000/` to test the interactive widget and explore the API docs at `http://127.0.0.1:8000/docs`.

---

## 🛠️ CLI Usage

### Decode & Validate a VIN
```bash
bed-cap-configurator decode-vin 1FTFW1ED4NFB12345
```

Output:
```json
{
  "valid": true,
  "make": "Ford",
  "model": "F-150",
  "year": "2022",
  "source": "wmi_heuristic"
}
```

### Inspect Available Models
```bash
bed-cap-configurator catalog --models-only
```

---

## 🐍 Python API Example

```python
from bed_cap_configurator import (
    VehicleSelection,
    ConfiguratorOptionsSelection,
    ConfiguratorValidationRequest,
    validate_and_price_configuration,
    validate_vin,
)

# 1. Validate VIN
assert validate_vin("1FTFW1ED4NFB12345") is True

# 2. Build configuration request
veh = VehicleSelection(
    year="2024",
    make="Ford",
    model="F-150",
    bed_size="5.5ft",
    vin="1FTFW1ED4NFB12345"
)

opts = ConfiguratorOptionsSelection(
    side_windows_driver="win_sliders_screen",
    side_toolbox_driver=True, # Will trigger auto-resolution to solid aluminum door
    installation_preference="pro_install_seneca"
)

req = ConfiguratorValidationRequest(
    vehicle=veh,
    model_id="ranch_echo",
    options=opts
)

# 3. Validate and calculate price
res = validate_and_price_configuration(req)
print(f"Model: {res.model_name}")
print(f"Grand Total: ${res.grand_total:,.2f}")
for alert in res.alerts:
    print(f"[{alert.type.upper()}] {alert.message}")
```

---

## 🔒 Security & Privacy

- No hardcoded API keys, private tokens, or proprietary dealer credentials.
- All configuration paths are overrideable via environment variables (`CONFIGURATOR_MASTER_DATA`, `BED_CAP_QUOTES_DIR`).
- Designed for safe integration with public web applications and private ERP backends.

---

## 🤝 Contributing & License

Contributions and pull requests are welcome!

Distributed under the [MIT License](LICENSE).
