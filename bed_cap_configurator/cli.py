"""
Command-line interface for Bed Cap Configurator
"""
from __future__ import annotations

import argparse
import json
import sys

try:
    from .vin_validator import infer_vehicle_from_vin, validate_vin
    from .rules_engine import get_master_data
except ImportError:
    from vin_validator import infer_vehicle_from_vin, validate_vin
    from rules_engine import get_master_data


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="bed-cap-configurator",
        description="Bed Cap Configurator, Rules Engine & NHTSA VIN Inspector",
    )
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # decode-vin
    p_vin = subparsers.add_parser("decode-vin", help="Decode and validate a 17-character VIN")
    p_vin.add_argument("vin", help="VIN string (e.g. 1FTFW1ED4NFB12345)")

    # catalog
    p_cat = subparsers.add_parser("catalog", help="Inspect loaded models and catalog data")
    p_cat.add_argument("--models-only", action="store_true", help="Print model names and IDs")

    # serve
    p_serve = subparsers.add_parser("serve", help="Run local web server and interactive UI")
    p_serve.add_argument("--host", default="127.0.0.1", help="Host interface (default: 127.0.0.1)")
    p_serve.add_argument("--port", type=int, default=8000, help="Port number (default: 8000)")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    if args.command == "decode-vin":
        res = infer_vehicle_from_vin(args.vin)
        print(json.dumps(res, indent=2))

    elif args.command == "catalog":
        data = get_master_data()
        if args.models_only:
            models = [{"id": m["id"], "name": m["name"], "base_price": m.get("base_retail_price")} for m in data.get("models", [])]
            print(json.dumps(models, indent=2))
        else:
            print(json.dumps(data, indent=2))

    elif args.command == "serve":
        import uvicorn
        try:
            from .app import app
        except ImportError:
            from app import app
        print(f"Starting Bed Cap Configurator on http://{args.host}:{args.port}/ ...")
        uvicorn.run(app, host=args.host, port=args.port)


if __name__ == "__main__":
    main()
