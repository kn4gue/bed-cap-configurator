"""
Bed Cap Configurator & Rules Engine
Truck & Bed Cap Compatibility Engine, NHTSA VIN Decoder & Retail Totalizer.
"""

from .vin_validator import validate_vin, infer_vehicle_from_vin
from .rules_engine import get_master_data, get_model_by_id, get_option_by_id, validate_and_price_configuration
from .schemas import (
    VehicleSelection,
    QuoteVehicleSelection,
    ConfiguratorOptionsSelection,
    ConfiguratorValidationRequest,
    ConfiguratorValidationResponse,
    PriceBreakdownItem,
    ValidationRuleAlert,
    CustomerLeadInfo,
    QuoteSubmissionRequest,
    QuoteSubmissionResponse,
)

__version__ = "1.0.0"
__all__ = [
    "validate_vin",
    "infer_vehicle_from_vin",
    "get_master_data",
    "get_model_by_id",
    "get_option_by_id",
    "validate_and_price_configuration",
    "VehicleSelection",
    "QuoteVehicleSelection",
    "ConfiguratorOptionsSelection",
    "ConfiguratorValidationRequest",
    "ConfiguratorValidationResponse",
    "PriceBreakdownItem",
    "ValidationRuleAlert",
    "CustomerLeadInfo",
    "QuoteSubmissionRequest",
    "QuoteSubmissionResponse",
]
