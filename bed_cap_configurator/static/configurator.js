/**
 * Truck Guy Upfitters — Custom LTA Customer Configurator Controller
 */

const API_BASE = (typeof window !== "undefined" && window.LTA_CONFIGURATOR_API_BASE !== undefined)
  ? window.LTA_CONFIGURATOR_API_BASE
  : (typeof window !== "undefined" && (window.location.hostname.includes("shopify") || window.location.hostname.includes("truckguy.pro")) ? "https://parler.cloud" : "");

const ASSET_BASE = (typeof window !== "undefined" && window.LTA_CONFIGURATOR_ASSET_BASE !== undefined)
  ? window.LTA_CONFIGURATOR_ASSET_BASE
  : (typeof window !== "undefined" && (window.location.hostname.includes("shopify") || window.location.hostname.includes("truckguy.pro")) ? "https://parler.cloud/configurator/" : "");

function resolveAssetUrl(relPath) {
  if (!relPath) return "";
  if (relPath.startsWith("http://") || relPath.startsWith("https://") || relPath.startsWith("//")) return relPath;
  
  const cleanRel = relPath.replace(/^\//, "");
  const filename = cleanRel.split("/").pop();

  // If running inside Shopify theme environment with CDN asset base
  if (typeof window !== "undefined" && window.LTA_CONFIGURATOR_ASSET_BASE && (window.LTA_CONFIGURATOR_ASSET_BASE.includes("cdn.shopify") || window.LTA_CONFIGURATOR_ASSET_BASE.includes("/assets/"))) {
    const base = window.LTA_CONFIGURATOR_ASSET_BASE.replace(/\/+$/, "");
    return base + "/" + filename;
  }

  // Standalone / parler.cloud / local server
  const base = (typeof window !== "undefined" && window.LTA_CONFIGURATOR_ASSET_BASE)
    ? window.LTA_CONFIGURATOR_ASSET_BASE.replace(/\/+$/, "")
    : (typeof ASSET_BASE !== "undefined" ? ASSET_BASE.replace(/\/+$/, "") : "");

  return base ? (base + "/" + cleanRel) : cleanRel;
}

// Application State (Defaults to blank/unselected so user actively chooses)
const state = {
  currentStep: 1,
  activeCategory: "all",
  vehicle: {
    year: "",
    make: "",
    model: "",
    bed_size: "",
    cab_style: "Crew Cab",
    tailgate_type: "Standard",
    vin: "",
    paint_code: "",
    paint_name: "",
    custom_paint_code: "",
    paint_hex: "#2A2E33"
  },
  model_id: null,
  options: {
    side_windows_driver: null,
    side_windows_passenger: null,
    front_window: null,
    rear_door: null,
    aluminum_height: null,
    aluminum_side_layout: null,
    aluminum_color: null,
    tonneau_locking: null,
    tonneau_lighting: null,
    tonneau_rack: null,
    keyless_remote: false,
    roof_rack: null,
    carpet_headliner: false,
    led_light_strip: false,
    side_toolbox_driver: false,
    side_toolbox_passenger: false,
    paint_finish: "paint_oem_match",
    installation_preference: null
  },
  customer: {
    name: "",
    email: "",
    phone: "",
    zip: "",
    use: "",
    contact_pref: ""
  },
  catalog: null,
  pricing: null
};

// Tracks whether a submit/continue attempt has occurred on each step
const stepSubmitted = {
  1: false,
  2: false,
  3: false,
  4: false,
  5: false
};

// Persistence Engine: Saves and restores selections across accidental reloads and browser navigation
function saveStateToStorage() {
  try {
    const payload = {
      state: state,
      stepSubmitted: stepSubmitted
    };
    sessionStorage.setItem("lta_configurator_saved_state", JSON.stringify(payload));
    localStorage.setItem("lta_configurator_saved_state", JSON.stringify(payload));
  } catch (e) {
    console.warn("Storage save failed:", e);
  }
}

function restoreStateFromStorage() {
  try {
    const raw = sessionStorage.getItem("lta_configurator_saved_state") || localStorage.getItem("lta_configurator_saved_state");
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.state) return false;

    if (parsed.state.vehicle) Object.assign(state.vehicle, parsed.state.vehicle);
    if (parsed.state.model_id) state.model_id = parsed.state.model_id;
    if (parsed.state.options) Object.assign(state.options, parsed.state.options);
    if (parsed.state.customer) Object.assign(state.customer, parsed.state.customer);
    if (parsed.stepSubmitted) Object.assign(stepSubmitted, parsed.stepSubmitted);
    if (parsed.state.currentStep) state.currentStep = parsed.state.currentStep;

    syncStateToDOM();
    return true;
  } catch (e) {
    console.warn("Storage restore failed:", e);
    return false;
  }
}

function syncStateToDOM() {
  const vehVin = document.getElementById("vehVin");
  const vehMake = document.getElementById("vehMake");
  const vehModel = document.getElementById("vehModel");
  const vehYear = document.getElementById("vehYear");

  if (vehVin && state.vehicle.vin) vehVin.value = state.vehicle.vin;
  if (vehYear && state.vehicle.year) {
    populateYearDropdown(state.vehicle.year);
    vehYear.value = state.vehicle.year;
  }
  if (vehMake && state.vehicle.make) {
    vehMake.value = state.vehicle.make;
    updateModelsDropdown(state.vehicle.make, state.vehicle.model);
  }
  if (state.vehicle.make && state.vehicle.model) {
    updateBedSizesDropdown(state.vehicle.make, state.vehicle.model, state.vehicle.bed_size);
  }

  // Paint swatches matching vehicle
  updateColorSwatches(
    state.vehicle.make || "Ford",
    state.vehicle.model || "F-150",
    state.vehicle.year || "2024",
    state.vehicle.paint_code
  );

  // Customer fields
  const custName = document.getElementById("custName");
  const custEmail = document.getElementById("custEmail");
  const custPhone = document.getElementById("custPhone");
  const custZip = document.getElementById("custZip");
  const custUse = document.getElementById("custUse");
  const custContactPref = document.getElementById("custContactPref");

  if (custName && state.customer.name) custName.value = state.customer.name;
  if (custEmail && state.customer.email) custEmail.value = state.customer.email;
  if (custPhone && state.customer.phone) custPhone.value = state.customer.phone;
  if (custZip && state.customer.zip) custZip.value = state.customer.zip;
  if (custUse && state.customer.use) custUse.value = state.customer.use;
  if (custContactPref && state.customer.contact_pref) custContactPref.value = state.customer.contact_pref;

  // Toggles
  const chkKeyless = document.getElementById("chkKeylessRemote");
  if (chkKeyless) chkKeyless.checked = !!state.options.keyless_remote;
  const chkHeadliner = document.getElementById("chkHeadliner");
  if (chkHeadliner) chkHeadliner.checked = !!state.options.carpet_headliner;
  const chkCargoNet = document.getElementById("chkCargoNet");
  if (chkCargoNet) chkCargoNet.checked = !!state.options.interior_cargo_net;
  const chkUsbFuseBox = document.getElementById("chkUsbFuseBox");
  if (chkUsbFuseBox) chkUsbFuseBox.checked = !!state.options.interior_usb_fuse_box;
  const chkClothesHanger = document.getElementById("chkClothesHanger");
  if (chkClothesHanger) chkClothesHanger.checked = !!state.options.interior_clothes_hanger;
  const chkRodHolder = document.getElementById("chkRodHolder");
  if (chkRodHolder) chkRodHolder.checked = !!state.options.interior_rod_holder;
  const chkHdChopRoof = document.getElementById("chkHdChopRoof");
  if (chkHdChopRoof) chkHdChopRoof.checked = !!state.options.interior_hd_chop_roof;

  // Step pane
  if (state.currentStep >= 1 && state.currentStep <= 5) {
    document.querySelectorAll(".step-btn").forEach((b) => {
      b.classList.toggle("active", parseInt(b.dataset.step, 10) === state.currentStep);
    });
    document.querySelectorAll(".step-pane").forEach((p) => {
      p.classList.remove("active");
    });
    const activePane = document.getElementById(`stepPane${state.currentStep}`);
    if (activePane) activePane.classList.add("active");
  }

  // Banner for bypass
  const banner = document.getElementById("ruleAlertBanner");
  if (banner && (state.vehicle.vin === "TESTING" || state.vehicle.vin === "OVERRIDE")) {
    banner.classList.remove("hidden");
    if (state.vehicle.vin === "OVERRIDE") {
      banner.innerHTML = `<div>⚡ <b>OVERRIDE BYPASS ACTIVE:</b> VIN verification bypassed for override! Vehicle fitment and availability of product cannot be guaranteed.</div>`;
    } else {
      banner.innerHTML = `<div>⚡ <b>TESTING BYPASS ACTIVE:</b> VIN verification bypassed for testing! Ford F-150 (5.5 ft Bed) configured.</div>`;
    }
  }

  renderModels();
  renderOptions();
  updateVisualizer();
  updateSpecsBadge();
  recalculatePrice();
}

// Standard ISO 3779 / US DOT NHTSA Modulo 11 VIN Check-Digit Validator & "TESTING" Bypass
function isValidVIN(vin) {
  if (!vin) return false;
  const clean = vin.trim().toUpperCase();
  if (["TESTING", "TEST", "OVERRIDE", "BYPASS"].includes(clean)) return true;
  if (clean.length !== 17) return false;
  if (/[IOQ]/i.test(clean)) return false; // Prohibited letters
  if (new Set(clean).size <= 2) return false; // Reject repeated characters

  const transliteration = {
    A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
    J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
    S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9
  };
  const weights = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const char = clean[i];
    const val = !isNaN(char) ? parseInt(char, 10) : transliteration[char];
    if (val === undefined) return false;
    sum += val * weights[i];
  }

  const remainder = sum % 11;
  const expectedCheck = remainder === 10 ? "X" : String(remainder);
  return clean[8] === expectedCheck;
}

// Available LTA Models
const LTA_MODELS = [
  {
    id: "venturous_ozark",
    name: "Venturous Ozark",
    brand: "Venturous",
    category: "fiberglass",
    base_price: 3895.0,
    tagline: "Frameless Glass Luxury & Overland Ready",
    desc: "The pinnacle of modern truck cap engineering. Features hidden hinges, frameless all-glass side windows, and automotive single-motion rear slam latch.",
    image: "images/models/venturous_ozark.webp",
    what_you_get: {
      benefits: [
        "Frameless dark tint safety glass with hidden hinges",
        "Single-motion automotive rear slam latch with center lock",
        "Integrated rear aerodynamic spoiler with high-mount CHMSL LED brake light",
        "Interior charcoal carpet headliner included standard"
      ],
      ideal_for: "Luxury truck builds, overlanding, modern full-size pickups, sleek OEM match"
    }
  },
  {
    id: "ranch_echo",
    name: "Ranch Echo",
    brand: "Ranch",
    category: "fiberglass",
    base_price: 2499.0,
    tagline: "Classic Cab-High Design — Everyday Value",
    desc: "America's favorite value cab-high fiberglass cap featuring sliding side windows with pet-guard screens, dual locking T-handles, and 1-year warranty.",
    image: "images/models/ranch_echo.webp",
    what_you_get: {
      benefits: [
        "50/50 sliding side windows with removable pet screens",
        "Heavy-duty framed rear glass door with dual aluminum locking T-handles",
        "Solid front picture window standard (optional drop-down slider upgrade available)",
        "Honeycomb reinforced roof structure with roof rack compatibility",
        "Custom molded fiberglass skirt covering truck bed rails",
        "High-quality factory OEM color match",
        "1-Year Limited Warranty"
      ],
      ideal_for: "Daily work, pet owners, general truck bed protection, best value"
    }
  },
  {
    id: "ranch_icon",
    name: "Ranch Icon",
    brand: "Ranch",
    category: "fiberglass",
    base_price: 3895.0,
    tagline: "Frameless All-Glass Luxury — Flagship Cab-High",
    desc: "Ranch's flagship fiberglass cap with frameless tip-out side windows, frameless all-glass rear door with single center handle, remote keyless entry compatibility, and standard carpet headliner.",
    image: "images/models/ranch_icon.webp",
    what_you_get: {
      benefits: [
        "Frameless all-glass rear door with single center handle (Keyless Remote Entry compatible)",
        "Frameless tip-out side windows with removable screens",
        "Choice of solid or sliding front window standard (optional drop-down slider upgrade available)",
        "Carpeted interior headliner included standard",
        "Choice of 12V wired or battery-operated interior LED dome light included standard",
        "Dark tinted safety glass standard",
        "High-quality Axalta paint-to-match finish standard",
        "Attention-getting LED brake light & custom-fit rear door skirt",
        "Thick honeycomb reinforced roof (choice of painted trim or trimless edge)",
        "Limited Lifetime Warranty on paint and structure"
      ],
      ideal_for: "Top-tier luxury styling, pet comfort, maximum factory inclusions"
    }
  },
  {
    id: "ranch_sierra",
    name: "Ranch Sierra",
    brand: "Ranch",
    category: "fiberglass",
    base_price: 2795.0,
    tagline: "Cab-High Classic with Lifetime Warranty",
    desc: "The Lifetime Warranty version of the Echo. Features the identical dependable cab-high fiberglass shell and sliding side windows, upgraded with full Lifetime Paint & Structural Warranty protection.",
    image: "images/models/ranch_echo.webp",
    what_you_get: {
      benefits: [
        "Limited Lifetime Warranty on Paint and Structure",
        "50/50 sliding side windows with removable pet screens",
        "Heavy-duty framed rear glass door with dual locking T-handles",
        "Solid front picture window standard (optional drop-down slider upgrade available)",
        "Honeycomb reinforced roof structure capable of carrying cargo racks",
        "High-quality factory OEM color match"
      ],
      ideal_for: "Long-term truck owners wanting the classic Echo design with lifetime warranty peace of mind"
    }
  },
  {
    id: "ranch_fusion",
    name: "Ranch Fusion",
    brand: "Ranch",
    category: "fiberglass",
    base_price: 3295.0,
    tagline: "Frameless All-Glass Rear Door with Side Sliders",
    desc: "Combines side sliding windows for pets and airflow with a sleek single-handle frameless all-glass rear door (remote keyless entry compatible), carpet headliner, and Axalta paint standard.",
    image: "images/models/ranch_echo.webp",
    what_you_get: {
      benefits: [
        "Frameless all-glass rear door with single center handle (Keyless Remote Entry compatible)",
        "50/50 side sliding windows with removable mesh screens",
        "Choice of solid or sliding front window standard (optional drop-down slider upgrade available)",
        "Carpeted interior headliner included standard",
        "Choice of 12V wired or battery-operated interior LED dome light standard",
        "Dark tinted safety glass standard",
        "Highest quality Axalta paint-to-match finish standard",
        "Attention-getting LED brake light & custom-fit rear door skirt",
        "Thick honeycomb reinforced roof (choice of painted trim or trimless edge)",
        "Limited Lifetime Warranty on paint and structure"
      ],
      ideal_for: "Dog owners, hunters, and overland builds wanting sliding ventilation with single-handle frameless glass security"
    }
  },
  {
    id: "ranch_sierra_xtra",
    name: "Ranch Sierra Xtra",
    brand: "Ranch",
    category: "fiberglass",
    base_price: 2995.0,
    tagline: "Upgraded Cab-High with Headliner & Dome Light Standard",
    desc: "Upgraded cab-high fiberglass cap based on the Echo shell that includes carpeted headliner, 12V or battery interior dome light, and Lifetime Warranty standard.",
    image: "images/models/ranch_echo.webp",
    what_you_get: {
      benefits: [
        "Carpeted interior headliner included standard",
        "Choice of 12V wired or battery-operated interior LED dome light included standard",
        "Limited Lifetime Warranty on Paint and Structure",
        "50/50 sliding side windows with removable pet screens",
        "Heavy-duty framed rear glass door with dual locking T-handles",
        "Solid front picture window standard (optional drop-down slider upgrade available)",
        "Honeycomb reinforced roof structure",
        "High-quality factory OEM color match"
      ],
      ideal_for: "Truck owners wanting a turn-key cab-high cap with interior headliner, lighting, and lifetime warranty"
    }
  },
  {
    id: "ranch_workforce",
    name: "Ranch WorkForce Commercial Fiberglass",
    brand: "Ranch",
    category: "commercial",
    base_price: 3595.0,
    tagline: "Commercial Fiberglass Shell with Reinforced Side Access",
    desc: "Heavy-duty commercial fiberglass cap featuring reinforced solid fiberglass side access doors, aluminum panel rear door, and available 600 lb roof rating.",
    image: "images/models/workforce_commercial.webp",
    what_you_get: {
      benefits: [
        "Reinforced fiberglass side access doors with folding T-handles",
        "Aluminum-framed panel rear half door with folding T-handle",
        "250 lb standard roof load capacity (optional 600 lb heavy-duty package)",
        "Optional internal commercial toolboxes with divider packages",
        "High-quality OEM paint-to-match finish standard",
        "Commercial-grade structural reinforcement"
      ],
      ideal_for: "Contractors, mobile technicians, fleet service, tradesmen requiring side tool access"
    }
  },
  {
    id: "ranch_skyline",
    name: "Ranch Skyline",
    brand: "Ranch",
    category: "fiberglass",
    base_price: 3195.0,
    tagline: "Mid-Rise Aerodynamic Wedge (+4\" to +5\" Extra Headroom)",
    desc: "Aerodynamic raised-roof wedge fiberglass cap providing 4-5 inches of additional vertical clearance above the cab for camping, hunting kennels, and oversized cargo.",
    image: "images/models/ranch_sierra_xtra.webp",
    what_you_get: {
      benefits: [
        "Aerodynamic mid-rise wedge profile gives extra 4-5\" cargo & sleeping height",
        "Dual locking T-handles on the rear door standard",
        "Oversized side sliding windows with screens for maximum airflow",
        "Dark tinted safety glass standard",
        "High-quality paint-to-match finish standard (included at no upcharge)",
        "Honeycomb reinforced roof structure",
        "Limited Lifetime Warranty on Paint and Structure"
      ],
      ideal_for: "Truck camping, tall cargo, hunting dogs, ATVs, walk-in cargo accessibility"
    }
  },
  {
    id: "ranch_fusion_classic",
    name: "Ranch Fusion Classic",
    brand: "Ranch",
    category: "fiberglass",
    base_price: 3295.0,
    tagline: "Side Sliders & All-Glass Door with Exterior Hinges",
    desc: "All Fusion features with an exterior hinge rear door configuration tailored for older model generation trucks.",
    image: "images/models/ranch_echo.webp",
    what_you_get: {
      benefits: [
        "Exterior hinge rear door configuration for older generation pickups",
        "50/50 side sliding windows with removable mesh screens",
        "Remote Keyless Entry compatible",
        "Carpeted interior headliner included standard",
        "Choice of 12V wired or battery dome light standard",
        "Axalta paint-to-match finish standard",
        "Limited Lifetime Warranty on paint and structure"
      ],
      ideal_for: "Classic generation trucks wanting side sliding windows and all-glass rear door styling"
    }
  },
  {
    id: "ranch_icon_premier",
    name: "Ranch Icon Premier",
    brand: "Ranch",
    category: "fiberglass",
    base_price: 3895.0,
    tagline: "Frameless Glass Luxury with Exterior Hinge Rear Door",
    desc: "All flagship Icon features equipped with an exterior hinge rear door tailored for older model generation trucks.",
    image: "images/models/ranch_icon.webp",
    what_you_get: {
      benefits: [
        "Exterior hinge rear door configuration for older generation pickups",
        "Frameless tip-out side windows with removable screens",
        "Remote Keyless Entry compatible",
        "Carpeted interior headliner standard",
        "Choice of 12V wired or battery interior LED dome light standard",
        "Axalta paint-to-match finish standard",
        "Attention-getting LED brake light",
        "Limited Lifetime Warranty on paint and structure"
      ],
      ideal_for: "Classic & older generation trucks wanting modern frameless glass luxury"
    }
  },
  {
    id: "ranch_legacy_lid",
    name: "Ranch Legacy Tonneau Cover",
    brand: "Ranch",
    category: "lid",
    base_price: 1995.0,
    tagline: "Premium Painted Hard Tonneau with Carpet Headliner",
    desc: "Custom-molded wrap-over fiberglass hard tonneau cover with carpeted headliner, 1200 lb rotary latches, and EZ-push logo lock.",
    image: "images/models/ranch_fusion_lid.webp",
    what_you_get: {
      benefits: [
        "1,200 lb tested rotary latches with dual steel underside locking rods",
        "Carpeted headliner (made from recycled plastic) included standard",
        "High-quality OEM factory paint-to-match finish standard",
        "Black powder-coated hardware & exterior style line",
        "EZ push logo center lock",
        "Front piano hinge & interior pull-down strap",
        "Lift assist arms (heavy-duty gas struts)",
        "No-drill clamp installation",
        "Tri-Cel honeycomb reinforced roof",
        "Trimless skirted edges, wrap-over side and rear edges",
        "Limited Lifetime Warranty on Paint and Structure"
      ],
      ideal_for: "Sleek aerodynamic styling, secure weatherproof dry storage, luxury truck bed finish"
    }
  },
  {
    id: "ranch_sportwrap_lid",
    name: "Ranch SportWrap Tonneau Cover",
    brand: "Ranch",
    category: "lid",
    base_price: 1845.0,
    tagline: "Low-Profile Smooth Top Painted Hard Tonneau",
    desc: "Low-profile smooth top fiberglass hard tonneau cover with 1200 lb rotary latches and wrap-over protection (without carpet headliner).",
    image: "images/models/ranch_fusion_lid.webp",
    what_you_get: {
      benefits: [
        "Low-profile smooth top fiberglass construction (no carpet headliner)",
        "1,200 lb tested rotary latches with dual steel locking rods",
        "High-quality OEM factory paint-to-match finish standard",
        "Black powder-coated hardware & EZ push logo lock",
        "Front piano hinge & interior pull-down strap",
        "Lift assist arms (heavy-duty gas struts)",
        "No-drill clamp installation",
        "Tri-Cel honeycomb reinforced structure",
        "Trimless skirted wrap-over edges",
        "Limited Lifetime Warranty on Paint and Structure"
      ],
      ideal_for: "Sport truck styling, high-durability bare underside, secure weatherproof bed protection"
    }
  },
  {
    id: "ranch_pro_series",
    name: "Ranch Pro Series Commercial Aluminum",
    brand: "Ranch",
    category: "aluminum",
    base_price: 2895.0,
    tagline: "Heavy-Duty .040 Welded Commercial Aluminum Shell",
    desc: "Built for tough commercial contractor duty with .040 gauge aluminum skin, heavy-duty TIG-welded aluminum frame, Strattec OEM lock cylinders, and protective inner liners on all doors.",
    image: "images/models/swiss_heavy_duty.webp",
    what_you_get: {
      benefits: [
        "Heavy duty .040 gauge aluminum skin on sides, front, and back",
        "Heavy-duty TIG-welded aluminum framework with structural mounting rails",
        "Folding T-handle with 3-point lock rods",
        "Strattec OEM automotive-grade lock cylinders",
        "Gas-operated door props on all lift-up access doors",
        "Marine-grade quality chrome hinges on all full rear doors",
        "Sealed LED third brake light",
        "Black trim",
        "Front and side cab-matched slant angles to match your truck cab",
        "Protective inner liner on side doors and full rear doors"
      ],
      ideal_for: "General contractors, commercial fleets, mobile workshops, heavy-duty utility"
    }
  },
  {
    id: "swiss_heavy_duty",
    name: "Swiss Heavy Duty Commercial",
    brand: "Swiss",
    category: "aluminum",
    base_price: 2495.0,
    tagline: "Flagship Heavy Fleet Aluminum Topper",
    desc: "The gold standard in commercial fleet truck caps. Welded heavy aluminum construction with customizable heights, toolboxes, and walk-in doors.",
    image: "images/models/swiss_heavy_duty.webp",
    what_you_get: {
      benefits: [
        "Heavy-duty .080 commercial framework with reinforced gusseted stress points",
        "Full-length solid utility doors with gas struts and 3-point lock rods",
        "Available internal galvanized toolboxes with shelving and parts dividers",
        "Double walk-in rear doors standard"
      ],
      ideal_for: "Heavy contractor fleets, service body upfits, extreme commercial duty"
    }
  },
  {
    id: "unicover_heavy_duty",
    name: "Unicover Heavy Duty Commercial",
    brand: "Unicover",
    category: "aluminum",
    base_price: 2195.0,
    tagline: "Welded .080 Commercial Contractor Shell",
    desc: "Heavy-duty commercial contractor cap featuring .080 welded structural aluminum framework, solid utility doors, and full ladder rack support.",
    image: "images/models/unicover_heavy_duty.webp",
    what_you_get: {
      benefits: [
        "0.080 welded structural aluminum framework with heavy roof bows",
        "Solid lift-up side access utility doors with folding T-handle locks",
        "Solid front wall or picture window with heavy-duty double rear doors",
        "500+ lb commercial roof load capacity"
      ],
      ideal_for: "Contractors, plumbers, electricians, commercial trades, fleet utility"
    }
  },
  {
    id: "unicover_light_duty",
    name: "Unicover Light Duty Aluminum",
    brand: "Unicover",
    category: "aluminum",
    base_price: 1495.0,
    tagline: "Lightweight Everyday Utility & Recreational Cap",
    desc: "Lightweight aluminum framework with #100 sliding windows and smooth weatherproof aluminum skin for everyday hauling.",
    image: "images/models/unicover_light_duty.webp",
    what_you_get: {
      benefits: [
        "Lightweight high-strength aluminum frame (easy on-and-off bed removal)",
        "#100 50/50 horizontal sliding side windows with fine mesh pet screens",
        "Rear lift-up door with center locking T-handle",
        "Factory smooth .035 white or black skin finish"
      ],
      ideal_for: "Weekend camping, DIYers, everyday bed weatherproofing, best price entry"
    }
  }
];

// Available Options Catalog with Authentic Media & Specifications
const OPTIONS_CATALOG = {
  tonneau_locking: [
    {
      id: "tonneau_rotary_standard",
      name: "Center Rotary Key Lock System",
      price: 0,
      image: "images/models/ranch_fusion_lid.webp",
      desc: "Heavy-duty center keyed rotary lock with dual underside steel locking rods and weatherproof key cover.",
      what_you_get: {
        benefits: ["Dual underside heavy steel rotary locking rods", "Weather-tight rubber keyhole seal", "Standard included locking package"],
        ideal_for: "Dependable, secure manual bed protection"
      }
    },
    {
      id: "tonneau_keyless_remote_sync",
      name: "Sync Lock with Truck Key Fob (OEM Keyless Entry)",
      price: 245,
      image: "images/options/rear_keyless_actuator.webp",
      desc: "Integrated 12V motorized solenoid actuator wired directly to vehicle power lock harness. Automatically locks and unlocks your tonneau cover with factory truck key fob. Increases shop install labor by $120 for dedicated 12V actuator harness wiring.",
      what_you_get: {
        benefits: ["Single click lock/unlock with your existing truck key fob", "Dedicated 12V actuator harness wiring integration (+$120 install labor)", "Preserves manual key backup"],
        ideal_for: "Effortless daily convenience, grocery runs, maximum security"
      }
    }
  ],
  tonneau_lighting: [
    {
      id: "tonneau_light_standard_dome",
      name: "12V / Battery LED Interior Dome Light",
      price: 0,
      image: "images/models/ranch_fusion_lid.webp",
      desc: "Center-mounted bright LED dome light for cargo bed visibility.",
      what_you_get: {
        benefits: ["Immediate bed illumination when opening", "Standard included fixture"],
        ideal_for: "Nighttime bed cargo loading"
      }
    },
    {
      id: "tonneau_light_undercover_strip",
      name: "Full Underside 48\" LED Strip Lighting System",
      price: 125,
      image: "images/options/light_48_strip.webp",
      desc: "Ultra-bright 48-inch waterproof silicone LED light tube mounted along the center underside with magnetic pin switch.",
      what_you_get: {
        benefits: ["Floods entire truck bed with bright white light", "Automatic magnetic pin switch turns light on when opened"],
        ideal_for: "Dark campgrounds, job sites, equipment retrieval"
      }
    }
  ],
  tonneau_racks: [
    {
      id: "tonneau_rack_none",
      name: "No Top Racks (Smooth Aerodynamic Lid)",
      price: 0,
      image: "images/models/ranch_fusion_lid.webp",
      desc: "Clean low-profile flush painted fiberglass surface for maximum highway fuel economy.",
      what_you_get: {
        benefits: ["Sleek low-profile styling", "Zero wind drag", "Standard included layout"],
        ideal_for: "Sport truck styling, daily driving"
      }
    },
    {
      id: "tonneau_rack_rhino_vortex",
      name: "Rhino-Rack Vortex Low-Profile Tonneau Crossbars",
      price: 495,
      image: "images/options/rack_rhino_vortex.webp",
      desc: "Roof tracks with low-profile Vortex aero crossbars mounted directly on the fiberglass lid (supports bikes, snowboards, ski racks).",
      what_you_get: {
        benefits: ["Carries mountain bikes, roof boxes, and cargo baskets above the tonneau", "Removable locking legs"],
        ideal_for: "Outdoor adventure builds, bike racks, ski trips"
      }
    }
  ],
  aluminum_heights: [
    {
      id: "height_21_compact",
      name: "21 in. Cab High Compact",
      price: 0,
      image: "images/models/unicover_light_duty.webp",
      desc: "Flush cab-height aluminum roof profile for midsize / compact trucks (Tacoma, Ranger, Colorado, Frontier).",
      what_you_get: {
        benefits: ["Matches exact truck cab height", "Aerodynamic garage clearance", "Standard included feature"],
        ideal_for: "Midsize / compact trucks (Tacoma, Ranger, Colorado, Frontier)"
      }
    },
    {
      id: "height_20_24_bilevel_compact",
      name: "20-24 in. Bi-Level Wedge Compact",
      price: 225,
      image: "images/models/ranch_sierra_xtra.webp",
      desc: "Aerodynamic stepped wedge profile providing additional vertical clearance at the rear.",
      what_you_get: {
        benefits: ["Adds +4\" vertical clearance in the rear", "Stepped roof slope for easy loading", "Welded cross bows"],
        ideal_for: "Taller gear, kennels, and camping headroom in midsize trucks"
      }
    },
    {
      id: "height_24_compact",
      name: "24 in. Mid-Rise Compact",
      price: 195,
      image: "images/models/ranch_sierra_xtra.webp",
      desc: "Uniform 24 inch height for midsize trucks.",
      what_you_get: {
        benefits: ["Extra headroom across full bed length", "Heavy aluminum perimeter framing"],
        ideal_for: "Midsize trucks requiring extra height"
      }
    },
    {
      id: "height_24_cab_high_full",
      name: "24 in. Cab High Full Size",
      price: 0,
      image: "images/models/unicover_light_duty.webp",
      desc: "Standard cab-height roof profile for full-size pickups (F-150, Silverado, Ram, Tundra, Super Duty).",
      what_you_get: {
        benefits: ["Matches full-size truck cab roofline", "Standard included configuration", "Clean OEM profile"],
        ideal_for: "Full-size trucks (F-150, Silverado, Ram, Tundra, Super Duty)"
      }
    },
    {
      id: "height_24_30_bilevel_full",
      name: "24-30 in. Bi-Level Wedge Full Size",
      price: 285,
      image: "images/models/ranch_sierra_xtra.webp",
      desc: "Stepped aerodynamic roofline adding up to 6 inches of vertical rear clearance.",
      what_you_get: {
        benefits: ["Adds up to 6\" vertical clearance", "Taller rear door opening for walk-in utility"],
        ideal_for: "Commercial ladders, compressors, walk-in cargo loading"
      }
    },
    {
      id: "height_30_compact",
      name: "30 in. High Compact",
      price: 345,
      image: "images/models/unicover_heavy_duty.webp",
      desc: "Maximum 30 inch commercial cargo headroom for midsize pickups.",
      what_you_get: {
        benefits: ["Maximum commercial volume in a compact truck", "Welded heavy aluminum framework"],
        ideal_for: "Contractors with compact service trucks"
      }
    },
    {
      id: "height_30_high_full",
      name: "30 in. High Full Size",
      price: 395,
      image: "images/models/swiss_heavy_duty.webp",
      desc: "Maximum 30 inch commercial walk-in cargo headroom for full-size fleet trucks.",
      what_you_get: {
        benefits: ["Massive cargo volume", "Taller double rear walk-in doors", "Heavy-duty commercial roof bows"],
        ideal_for: "Commercial trades, plumbers, electricians, mobile service shops"
      }
    }
  ],
  aluminum_side_windows: [
    {
      id: "win_alum_100_sliding",
      name: "#100 - Sliding Window Only",
      price: 0,
      image: "images/options/win_sliders_screen.webp",
      desc: "Standard 50/50 horizontal sliding glass window with removable fine mesh pet screen.",
      what_you_get: {
        benefits: ["Continuous airflow and cross-ventilation", "Removable pet/insect screen", "Standard included layout"],
        ideal_for: "Recreational utility, pets, daily ventilation"
      }
    },
    {
      id: "win_alum_400_stationary_sliding",
      name: "#400 - Stationary Glass w/ Side Sliding Window",
      price: 165,
      image: "images/options/win_sliders_screen.webp",
      desc: "Front stationary glass panel combined with rear sliding window section.",
      what_you_get: {
        benefits: ["Front sealed window + rear sliding section", "Dark tint safety glass"],
        ideal_for: "Versatile ventilation with forward splash protection"
      }
    },
    {
      id: "win_alum_600_radius_sliding",
      name: "#600 - Radius Side Sliding Window",
      price: 145,
      image: "images/options/win_sliders_screen.webp",
      desc: "Curved radius corner sliding window with automotive tinted glass and screen.",
      what_you_get: {
        benefits: ["Curved radius corners matching truck contours", "Sliding ventilation panel"],
        ideal_for: "Clean rounded styling"
      }
    },
    {
      id: "win_alum_800_utility_sliding",
      name: "#800 - 44\" Utility Door With Sliding Window",
      price: 295,
      image: "images/options/win_windoor_sliding_screen.webp",
      desc: "Solid aluminum lift-up utility access door with integrated sliding center window.",
      what_you_get: {
        benefits: ["Lift-up door for side cargo reach", "Built-in sliding pet window with screen", "Dual folding T-locks"],
        ideal_for: "Dual-use work & adventure builds"
      }
    },
    {
      id: "win_alum_900_utility_56",
      name: "#900 - 56\" Utility Doors Centered (Shop Top)",
      price: 245,
      image: "images/options/win_solid_alum_door.webp",
      desc: "56 inch full-access solid aluminum lift-up utility door with gas props and dual T-locks.",
      what_you_get: {
        benefits: ["Full-length side access", "Zero breakable glass", "Heavy gas lift struts"],
        ideal_for: "Commercial trades, toolboxes, high security"
      }
    },
    {
      id: "win_alum_1000_quad_utility",
      name: "#1000 - (4) 44\" Quad Utility Doors (8 ft. Bed Only)",
      price: 495,
      image: "images/options/win_solid_alum_door.webp",
      desc: "Dual 44 inch lift-up utility doors on each side for maximum compartmentalization (8 ft beds only).",
      what_you_get: {
        benefits: ["Independent front and rear side access doors", "Designed specifically for 8ft service beds"],
        ideal_for: "8 ft service bodies, fleet contractors"
      }
    },
    {
      id: "win_alum_1100_stationary_sliding_stationary",
      name: "#1100 - Stationary Glass - Sliding Window - Stationary Glass",
      price: 225,
      image: "images/options/win_sliders_screen.webp",
      desc: "Triple panoramic window layout with center sliding window.",
      what_you_get: {
        benefits: ["Full length glass visibility", "Center sliding ventilation section"],
        ideal_for: "Maximum side daylight and visibility"
      }
    },
    {
      id: "win_alum_1200_stationary_52",
      name: "#1200 - 52\" Stationary Window",
      price: 75,
      image: "images/options/front_picture_solid.webp",
      desc: "52 inch fixed dark tint stationary picture glass window.",
      what_you_get: {
        benefits: ["Solid airtight weather sealing", "Panoramic dark tint picture glass"],
        ideal_for: "Dry weather cargo protection"
      }
    },
    {
      id: "win_alum_no_window",
      name: "No Side Window (Solid Smooth Aluminum)",
      price: 0,
      image: "images/options/win_solid_alum_door.webp",
      desc: "Solid continuous aluminum side panel for maximum security and internal toolbox protection.",
      what_you_get: {
        benefits: ["100% smash-and-grab theft prevention", "Continuous clean aluminum side skin"],
        ideal_for: "Maximum tool security, fleet service bodies"
      }
    }
  ],
  aluminum_colors: [
    { id: "alum_white", name: "White (.035 Smooth Fleet White)", price: 0, image: "images/models/unicover_light_duty.webp", desc: "Factory standard commercial fleet smooth white aluminum skin." },
    { id: "alum_black", name: "Black (.035 Smooth Gloss Black)", price: 0, image: "images/models/swiss_heavy_duty.webp", desc: "Factory smooth gloss black aluminum finish." },
    { id: "alum_dark_gray", name: "Dark Gray (.035 Metallic Charcoal)", price: 125, image: "images/models/swiss_heavy_duty.webp", desc: "Charcoal metallic coated aluminum skin." },
    { id: "alum_light_silver", name: "Light Silver (.035 Silver Metallic)", price: 125, image: "images/models/unicover_light_duty.webp", desc: "Bright silver metallic coated skin." },
    { id: "alum_candy_red", name: "Candy Apple Red", price: 195, image: "images/models/ranch_sierra_xtra.webp", desc: "High gloss candy apple red finish." },
    { id: "alum_custom", name: "Custom OEM Paint Match", price: 345, image: "images/models/venturous_ozark.webp", desc: "Custom factory automotive basecoat/clearcoat color match." }
  ],
  side_windows: [
    {
      id: "win_sliders_screen",
      name: "50/50 Sliding Windows with Pet Screen",
      tier: "bronze",
      price: 0,
      image: "images/options/win_sliders_screen.webp",
      desc: "America's classic truck cap side window featuring a recessed aluminum frame, 50/50 sliding tinted glass, and heavy-duty pet screen.",
      what_you_get: {
        benefits: [
          "Recessed aluminum frame prevents snagging and water pooling",
          "Removable fine-mesh insect & pet safety screen",
          "Interior rotary thumb-turn latches for secure locking"
        ],
        ideal_for: "Pets, hunting dogs, daily airflow, and standard cargo protection"
      }
    },
    {
      id: "win_solid_fixed_glass",
      name: "Solid Tinted Fixed Picture Window",
      price: 0,
      image: "images/options/front_picture_solid.webp",
      desc: "Fixed non-opening dark tint tempered safety glass mounted in a weatherproof aluminum frame.",
      what_you_get: {
        benefits: [
          "Maximum airtight and watertight weather sealing with zero moving parts",
          "Dark factory tint for interior cargo privacy",
          "Sleek clean profile"
        ],
        ideal_for: "Maximum weather protection, gear hauling, dry bed storage"
      }
    },
    {
      id: "win_windoor_glass",
      name: "Solid Glass Flip-Up Windoor (Dual T-Handles)",
      tier: "silver",
      price: 285,
      image: "images/options/win_windoor_glass.webp",
      desc: "Full-length flip-up dark tint tempered glass on dual pressurized nitrogen gas struts for effortless bed side access.",
      what_you_get: {
        benefits: [
          "Lifts 90-degrees open on dual heavy-duty gas struts",
          "Dual keyed rotary T-handle locks with weather-tight compression bulb seal",
          "Effortless access to reach tools and gear near the front of the bed"
        ],
        ideal_for: "Easy cargo access, overlanding builds, grocery & cooler retrieval"
      }
    },
    {
      id: "win_windoor_sliding_screen",
      name: "Vented Flip-Up Windoor w/ Sliding Window & Screen",
      tier: "gold",
      price: 345,
      image: "images/options/win_windoor_sliding_screen.webp",
      desc: "Combines full flip-up side bed access on gas struts with an integrated 50/50 sliding window and fine mesh pet screen inside the lift door.",
      what_you_get: {
        benefits: [
          "Full flip-up side opening on dual gas struts for total bed reach",
          "Built-in sliding pet window with fine mesh ventilation screen",
          "Dual keyed rotary folding T-handles"
        ],
        ideal_for: "The ultimate combo: pet ventilation + full roadside cargo access"
      }
    },
    {
      id: "win_solid_fiberglass_no_window",
      name: "Solid Fiberglass Side (No Window)",
      price: -30,
      image: "images/models/workforce_commercial.webp",
      desc: "Delete side window opening for a seamless, solid painted fiberglass side wall. Saves $30.00 each.",
      what_you_get: {
        benefits: [
          "Saves $30.00 per side ($60.00 total savings when chosen for both sides)",
          "100% smash-and-grab theft prevention — zero breakable side glass",
          "Solid continuous seamless fiberglass construction",
          "Maximum interior privacy for tools and expensive cargo"
        ],
        ideal_for: "Contractors, tradesmen, mobile tool security, theft prevention, maximum privacy"
      }
    },
    {
      id: "win_solid_aluminum_door",
      name: "Solid Commercial Lift-Up Door (WorkForce Only)",
      price: 320,
      image: "images/options/win_solid_alum_door.webp",
      desc: "Commercial welded aluminum lift-up door with full-length stainless steel hinge and dual mechanical lock rods.",
      what_you_get: {
        benefits: [
          "100% smash-and-grab theft prevention — zero breakable glass",
          "Full-length stainless steel continuous hinge",
          "Required for commercial internal side toolboxes"
        ],
        ideal_for: "Contractors, plumbers, electricians, commercial trades, high-theft security"
      }
    }
  ],
  front_windows: [
    {
      id: "front_picture_solid",
      name: "Front Picture Window",
      price: 0,
      image: "images/options/front_picture_solid.webp",
      desc: "Standard fixed clear tempered safety glass bonded directly facing the truck cab.",
      what_you_get: {
        benefits: [
          "Clear unobstructed rearview mirror sightline into truck cab",
          "Factory weatherproof compression seal against weather & dust",
          "Standard included feature on all models"
        ],
        ideal_for: "Daily driving, standard truck cap utility, clear rear view"
      }
    },
    {
      id: "front_drop_down_picture",
      name: "Front Drop Down Picture",
      tier: "bronze",
      price: 95,
      image: "images/options/front_drop_down_picture.webp",
      desc: "Solid picture window that hinges smoothly down into the bed with quick-release thumb latches for effortless cab and cap glass cleaning.",
      what_you_get: {
        benefits: [
          "Hinges open down into bed for effortless washing of cab & cap glass",
          "Full clear picture window visibility without slider vertical bars",
          "Quick-release heavy-duty mechanical thumb latch locks"
        ],
        ideal_for: "Truck owners who wash their vehicles and want an unobstructed rear view"
      }
    },
    {
      id: "front_solid_fiberglass",
      name: "Front Solid Fiberglass (No Window)",
      price: 0,
      image: "images/models/workforce_commercial.webp",
      desc: "Delete the front glass opening for a solid, continuous painted fiberglass bulkhead facing the cab. Maximum privacy and theft deterrence.",
      what_you_get: {
        benefits: [
          "Zero breakable glass facing the cab for 100% theft protection",
          "Solid continuous fiberglass bulkhead construction",
          "Maximum cargo privacy for valuable tools and gear"
        ],
        ideal_for: "Contractors, tradesmen, tool storage security, high-theft prevention"
      }
    },
    {
      id: "front_sliding_window",
      name: "Front Sliding Window",
      tier: "silver",
      price: 75,
      image: "images/options/front_sliding_window.webp",
      desc: "Fixed front window frame featuring a 50/50 center sliding glass pass-through vent facing the truck cab.",
      what_you_get: {
        benefits: [
          "Center sliding pass-through window for cab-to-bed ventilation",
          "Allows pass-through access for pets and long cargo items",
          "Secure interior thumb-lock latch"
        ],
        ideal_for: "Pet owners, airflow ventilation, passing long items into the cab"
      }
    },
    {
      id: "front_drop_down_slider",
      name: "Front Drop Down Slider",
      tier: "gold",
      price: 145,
      image: "images/options/front_drop_down_slider.webp",
      desc: "Combines a center sliding pass-through window with a hinged drop-down frame that tilts down into the bed for easy cab glass cleaning.",
      what_you_get: {
        benefits: [
          "Hinges open down into the bed for easy cab & cap glass washing",
          "Center sliding pass-through window for airflow & pet comfort",
          "Dual quick-release mechanical thumb latches"
        ],
        ideal_for: "The ultimate front window: easy cleaning + pass-through ventilation"
      }
    },
    {
      id: "front_cutout_hole",
      name: "Front Cutout Hole Only",
      price: 0,
      image: "images/models/workforce_commercial.webp",
      desc: "Open front bulkhead cutout designed for direct compression accordion boot seal pass-through between truck cab and cap.",
      what_you_get: {
        benefits: [
          "Open framed pass-through opening between truck cab and topper",
          "Allows installation of accordion rubber boot seal",
          "Direct unobstructed reach from cab into truck bed"
        ],
        ideal_for: "Camper conversions, pass-through sleeper setups, commercial fleet walk-throughs"
      }
    }
  ],
  rear_doors: [
    {
      id: "rear_framed_dual_t",
      name: "Heavy-Duty Framed Glass Door (Dual T-Locks)",
      tier: "silver",
      price: 0,
      image: "images/options/rear_framed_thandled.webp",
      desc: "Extruded aluminum framed safety glass with dual metal rotary T-handles and heavy mechanical locking rods.",
      what_you_get: {
        benefits: [
          "Dual mechanical locking rods engage both truck bed sides",
          "Heavy-duty aluminum perimeter frame for extreme durability",
          "Included standard on Ranch Echo, Sierra & Fusion"
        ],
        ideal_for: "Daily work, trades, fleets, rugged reliability"
      }
    },
    {
      id: "rear_frameless_slam_latch",
      name: "Frameless All-Glass Slam-Latch Door",
      tier: "gold",
      price: 325,
      image: "images/options/rear_frameless_slam.webp",
      desc: "Curved automotive dark tint glass with center single-motion automotive slam latch and rotary release.",
      what_you_get: {
        benefits: [
          "Single-hand automotive slam-to-shut operation",
          "Edge-to-edge frameless dark tint glass matching OEM aesthetic",
          "Integrated teardrop handle with push-button lock"
        ],
        ideal_for: "Modern luxury trucks, fast single-hand cargo access"
      }
    },
    {
      id: "rear_commercial_double",
      name: "Solid Aluminum Double Walk-In Cargo Doors",
      price: 495,
      image: "images/options/rear_commercial_double.webp",
      desc: "Heavy commercial 50/50 split double aluminum rear doors with stainless steel locking bar mechanism and optional security mesh.",
      what_you_get: {
        benefits: [
          "Walk-in entry without bending down under a lift hatch",
          "Heavy-gauge 3-point mechanical padlock hasp / cam lock",
          "Eliminates truck tailgate for full flat-floor step-in"
        ],
        ideal_for: "Service bodies, delivery vans, commercial contractors, electricians"
      }
    }
  ],
  roof_reinforcement: [
    {
      id: "roof_standard_honeycomb",
      name: "Standard Honeycomb Reinforced Roof",
      tier: "silver",
      price: 0,
      image: "images/options/roof_heavy_reinforce.webp",
      desc: "Reinforced honeycomb core embedded within the multi-layer fiberglass shell, rated for 150 lbs dynamic load.",
      what_you_get: {
        benefits: [
          "Multi-layer structural fiberglass matrix",
          "Rated for 150 lbs dynamic / 350 lbs static weight",
          "Included standard on all models"
        ],
        ideal_for: "Standard cargo carriers, skis, bikes, fishing poles"
      }
    },
    {
      id: "roof_heavy_commercial",
      name: "Commercial Heavy-Duty Internal Skeleton (500+ lbs Dynamic)",
      tier: "gold",
      price: 295,
      image: "images/options/roof_heavy_reinforce.webp",
      desc: "Internal structural steel/aluminum load-bearing skeleton transferring weight directly to the truck bed rails, carrying 500+ lbs dynamic and 800+ lbs static.",
      what_you_get: {
        benefits: [
          "500+ lbs dynamic load rating / 800+ lbs static rating",
          "Weight transferred straight to truck bed side rails",
          "Essential for rooftop tents (RTT), commercial ladders & heavy lumber"
        ],
        ideal_for: "Rooftop tent overlanding, commercial contractors, extreme cargo"
      }
    },
    {
      id: "roof_track_channels",
      name: "Integrated Heavy-Duty Roof Mounting Tracks Only",
      price: 195,
      image: "images/options/rack_tracks_only.webp",
      desc: "Factory through-bolted extruded aluminum T-slot tracks ready for future Yakima, Thule, or Rhino-Rack crossbar towers.",
      what_you_get: {
        benefits: [
          "Factory waterproof seal with through-bolt stainless backing plates",
          "Flush low-profile track appearance",
          "Compatible with all major rack accessory brands"
        ],
        ideal_for: "Future rack additions or swapping existing towers"
      }
    }
  ],
  roof_racks: [
    {
      id: "rack_none",
      name: "No Roof Rack (Clean Roofline)",
      price: 0,
      image: "images/options/rack_tracks_only.webp",
      desc: "Smooth, clean fiberglass roofline without crossbars.",
      what_you_get: {
        benefits: [
          "Maximum garage clearance and highway aerodynamics",
          "Clean aesthetic"
        ],
        ideal_for: "Low-clearance garages, city driving"
      }
    },
    {
      id: "rack_rhino_vortex_aero",
      name: "Rhino-Rack Vortex Aero Crossbar System (54\")",
      tier: "gold",
      price: 495,
      image: "images/options/rack_rhino_vortex.webp",
      desc: "Aerodynamic aluminum wing bars with rubber noise-canceling vortex strips, locking quick-release legs, and factory roof tracks.",
      what_you_get: {
        benefits: [
          "Vortex noise-reducing rubber strips eliminate highway wind howl",
          "Key-locking quick-release security legs",
          "Full compatibility with ski boxes, kayak saddles, and awning mounts"
        ],
        ideal_for: "Overlanding, rooftop tents, kayaks, bikes, snowboards"
      }
    },
    {
      id: "rack_contractor_ladder",
      name: "Commercial Heavy-Duty 2-Bar Ladder Rack",
      tier: "silver",
      price: 425,
      image: "images/options/rack_heavy_contractor.webp",
      desc: "Heavy-wall aluminum / steel commercial 2-bar rack with adjustable ladder load stops and tie-down loop anchors.",
      what_you_get: {
        benefits: [
          "500 lb heavy load capacity for extension ladders and conduit",
          "Includes 4 adjustable quick-clamp ladder load stops",
          "Rugged textured powder-coat finish"
        ],
        ideal_for: "Electricians, roofers, painters, commercial trades"
      }
    },
    {
      id: "rack_yakima_jetstream",
      name: "Yakima JetStream Aerodynamic Overlanding Roof Rack",
      tier: "gold",
      price: 545,
      image: "images/options/rack_yakima_jetstream.webp",
      desc: "Premium teardrop airfoil aluminum crossbars with Yakima Skyline locking towers and factory tracks.",
      what_you_get: {
        benefits: [
          "JetFlow teardrop cross section for superior fuel efficiency",
          "Yakima Same-Key-System (SKS) lock cores included",
          "Heavy payload rating for rooftop tents & overland platforms"
        ],
        ideal_for: "Premium overland expeditions and touring"
      }
    },
    {
      id: "rack_tracks_only",
      name: "Factory Roof Mounting Tracks Only (No Crossbars)",
      tier: "bronze",
      price: 195,
      image: "images/options/rack_tracks_only.webp",
      desc: "Aerodynamic sealed aluminum T-slot tracks installed for your own existing roof rack system.",
      what_you_get: {
        benefits: [
          "Precision drilled and sealed at the factory",
          "Ready for any T-slot compatible towers"
        ],
        ideal_for: "Using your own existing racks"
      }
    }
  ],
  lighting_packages: [
    {
      id: "pkg_1_no_lights",
      name: "Lighting Package 1 (NO LIGHTS)",
      price: 0,
      image: "images/options/light_48_strip.webp",
      desc: "Standard unlit configuration ($0.00).",
      what_you_get: {
        benefits: ["Standard unlit truck bed ceiling", "Zero power draw"],
        ideal_for: "Daytime-only driving, basic storage"
      }
    },
    {
      id: "pkg_2_batt_dome",
      name: "Lighting Package 2 (Battery Dome Light)",
      tier: "bronze",
      price: 45,
      image: "images/options/light_pin_switch.webp",
      desc: "INTERIOR MOUNTED LIGHTING: Battery Dome Light (Rear Door).",
      what_you_get: {
        benefits: ["Battery-operated dome light mounted at rear door", "No vehicle 12V wiring required", "Independent push-button on/off"],
        ideal_for: "Quick wireless convenience without wiring"
      }
    },
    {
      id: "pkg_3_12v_dome",
      name: "Lighting Package 3 (12V Dome Light)",
      tier: "bronze",
      price: 75,
      image: "images/options/light_48_strip.webp",
      desc: "INTERIOR MOUNTED LIGHTING: 12V Dome Light (Rear Door).",
      what_you_get: {
        benefits: ["Hardwired 12V automotive LED dome light", "Mounted conveniently inside rear door frame", "Bright continuous illumination"],
        ideal_for: "Reliable nighttime cargo bed visibility"
      }
    },
    {
      id: "pkg_4_12v_dome_prop",
      name: "Lighting Package 4 (12V Dome w/ Prop Switch)",
      tier: "silver",
      price: 115,
      image: "images/options/light_pin_switch.webp",
      desc: "INTERIOR MOUNTED LIGHTING: 12V Dome Light w/ Prop Switch (Rear Door).",
      what_you_get: {
        benefits: ["12V Dome Light hardwired at rear door", "Integrated gas strut prop switch", "Automatically illuminates when rear door is opened"],
        ideal_for: "Hands-free automatic loading at night"
      }
    },
    {
      id: "pkg_5_12v_dome_42led",
      name: "Lighting Package 5 (12V Dome + 42\" LED Center Roof)",
      tier: "silver",
      price: 195,
      image: "images/options/light_48_strip.webp",
      desc: "INTERIOR MOUNTED LIGHTING: 12V Dome Light (Rear Door) + 42\" LED Light (Center Roof).",
      what_you_get: {
        benefits: ["12V Dome Light at rear door", "Full 42-inch high-output LED tube centered along ceiling", "Complete shadow-free bed illumination"],
        ideal_for: "Truck bed camping, sorting gear, nighttime work"
      }
    },
    {
      id: "pkg_6_12v_dome_42led_prop",
      name: "Lighting Package 6 (12V Dome + 42\" LED + Prop Switch)",
      tier: "silver",
      price: 245,
      image: "images/options/light_perimeter_system.webp",
      desc: "INTERIOR MOUNTED LIGHTING: 12V Dome Light (Rear Door) + 42\" LED Light (Center Roof) + Prop Switch (Controls All Interior Lights).",
      what_you_get: {
        benefits: ["12V Dome Light + 42\" Center Roof LED", "Master gas prop pressure switch", "All interior lights turn on automatically when opening rear door"],
        ideal_for: "Ultimate automated convenience and daylight-level lighting"
      }
    },
    {
      id: "pkg_7_12v_dome_dual42led",
      name: "Lighting Package 7 (12V Dome + Dual 42\" LEDs)",
      tier: "gold",
      price: 295,
      image: "images/options/light_perimeter_system.webp",
      desc: "INTERIOR MOUNTED LIGHTING: 12V Dome Light (Rear Door) + 42\" LED Lights x2 (Centered Roof).",
      what_you_get: {
        benefits: ["12V Dome Light (Rear Door)", "Dual parallel 42-inch high-output LED tubes centered on ceiling", "Stadium-grade maximum illumination"],
        ideal_for: "Contractor service bodies, extreme work duty, mobile workshops"
      }
    },
    {
      id: "pkg_8_12v_dome_dual42led_prop",
      name: "Lighting Package 8 (12V Dome + Dual 42\" LEDs + Prop Switch)",
      tier: "gold",
      price: 345,
      image: "images/options/light_perimeter_system.webp",
      desc: "INTERIOR MOUNTED LIGHTING: 12V Dome Light (Rear Door) + 42\" LED Lights x2 (Centered Roof) + Prop Switch (Controls All Interior Lights).",
      what_you_get: {
        benefits: ["12V Dome Light + Dual 42\" Ceiling LED Tubes", "Integrated master automatic prop switch", "Instant hands-free stadium lighting when opening rear door"],
        ideal_for: "The ultimate flagship lighting package for any cap"
      }
    }
  ],
  cap_packs: [
    {
      id: "none",
      name: "No Cap-Pack (Open Bed Ceiling)",
      price: 0,
      image: "images/options/front_picture_solid.webp",
      desc: "Standard open roofline without ceiling slide-out storage.",
      what_you_get: {
        benefits: ["Maximum vertical headroom in truck bed", "Clean open ceiling"],
        ideal_for: "Standard cargo hauling, taller items"
      }
    },
    {
      id: "cap_pack_standard",
      name: "Cap-Pack Ceiling Storage Drawer System",
      tier: "bronze",
      price: 1425,
      image: "images/options/cappack_storage_unit.webp",
      desc: "Ceiling-mounted aluminum slide-out drawer on smooth sealed ball-bearing glides.",
      what_you_get: {
        benefits: [
          "Utilizes unused ceiling space for secure locked storage",
          "Slides out and tilts down smoothly for easy reach from tailgate",
          "Heavy-duty aluminum construction with dual rotary key locks"
        ],
        ideal_for: "Guns, hunting gear, tools, emergency equipment, fishing rods"
      }
    },
    {
      id: "cap_pack_divider_set",
      name: "Cap-Pack Drawer + Adjustable Gear Divider Set",
      tier: "silver",
      price: 1550,
      image: "images/options/cappack_storage_unit.webp",
      desc: "Cap-Pack ceiling storage drawer with adjustable cross dividers ($125 divider add-on).",
      what_you_get: {
        benefits: [
          "Complete Cap-Pack ceiling pull-out system",
          "Set of precision aluminum drop-in dividers",
          "Prevents gear, ammo, and tools from shifting while driving"
        ],
        ideal_for: "Organized multi-compartment gear storage"
      }
    },
    {
      id: "cap_pack_gun_divider_set",
      name: "Cap-Pack Drawer + Foam-Lined Gun Divider Set",
      tier: "gold",
      price: 1600,
      image: "images/options/cappack_storage_unit.webp",
      desc: "Cap-Pack ceiling storage drawer with high-density foam rifle & shotgun racks ($175 gun rack add-on).",
      what_you_get: {
        benefits: [
          "Complete Cap-Pack ceiling pull-out system",
          "Custom molded foam racks holding 2 full-length rifles/shotguns securely",
          "Padlockable security out of sight under the ceiling"
        ],
        ideal_for: "Sportsmen, hunters, law enforcement, secure firearms transport"
      }
    }
  ],
  decals: [
    {
      id: "ranch_large_oval",
      name: "Ranch Large Oval Rear Decal",
      price: 0,
      image: "images/models/ranch_echo.webp",
      desc: "Factory-installed Ranch Large Oval badge on rear glass.",
      what_you_get: {
        benefits: ["Authentic OEM factory emblem", "UV-resistant chrome/polyurethane dome badge"],
        ideal_for: "Factory showroom styling"
      }
    },
    {
      id: "ranch_small_oval",
      name: "Ranch Small Oval Side Decal",
      price: 0,
      image: "images/models/ranch_echo.webp",
      desc: "Factory Ranch Small Oval badge mounted on side pillar.",
      what_you_get: {
        benefits: ["Subtle OEM side pillar branding"],
        ideal_for: "Classic emblem look"
      }
    },
    {
      id: "stealth_clean",
      name: "Stealth Clean (No Decals / Badgeless)",
      price: 0,
      image: "images/models/venturous_ozark.webp",
      desc: "Clean badgeless look with zero exterior brand emblems.",
      what_you_get: {
        benefits: ["Completely smooth badgeless exterior", "Sleek monochromatic styling"],
        ideal_for: "Custom builds, stealth overlanding, minimalists"
      }
    }
  ],
  wrap_rails: [
    {
      id: "standard_wrap",
      name: "Standard Factory Wrap Rail",
      price: 0,
      image: "images/models/ranch_echo.webp",
      desc: "Full fiberglass wrap skirt covering truck bed rail caps.",
      what_you_get: {
        benefits: ["Full aerodynamic wrap skirt over bed rail plastics", "Maximum weather seal"],
        ideal_for: "Standard personal and work trucks"
      }
    },
    {
      id: "cut_inside_wrap",
      name: "Cut Off Inside Wrap Rail",
      price: 0,
      image: "images/models/ranch_sierra_xtra.webp",
      desc: "Inside fiberglass rail edge trimmed for inner bed rail accessory clearance.",
      what_you_get: {
        benefits: ["Provides clearance for bed slide systems, drawers, and stake pocket mounts"],
        ideal_for: "Custom interior truck bed builds"
      }
    },
    {
      id: "cut_outside_wrap",
      name: "Cut Off Outside Wrap Rail",
      price: 0,
      image: "images/models/ranch_sierra_xtra.webp",
      desc: "Outside fiberglass rail edge trimmed for external ladder racks and tie-down rails.",
      what_you_get: {
        benefits: ["Provides clearance for bed-mounted exterior ladder racks and chase racks"],
        ideal_for: "Heavy-duty rack configurations"
      }
    },
    {
      id: "cut_both_wrap",
      name: "Cut Off Both Wrap Rails",
      price: 0,
      image: "images/models/workforce_commercial.webp",
      desc: "Both inside and outside wrap skirts trimmed flush.",
      what_you_get: {
        benefits: ["Full flat-bottom profile for commercial utility and universal bed fitment"],
        ideal_for: "Commercial utility bodies, fleet upfits"
      }
    }
  ],
  toolboxes_driver: [
    {
      id: "toolbox_driver_none",
      name: "No Driver-Side Tool Box",
      price: 0,
      image: "images/options/front_picture_solid.webp",
      desc: "Full open truck bed floor space without driver-side storage box.",
      what_you_get: {
        benefits: ["Full open interior bed access", "Zero added weight"],
        ideal_for: "Standard cargo, recreational camping"
      }
    },
    {
      id: "toolbox_ds_option_a",
      name: "Driver Side Option A 2.0",
      tier: "silver",
      price: 335,
      image: "images/options/toolboxes/ds_option_a.webp",
      desc: "Full-depth open heavy-duty galvanized storage tool box without dividers.",
      what_you_get: {
        benefits: ["Full-length open galvanized tool box", "Maximum volume for bulky tool cases", "Heavy-gauge steel construction"],
        ideal_for: "Power tools, long levels, heavy contractor gear"
      }
    },
    {
      id: "toolbox_ds_option_b",
      name: "Driver Side Option B 2.0",
      tier: "silver",
      price: 335,
      image: "images/options/toolboxes/ds_option_b.webp",
      desc: "Heavy-duty tool box with center shelf and dual vertical partition dividers.",
      what_you_get: {
        benefits: ["Center elevated shelf compartment", "Dual vertical divider walls", "Organized 3-zone tool layout"],
        ideal_for: "Hardware bins, meter cases, categorized trade gear"
      }
    },
    {
      id: "toolbox_ds_option_c",
      name: "Driver Side Option C 2.0",
      tier: "gold",
      price: 425,
      image: "images/options/toolboxes/ds_option_c.webp",
      desc: "Heavy-duty tool box with full-length single middle shelf and vertical divider.",
      what_you_get: {
        benefits: ["Continuous full-length middle shelf tier", "Heavy-gauge vertical divider", "Dual level storage"],
        ideal_for: "Electricians, technicians needing dual tier access"
      }
    },
    {
      id: "toolbox_ds_option_d",
      name: "Driver Side Option D 2.0",
      tier: "silver",
      price: 335,
      image: "images/options/toolboxes/ds_option_d.webp",
      desc: "Heavy-duty tool box with left-side half shelf and vertical divider.",
      what_you_get: {
        benefits: ["Left half-shelf upper organizer", "Vertical separation bulkhead", "Open right-side deep bay"],
        ideal_for: "Mixed storage with both small tools and tall equipment"
      }
    },
    {
      id: "toolbox_ds_option_e",
      name: "Driver Side Option E 2.0",
      tier: "silver",
      price: 335,
      image: "images/options/toolboxes/ds_option_e.webp",
      desc: "Heavy-duty tool box with extended left shelf and vertical divider.",
      what_you_get: {
        benefits: ["Extended horizontal upper shelf", "Vertical partition wall", "Deep rear drop bin"],
        ideal_for: "Extended tool organizers and parts trays"
      }
    },
    {
      id: "toolbox_ds_option_f",
      name: "Driver Side Option F 2.0",
      tier: "gold",
      price: 425,
      image: "images/options/toolboxes/ds_option_f.webp",
      desc: "Full-length multi-compartment tool box with dual vertical dividers and full shelf tier.",
      what_you_get: {
        benefits: ["Full-length continuous shelf tier", "Dual vertical divider bulkheads", "Maximum 4-compartment organization"],
        ideal_for: "Complete commercial trade organization"
      }
    }
  ],
  toolboxes_passenger: [
    {
      id: "toolbox_passenger_none",
      name: "No Passenger-Side Tool Box",
      price: 0,
      image: "images/options/front_picture_solid.webp",
      desc: "Full open truck bed floor space without passenger-side storage box.",
      what_you_get: {
        benefits: ["Full open curbside interior bed access", "Zero added weight"],
        ideal_for: "Standard cargo, recreational camping"
      }
    },
    {
      id: "toolbox_ps_option_a",
      name: "Passenger Side Option A 2.0",
      tier: "silver",
      price: 335,
      image: "images/options/toolboxes/ps_option_a.webp",
      desc: "Full-depth open heavy-duty galvanized curbside tool box without dividers.",
      what_you_get: {
        benefits: ["Full-length open galvanized curbside box", "Maximum volume for bulky tool cases", "Curbside sidewalk safety"],
        ideal_for: "Power tools, cables, roadside service gear"
      }
    },
    {
      id: "toolbox_ps_option_b",
      name: "Passenger Side Option B 2.0",
      tier: "silver",
      price: 335,
      image: "images/options/toolboxes/ps_option_b.webp",
      desc: "Heavy-duty curbside tool box with center shelf and dual vertical dividers.",
      what_you_get: {
        benefits: ["Center elevated shelf compartment", "Dual vertical divider walls", "Organized 3-zone tool layout"],
        ideal_for: "Hardware bins, diagnostic tools, municipal fleet use"
      }
    },
    {
      id: "toolbox_ps_option_c",
      name: "Passenger Side Option C 2.0",
      tier: "gold",
      price: 425,
      image: "images/options/toolboxes/ps_option_c.webp",
      desc: "Heavy-duty curbside tool box with full-length single middle shelf and vertical divider.",
      what_you_get: {
        benefits: ["Continuous full-length middle shelf tier", "Heavy-gauge vertical divider", "Dual level storage"],
        ideal_for: "Service technicians needing dual level curbside access"
      }
    },
    {
      id: "toolbox_ps_option_d",
      name: "Passenger Side Option D 2.0",
      tier: "silver",
      price: 335,
      image: "images/options/toolboxes/ps_option_d.webp",
      desc: "Heavy-duty curbside tool box with half shelf and vertical divider.",
      what_you_get: {
        benefits: ["Curbside half-shelf organizer", "Vertical separation bulkhead", "Open deep bay"],
        ideal_for: "Mixed storage with small tools and tall equipment"
      }
    },
    {
      id: "toolbox_ps_option_e",
      name: "Passenger Side Option E 2.0",
      tier: "silver",
      price: 335,
      image: "images/options/toolboxes/ps_option_e.webp",
      desc: "Heavy-duty curbside tool box with extended shelf and vertical divider.",
      what_you_get: {
        benefits: ["Extended horizontal upper shelf", "Vertical partition wall", "Deep rear drop bin"],
        ideal_for: "Extended tool organizers and fast curbside grab"
      }
    },
    {
      id: "toolbox_ps_option_f",
      name: "Passenger Side Option F 2.0",
      tier: "gold",
      price: 425,
      image: "images/options/toolboxes/ps_option_f.webp",
      desc: "Full-length multi-compartment curbside tool box with dual vertical dividers and full shelf tier.",
      what_you_get: {
        benefits: ["Full-length continuous shelf tier", "Dual vertical divider bulkheads", "Maximum 4-compartment organization"],
        ideal_for: "Complete commercial fleet parts organization"
      }
    }
  ],
  side_toolboxes: []
};

/**
 * Calculates the latest available automotive model year.
 * In the automotive industry, next-year models are released/ordered starting in mid-summer.
 * Specifically on or after July 15th of each calendar year, the upcoming model year
 * (currentYear + 1) is automatically added to the configurator.
 */
function getLatestModelYear(date = new Date()) {
  const currentYear = date.getFullYear();
  const month = date.getMonth(); // 0 = Jan, 6 = July
  const day = date.getDate();
  // On or after July 15th, add the upcoming model year (e.g. July 15, 2026 -> 2027)
  if (month > 6 || (month === 6 && day >= 15)) {
    return currentYear + 1;
  }
  return currentYear;
}

/**
 * Dynamically populates the model year dropdown (#vehYear).
 * Automatically ranges from the calculated latest model year (with July 15 rollover) down to 1995.
 */
function populateYearDropdown(selectedYear) {
  const vehYear = document.getElementById("vehYear");
  if (!vehYear) return;

  const currentSelection = selectedYear || vehYear.value || state.vehicle.year;
  const maxYear = getLatestModelYear();
  const minYear = 1995;

  vehYear.innerHTML = '<option value="">-- Choose Year (Required) --</option>';

  for (let y = maxYear; y >= minYear; y--) {
    const opt = document.createElement("option");
    opt.value = y.toString();
    opt.textContent = y.toString();
    if (currentSelection && currentSelection.toString() === y.toString()) {
      opt.selected = true;
    }
    vehYear.appendChild(opt);
  }

  if (currentSelection && !Array.from(vehYear.options).some((o) => o.value === currentSelection.toString())) {
    const customOpt = document.createElement("option");
    customOpt.value = currentSelection.toString();
    customOpt.textContent = currentSelection.toString();
    customOpt.selected = true;
    vehYear.appendChild(customOpt);
  }
}

// Initialization
document.addEventListener("DOMContentLoaded", () => {
  attachEventListeners();
  const restored = restoreStateFromStorage();
  if (!restored) {
    populateYearDropdown(state.vehicle.year);
    updateColorSwatches(state.vehicle.make || "Ford", state.vehicle.model || "F-150", state.vehicle.year || "2024", state.vehicle.paint_code);
    renderModels();
    renderOptions();
    updateVisualizer();
  }

  // Check URL hash if user opened directly to a step
  if (window.location.hash && window.location.hash.startsWith("#step-")) {
    const stepFromHash = parseInt(window.location.hash.replace("#step-", ""), 10);
    if (stepFromHash >= 1 && stepFromHash <= 5) {
      goToStep(stepFromHash);
    }
  }
});

// History Navigation (Browser Back & Forward Buttons)
window.addEventListener("popstate", (event) => {
  const targetStep = event.state?.step || (window.location.hash ? parseInt(window.location.hash.replace("#step-", ""), 10) : 1);
  if (targetStep >= 1 && targetStep <= 5) {
    state.currentStep = targetStep;
    document.querySelectorAll(".step-btn").forEach((b) => {
      b.classList.toggle("active", parseInt(b.dataset.step, 10) === targetStep);
    });
    document.querySelectorAll(".step-pane").forEach((p) => {
      p.classList.remove("active");
    });
    const activePane = document.getElementById(`stepPane${targetStep}`);
    if (activePane) activePane.classList.add("active");
    saveStateToStorage();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
});

// Calculate Compatible Models Based on Vehicle Year, Make, Model & Bed Size (July 2026 Master Fit Chart)
function getCompatibleModelIdsForVehicle(veh) {
  if (!veh || !veh.make) {
    return LTA_MODELS.map((m) => m.id);
  }

  const make = (veh.make || "").trim().toLowerCase();
  const model = (veh.model || "").trim().toLowerCase();
  const year = parseInt(veh.year, 10) || 2024;
  const bed = (veh.bed_size || "").toLowerCase();

  const is8ft = bed.includes("8") || bed.includes("long") || bed.includes("96") || bed.includes("98") || bed.includes("97");
  let compatible = [];

  // CHEVROLET / GMC
  if (make.includes("chevy") || make.includes("chevrolet") || make.includes("gmc")) {
    if (model.includes("colorado") || model.includes("canyon")) {
      if (year >= 2023) {
        compatible = ["venturous_ozark", "ranch_icon", "ranch_fusion", "ranch_echo", "ranch_sierra", "ranch_sierra_xtra", "ranch_skyline", "ranch_legacy_lid", "ranch_sportwrap_lid", "ranch_workforce", "ranch_pro_series", "unicover_light_duty", "unicover_heavy_duty", "swiss_heavy_duty"];
      } else if (year >= 2015) {
        compatible = ["ranch_icon_premier", "ranch_fusion_classic", "ranch_echo", "ranch_sierra", "ranch_sierra_xtra", "ranch_skyline", "ranch_legacy_lid", "ranch_sportwrap_lid", "ranch_workforce", "ranch_pro_series", "unicover_light_duty", "unicover_heavy_duty", "swiss_heavy_duty"];
      } else {
        compatible = ["ranch_echo", "ranch_sierra", "ranch_sierra_xtra", "ranch_skyline", "ranch_legacy_lid", "ranch_sportwrap_lid", "ranch_workforce", "ranch_pro_series", "unicover_light_duty", "unicover_heavy_duty", "swiss_heavy_duty"];
      }
    } else if (model.includes("2500") || model.includes("3500") || model.includes("hd")) {
      if (is8ft) {
        compatible = ["ranch_echo", "ranch_sierra", "ranch_sierra_xtra", "ranch_skyline", "ranch_workforce", "ranch_pro_series", "unicover_heavy_duty", "swiss_heavy_duty"];
      } else {
        compatible = ["venturous_ozark", "ranch_icon", "ranch_fusion", "ranch_echo", "ranch_sierra", "ranch_sierra_xtra", "ranch_skyline", "ranch_legacy_lid", "ranch_sportwrap_lid", "ranch_workforce", "ranch_pro_series", "unicover_light_duty", "unicover_heavy_duty", "swiss_heavy_duty"];
      }
    } else {
      // Silverado / Sierra 1500
      if (year >= 2019) {
        if (is8ft) {
          compatible = ["ranch_echo", "ranch_sierra", "ranch_sierra_xtra", "ranch_skyline", "ranch_workforce", "ranch_pro_series", "unicover_heavy_duty", "swiss_heavy_duty"];
        } else {
          compatible = ["venturous_ozark", "ranch_icon", "ranch_fusion", "ranch_echo", "ranch_sierra", "ranch_sierra_xtra", "ranch_skyline", "ranch_legacy_lid", "ranch_sportwrap_lid", "ranch_workforce", "ranch_pro_series", "unicover_light_duty", "unicover_heavy_duty", "swiss_heavy_duty"];
        }
      } else if (year >= 2014) {
        compatible = ["ranch_icon_premier", "ranch_fusion_classic", "ranch_echo", "ranch_sierra", "ranch_sierra_xtra", "ranch_skyline", "ranch_legacy_lid", "ranch_sportwrap_lid", "ranch_workforce", "ranch_pro_series", "unicover_light_duty", "unicover_heavy_duty", "swiss_heavy_duty"];
      } else {
        compatible = ["ranch_echo", "ranch_sierra", "ranch_sierra_xtra", "ranch_skyline", "ranch_legacy_lid", "ranch_sportwrap_lid", "ranch_workforce", "ranch_pro_series", "unicover_light_duty", "unicover_heavy_duty", "swiss_heavy_duty"];
      }
    }
  }
  // FORD
  else if (make.includes("ford")) {
    if (model.includes("maverick")) {
      // Maverick (*5 Mid-rise & Ozark only)
      compatible = ["venturous_ozark", "ranch_skyline", "ranch_legacy_lid", "ranch_sportwrap_lid", "ranch_workforce", "ranch_pro_series", "unicover_light_duty", "unicover_heavy_duty", "swiss_heavy_duty"];
    } else if (model.includes("ranger")) {
      compatible = ["ranch_icon", "ranch_fusion", "ranch_echo", "ranch_sierra", "ranch_sierra_xtra", "ranch_skyline", "ranch_legacy_lid", "ranch_sportwrap_lid", "ranch_workforce", "ranch_pro_series", "unicover_light_duty", "unicover_heavy_duty", "swiss_heavy_duty"];
    } else if (model.includes("250") || model.includes("350") || model.includes("super duty")) {
      if (year >= 2023) {
        compatible = ["venturous_ozark", "ranch_icon", "ranch_fusion", "ranch_echo", "ranch_sierra", "ranch_sierra_xtra", "ranch_skyline", "ranch_legacy_lid", "ranch_sportwrap_lid", "ranch_workforce", "ranch_pro_series", "unicover_heavy_duty", "swiss_heavy_duty"];
      } else if (year >= 2017) {
        compatible = ["ranch_icon", "ranch_fusion", "ranch_echo", "ranch_sierra", "ranch_sierra_xtra", "ranch_skyline", "ranch_legacy_lid", "ranch_sportwrap_lid", "ranch_workforce", "ranch_pro_series", "unicover_heavy_duty", "swiss_heavy_duty"];
      } else {
        compatible = ["ranch_echo", "ranch_sierra", "ranch_sierra_xtra", "ranch_skyline", "ranch_legacy_lid", "ranch_sportwrap_lid", "ranch_workforce", "ranch_pro_series", "unicover_heavy_duty", "swiss_heavy_duty"];
      }
    } else {
      // F-150
      if (year >= 2021) {
        if (is8ft) {
          compatible = ["ranch_echo", "ranch_sierra", "ranch_sierra_xtra", "ranch_skyline", "ranch_workforce", "ranch_pro_series", "unicover_heavy_duty", "swiss_heavy_duty"];
        } else {
          compatible = ["venturous_ozark", "ranch_icon", "ranch_fusion", "ranch_echo", "ranch_sierra", "ranch_sierra_xtra", "ranch_skyline", "ranch_legacy_lid", "ranch_sportwrap_lid", "ranch_workforce", "ranch_pro_series", "unicover_light_duty", "unicover_heavy_duty", "swiss_heavy_duty"];
        }
      } else if (year >= 2015) {
        compatible = ["ranch_icon_premier", "ranch_fusion_classic", "ranch_echo", "ranch_sierra", "ranch_sierra_xtra", "ranch_skyline", "ranch_legacy_lid", "ranch_sportwrap_lid", "ranch_workforce", "ranch_pro_series", "unicover_light_duty", "unicover_heavy_duty", "swiss_heavy_duty"];
      } else {
        compatible = ["ranch_echo", "ranch_sierra", "ranch_sierra_xtra", "ranch_skyline", "ranch_legacy_lid", "ranch_sportwrap_lid", "ranch_workforce", "ranch_pro_series", "unicover_light_duty", "unicover_heavy_duty", "swiss_heavy_duty"];
      }
    }
  }
  // RAM / DODGE
  else if (make.includes("ram") || make.includes("dodge")) {
    if (model.includes("2500") || model.includes("3500")) {
      compatible = ["ranch_echo", "ranch_sierra", "ranch_sierra_xtra", "ranch_skyline", "ranch_legacy_lid", "ranch_sportwrap_lid", "ranch_workforce", "ranch_pro_series", "unicover_heavy_duty", "swiss_heavy_duty"];
    } else {
      // Ram 1500
      if (year >= 2019) {
        if (is8ft) {
          compatible = ["ranch_echo", "ranch_sierra", "ranch_sierra_xtra", "ranch_skyline", "ranch_workforce", "ranch_pro_series", "unicover_heavy_duty", "swiss_heavy_duty"];
        } else {
          compatible = ["venturous_ozark", "ranch_icon", "ranch_fusion", "ranch_echo", "ranch_sierra", "ranch_sierra_xtra", "ranch_skyline", "ranch_legacy_lid", "ranch_sportwrap_lid", "ranch_workforce", "ranch_pro_series", "unicover_light_duty", "unicover_heavy_duty", "swiss_heavy_duty"];
        }
      } else {
        compatible = ["ranch_echo", "ranch_sierra", "ranch_sierra_xtra", "ranch_skyline", "ranch_legacy_lid", "ranch_sportwrap_lid", "ranch_workforce", "ranch_pro_series", "unicover_light_duty", "unicover_heavy_duty", "swiss_heavy_duty"];
      }
    }
  }
  // TOYOTA
  else if (make.includes("toyota")) {
    if (model.includes("tacoma")) {
      if (year >= 2024) {
        compatible = ["venturous_ozark", "ranch_icon", "ranch_fusion", "ranch_echo", "ranch_sierra", "ranch_sierra_xtra", "ranch_skyline", "ranch_legacy_lid", "ranch_sportwrap_lid", "ranch_workforce", "ranch_pro_series", "unicover_light_duty", "unicover_heavy_duty", "swiss_heavy_duty"];
      } else if (year >= 2016) {
        compatible = ["venturous_ozark", "ranch_icon", "ranch_icon_premier", "ranch_fusion", "ranch_fusion_classic", "ranch_echo", "ranch_sierra", "ranch_sierra_xtra", "ranch_skyline", "ranch_legacy_lid", "ranch_sportwrap_lid", "ranch_workforce", "ranch_pro_series", "unicover_light_duty", "unicover_heavy_duty", "swiss_heavy_duty"];
      } else {
        compatible = ["ranch_echo", "ranch_sierra", "ranch_sierra_xtra", "ranch_skyline", "ranch_legacy_lid", "ranch_sportwrap_lid", "ranch_workforce", "ranch_pro_series", "unicover_light_duty", "unicover_heavy_duty", "swiss_heavy_duty"];
      }
    } else if (model.includes("tundra")) {
      if (year >= 2022) {
        if (is8ft) {
          compatible = ["ranch_echo", "ranch_sierra", "ranch_sierra_xtra", "ranch_skyline", "ranch_workforce", "ranch_pro_series", "unicover_heavy_duty", "swiss_heavy_duty"];
        } else {
          compatible = ["venturous_ozark", "ranch_icon", "ranch_fusion", "ranch_echo", "ranch_sierra", "ranch_sierra_xtra", "ranch_skyline", "ranch_legacy_lid", "ranch_sportwrap_lid", "ranch_workforce", "ranch_pro_series", "unicover_light_duty", "unicover_heavy_duty", "swiss_heavy_duty"];
        }
      } else if (year >= 2014) {
        compatible = ["ranch_icon", "ranch_fusion", "ranch_echo", "ranch_sierra", "ranch_sierra_xtra", "ranch_skyline", "ranch_legacy_lid", "ranch_sportwrap_lid", "ranch_workforce", "ranch_pro_series", "unicover_light_duty", "unicover_heavy_duty", "swiss_heavy_duty"];
      } else {
        compatible = ["ranch_echo", "ranch_sierra", "ranch_sierra_xtra", "ranch_skyline", "ranch_legacy_lid", "ranch_sportwrap_lid", "ranch_workforce", "ranch_pro_series", "unicover_light_duty", "unicover_heavy_duty", "swiss_heavy_duty"];
      }
    }
  }
  // JEEP
  else if (make.includes("jeep")) {
    compatible = ["venturous_ozark", "ranch_echo", "ranch_sierra", "ranch_sierra_xtra", "ranch_skyline", "ranch_workforce", "ranch_pro_series", "unicover_light_duty", "unicover_heavy_duty", "swiss_heavy_duty"];
  }
  // NISSAN
  else if (make.includes("nissan")) {
    compatible = ["ranch_echo", "ranch_sierra", "ranch_sierra_xtra", "ranch_skyline", "ranch_legacy_lid", "ranch_sportwrap_lid", "ranch_workforce", "ranch_pro_series", "unicover_light_duty", "unicover_heavy_duty", "swiss_heavy_duty"];
  } else {
    return LTA_MODELS.map((m) => m.id);
  }

  return compatible;
}

// Render Model Selection Cards with Vehicle Fitment Filtering & Categorized Sectioning
function renderModels() {
  const container = document.getElementById("modelsGrid");
  if (!container) return;
  container.innerHTML = "";

  // Wire Category Tab buttons
  document.querySelectorAll(".cat-tab-btn").forEach((btn) => {
    btn.onclick = () => {
      document.querySelectorAll(".cat-tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.activeCategory = btn.dataset.cat;
      renderModels();
    };
  });

  const compatibleIds = getCompatibleModelIdsForVehicle(state.vehicle);

  // If currently selected model is not compatible with vehicle selection, reset it
  if (state.model_id && !compatibleIds.includes(state.model_id)) {
    console.warn(`Model ${state.model_id} not compatible with ${state.vehicle.year} ${state.vehicle.make} ${state.vehicle.model}. Auto-resetting.`);
    state.model_id = null;
  }

  const vehLabel = state.vehicle.make ? `${state.vehicle.year || ""} ${state.vehicle.make} ${state.vehicle.model || ""}`.trim() : "Your Truck";

  const tierMap = {
    venturous_ozark: "gold",
    ranch_icon: "gold",
    ranch_icon_premier: "gold",
    ranch_workforce: "gold",
    ranch_skyline: "gold",
    ranch_pro_series: "gold",
    ranch_sierra: "bronze",
    ranch_sierra_xtra: "silver",
    ranch_fusion: "silver",
    ranch_fusion_classic: "silver",
    ranch_sportwrap_lid: "bronze",
    ranch_legacy_lid: "silver",
    unicover_heavy_duty: "bronze",
    unicover_light_duty: "bronze",
    swiss_heavy_duty: "silver",
  };

  const CATEGORIES = [
    {
      id: "fiberglass",
      name: "Fiberglass Caps",
      icon: "🛡️",
      subtitle: "Cab-High & Mid-Rise custom color-matched caps engineered for perfect OEM fit.",
      features: [
        "Cab-High & Mid-Rise Profiles",
        "Axalta Factory Color Match",
        "Frameless & Slider Options",
        "Lifetime Warranty Available"
      ],
      matches: (m) => m.category === "fiberglass" || m.category === "commercial"
    },
    {
      id: "aluminum",
      name: "Commercial Aluminum Tops",
      icon: "🔧",
      subtitle: "Heavy-duty welded aluminum contractor toppers & municipal fleet bodies.",
      features: [
        ".040 & .080 TIG-Welded Aluminum",
        "Solid Lift-Up Access Doors",
        "500+ lb Ladder Rack Capacity",
        "Commercial Side Toolboxes"
      ],
      matches: (m) => m.category === "aluminum"
    },
    {
      id: "lid",
      name: "Fiberglass Tonneau Bed Lids",
      icon: "🔒",
      subtitle: "Ultra-low profile painted hard bed covers with locking security.",
      features: [
        "1,200 lb Rotary Security Latches",
        "Smooth Aerodynamic Styling",
        "Factory Paint-to-Match",
        "Recycled Carpet Headliner"
      ],
      matches: (m) => m.category === "lid"
    }
  ];

  let totalRendered = 0;

  CATEGORIES.forEach((cat) => {
    if (state.activeCategory !== "all" && state.activeCategory !== cat.id) return;

    const catModels = LTA_MODELS.filter((m) => compatibleIds.includes(m.id) && cat.matches(m));
    if (catModels.length === 0) return;

    totalRendered += catModels.length;

    // Create Category Section Group
    const group = document.createElement("div");
    group.className = "model-category-group";
    group.dataset.categoryId = cat.id;

    // Schematic Wire Callout Box Coming Off Left Edge
    const wireCallout = document.createElement("div");
    wireCallout.className = "category-wire-callout";
    wireCallout.innerHTML = `
      <div class="wire-branch-connector"></div>
      <div class="category-wire-card">
        <div class="category-wire-info">
          <h3 class="category-wire-title"><span>${cat.icon}</span> ${cat.name}</h3>
          <p class="category-wire-desc">${cat.subtitle}</p>
        </div>
        <span class="category-wire-badge">${catModels.length} Models</span>
      </div>
    `;
    group.appendChild(wireCallout);

    // 2-Column Model Card Grid
    const grid = document.createElement("div");
    grid.className = "model-category-grid";

    catModels.forEach((m) => {
      const isSelected = m.id === state.model_id;
      const tier = tierMap[m.id] || "standard";
      const card = document.createElement("div");
      card.className = `model-card tier-${tier} ${isSelected ? "active" : ""}`;
      card.dataset.id = m.id;
      card.dataset.modelId = m.id;
      card.setAttribute("data-model-id", m.id);
      card.onclick = () => selectModel(m.id);

      card.innerHTML = `
        <div>
          <div class="model-card-top">
            <div class="model-badges-group">
              <span class="model-brand-badge">${m.brand}</span>
            </div>
            <span class="model-price">$${m.base_price.toLocaleString()}</span>
          </div>
          <div class="model-fitment-badge">✓ Custom Fit for ${vehLabel}</div>
          <h3 class="model-name">${m.name}</h3>
          <div class="model-tagline">${m.tagline}</div>
          <p class="model-desc">${m.desc}</p>
        </div>
        <div class="model-card-actions">
          <button class="btn-what-you-get" onclick="event.stopPropagation(); showWhatYouGet('model', '${m.id}')">
            🔍 What You Get
          </button>
          <span class="select-indicator">${isSelected ? "✓ SELECTED" : "SELECT"}</span>
        </div>
      `;
      grid.appendChild(card);
    });

    group.appendChild(grid);
    container.appendChild(group);
  });

  if (totalRendered === 0) {
    container.innerHTML = `
      <div class="no-models-card" style="text-align: center; padding: 40px; background: #121620; border: 1px solid #283244; border-radius: 8px;">
        <h3 style="color: #FFF; margin-bottom: 8px;">No Models Found in this Category</h3>
        <p style="color: var(--tgu-text-muted); font-size: 14px;">Try selecting "ALL MODELS" or check your truck bed length configuration.</p>
      </div>
    `;
  }
}

// Render Option Tiles for Windows, Doors, Structure, Racks, Lighting, Cap-Packs, Toolboxes & Decals
function renderOptions() {
  const isAluminum = ["ranch_pro_series", "unicover_light_duty", "unicover_heavy_duty", "swiss_heavy_duty"].includes(state.model_id);
  const isLid = ["ranch_legacy_lid", "ranch_sportwrap_lid", "ranch_fusion_lid", "unicover_aurora_lid"].includes(state.model_id);
  const isOzark = state.model_id === "venturous_ozark";
  const isIcon = ["ranch_icon", "ranch_icon_premier"].includes(state.model_id);
  const isFusion = ["ranch_fusion", "ranch_fusion_classic"].includes(state.model_id);
  const isSierraXtra = state.model_id === "ranch_sierra_xtra";
  const isWorkforce = ["ranch_workforce", "workforce_hd_pro", "unicover_heavy_duty", "swiss_heavy_duty"].includes(state.model_id);

  sanitizeOptionsForModel(state.model_id);

  const fiberglassContainer = document.getElementById("fiberglassConfigContainer");
  const aluminumContainer = document.getElementById("aluminumConfigContainer");
  const tonneauContainer = document.getElementById("tonneauConfigContainer");
  const tonneauAccessories = document.getElementById("tonneauAccessoriesContainer");

  const secRoofReinforce = document.getElementById("sectionRoofReinforce");
  const secRoofRacks = document.getElementById("sectionRoofRacks");
  const secLighting = document.getElementById("sectionLighting");
  const secInteriorGear = document.getElementById("sectionInteriorGear");
  const secCapPack = document.getElementById("sectionCapPack");
  const secSideToolbox = document.getElementById("sectionSideToolbox");
  const secDecalsTrim = document.getElementById("sectionDecalsTrim");

  const step3Btn = document.querySelector(".step-btn[data-step='3']");
  const step4Btn = document.querySelector(".step-btn[data-step='4']");
  const step3NextBtn = document.getElementById("step3NextBtn");
  const step4PrevBtn = document.getElementById("step4PrevBtn");
  const step4Title = document.getElementById("step4Title");
  const step4Desc = document.getElementById("step4Desc");

  if (isLid) {
    if (fiberglassContainer) fiberglassContainer.classList.add("hidden");
    if (aluminumContainer) aluminumContainer.classList.add("hidden");
    if (tonneauContainer) tonneauContainer.classList.remove("hidden");

    if (tonneauAccessories) tonneauAccessories.classList.remove("hidden");
    if (secRoofReinforce) secRoofReinforce.classList.add("hidden");
    if (secRoofRacks) secRoofRacks.classList.add("hidden");
    if (secLighting) secLighting.classList.add("hidden");
    if (secInteriorGear) secInteriorGear.classList.add("hidden");
    if (secCapPack) secCapPack.classList.add("hidden");
    if (secSideToolbox) secSideToolbox.classList.add("hidden");
    if (secDecalsTrim) secDecalsTrim.classList.add("hidden");

    if (step3Btn) step3Btn.innerHTML = '<span class="step-num">3</span> Lid Specs & Locks';
    if (step4Btn) step4Btn.innerHTML = '<span class="step-num">4</span> Lid Accessories';
    if (step3NextBtn) step3NextBtn.innerText = "Continue to Lid Accessories →";
    if (step4PrevBtn) step4PrevBtn.innerText = "← Back to Lid Specs";
    if (step4Title) step4Title.innerText = "Step 4: Tonneau Lid Accessories & Over-Lid Racks";
    if (step4Desc) step4Desc.innerText = "Select optional low-profile over-lid crossbar racks and cargo accessories for your painted fiberglass tonneau cover.";

    if (!state.options.tonneau_locking) state.options.tonneau_locking = "tonneau_rotary_standard";
    if (!state.options.tonneau_lighting) state.options.tonneau_lighting = "tonneau_light_standard_dome";
    if (!state.options.tonneau_rack) state.options.tonneau_rack = "tonneau_rack_none";

    renderTileGrid("tonneauLockingGrid", OPTIONS_CATALOG.tonneau_locking, state.options.tonneau_locking, (id) => {
      state.options.tonneau_locking = id;
      state.options.keyless_remote = id === "tonneau_keyless_remote_sync";
      renderOptions();
      recalculatePrice();
      checkFieldErrorsLive(3);
    });

    renderTileGrid("tonneauLightingGrid", OPTIONS_CATALOG.tonneau_lighting, state.options.tonneau_lighting, (id) => {
      state.options.tonneau_lighting = id;
      renderOptions();
      recalculatePrice();
      checkFieldErrorsLive(3);
    });

    renderTileGrid("tonneauRackGrid", OPTIONS_CATALOG.tonneau_racks, state.options.tonneau_rack, (id) => {
      state.options.tonneau_rack = id;
      renderOptions();
      recalculatePrice();
      checkFieldErrorsLive(4);
    });

  } else if (isAluminum) {
    if (fiberglassContainer) fiberglassContainer.classList.add("hidden");
    if (tonneauContainer) tonneauContainer.classList.add("hidden");
    if (aluminumContainer) aluminumContainer.classList.remove("hidden");

    if (tonneauAccessories) tonneauAccessories.classList.add("hidden");
    if (secRoofReinforce) secRoofReinforce.classList.remove("hidden");
    if (secRoofRacks) secRoofRacks.classList.remove("hidden");
    if (secLighting) secLighting.classList.remove("hidden");
    if (secInteriorGear) secInteriorGear.classList.add("hidden");
    if (secCapPack) secCapPack.classList.add("hidden");
    if (secSideToolbox) secSideToolbox.classList.remove("hidden");
    if (secDecalsTrim) secDecalsTrim.classList.add("hidden");

    if (step3Btn) step3Btn.innerHTML = '<span class="step-num">3</span> Height & Side Layout';
    if (step4Btn) step4Btn.innerHTML = '<span class="step-num">4</span> Racks & Toolboxes';
    if (step3NextBtn) step3NextBtn.innerText = "Continue to Racks & Toolboxes →";
    if (step4PrevBtn) step4PrevBtn.innerText = "← Back to Height & Layout";
    if (step4Title) step4Title.innerText = "Step 4: Contractor Racks, Lighting & Heavy Toolboxes";
    if (step4Desc) step4Desc.innerText = "Configure heavy-duty contractor ladder racks, interior LED lighting packages, and commercial galvanized toolboxes.";

    if (!state.options.aluminum_height) state.options.aluminum_height = "height_24_cab_high_full";
    if (!state.options.aluminum_side_layout) state.options.aluminum_side_layout = "win_alum_100_sliding";
    if (!state.options.aluminum_color) state.options.aluminum_color = "alum_white";

    // Aluminum Heights
    renderTileGrid("aluminumHeightGrid", OPTIONS_CATALOG.aluminum_heights, state.options.aluminum_height, (id) => {
      state.options.aluminum_height = id;
      renderOptions();
      recalculatePrice();
      checkFieldErrorsLive(3);
    });

    // Aluminum Side Windows
    renderTileGrid("aluminumSideGrid", OPTIONS_CATALOG.aluminum_side_windows, state.options.aluminum_side_layout, (id) => {
      state.options.aluminum_side_layout = id;
      renderOptions();
      recalculatePrice();
      checkFieldErrorsLive(3);
    });

    // Aluminum Colors
    renderTileGrid("aluminumColorGrid", OPTIONS_CATALOG.aluminum_colors, state.options.aluminum_color, (id) => {
      state.options.aluminum_color = id;
      renderOptions();
      recalculatePrice();
      checkFieldErrorsLive(3);
    });

    // Structure, Racks, Lighting, Toolboxes
    renderTileGrid("roofReinforceGrid", OPTIONS_CATALOG.roof_reinforcement, state.options.roof_reinforcement, (id) => {
      state.options.roof_reinforcement = id;
      renderOptions();
      recalculatePrice();
      checkFieldErrorsLive(4);
    });

    renderTileGrid("roofRackGrid", OPTIONS_CATALOG.roof_racks, state.options.roof_rack, (id) => {
      state.options.roof_rack = id;
      renderOptions();
      updateVisualizer();
      recalculatePrice();
      checkFieldErrorsLive(4);
    });

    const activeLightingId = state.options.lighting_package || state.options.interior_lighting || "pkg_1_no_lights";
    renderTileGrid("lightingGrid", OPTIONS_CATALOG.lighting_packages, activeLightingId, (id) => {
      state.options.lighting_package = id;
      state.options.interior_lighting = id;
      renderOptions();
      recalculatePrice();
      checkFieldErrorsLive(4);
    });

    renderTileGrid("sideToolboxGrid", OPTIONS_CATALOG.side_toolboxes, state.options.side_toolbox, (id) => {
      state.options.side_toolbox = id;
      renderOptions();
      recalculatePrice();
      checkFieldErrorsLive(4);
    });

  } else {
    // Recreational / Commercial Fiberglass Cap
    if (fiberglassContainer) fiberglassContainer.classList.remove("hidden");
    if (aluminumContainer) aluminumContainer.classList.add("hidden");
    if (tonneauContainer) tonneauContainer.classList.add("hidden");

    if (tonneauAccessories) tonneauAccessories.classList.add("hidden");
    if (secRoofReinforce) secRoofReinforce.classList.remove("hidden");
    if (secRoofRacks) secRoofRacks.classList.remove("hidden");
    if (secLighting) secLighting.classList.remove("hidden");
    if (secInteriorGear) secInteriorGear.classList.remove("hidden");
    if (secCapPack) secCapPack.classList.remove("hidden");
    if (secSideToolbox) secSideToolbox.classList.remove("hidden");
    if (secDecalsTrim) secDecalsTrim.classList.remove("hidden");

    if (step3Btn) step3Btn.innerHTML = '<span class="step-num">3</span> Windows & Access';
    if (step4Btn) step4Btn.innerHTML = '<span class="step-num">4</span> Racks & Interior';
    if (step3NextBtn) step3NextBtn.innerText = "Continue to Racks & Interior →";
    if (step4PrevBtn) step4PrevBtn.innerText = "← Back to Windows";
    if (step4Title) step4Title.innerText = "Step 4: Roof Structure, Racks, Lighting & Interior Accessories";
    if (step4Desc) step4Desc.innerText = "Select your roof reinforcement structure, roof rack system, official 8-tier lighting package, interior gear accessories, and Cap-Pack drawer system.";

    // Model-aware defaults
    const isStdHeadlinerModel = isIcon || isOzark || isFusion || isSierraXtra || state.model_id === "ranch_legacy_lid";
    if (isStdHeadlinerModel && state.options.carpet_headliner === undefined) {
      state.options.carpet_headliner = true;
    }
    const chkHeadliner = document.getElementById("chkHeadliner");
    if (chkHeadliner) {
      chkHeadliner.disabled = false;
      chkHeadliner.checked = state.options.carpet_headliner !== false;
    }
    updateToggleBoxVisuals();

    if (!state.options.front_window) {
      state.options.front_window = "front_solid_picture";
    }
    if ((isIcon || isOzark || isFusion) && !state.options.rear_door) {
      state.options.rear_door = "rear_frameless_slam_latch";
    } else if (!state.options.rear_door) {
      state.options.rear_door = "rear_framed_dual_t";
    }

    // Model-specific available side window options
    const isFramelessSide = isIcon || isOzark;
    const availableSideWindows = OPTIONS_CATALOG.side_windows.filter((w) => {
      if (w.id === "win_solid_aluminum_door") return false;
      if (isFramelessSide && w.id === "win_solid_fiberglass_no_window") return false;
      return true;
    });

    // Front Window
    renderTileGrid("frontWindowGrid", OPTIONS_CATALOG.front_windows, state.options.front_window, (id) => {
      state.options.front_window = id;
      renderOptions();
      recalculatePrice();
      checkFieldErrorsLive(3);
    });

    // Driver Side
    renderTileGrid("driverSideGrid", availableSideWindows, state.options.side_windows_driver, (id) => {
      state.options.side_windows_driver = id;
      renderOptions();
      recalculatePrice();
      checkFieldErrorsLive(3);
    });

    // Passenger Side
    renderTileGrid("passengerSideGrid", availableSideWindows, state.options.side_windows_passenger, (id) => {
      state.options.side_windows_passenger = id;
      renderOptions();
      recalculatePrice();
      checkFieldErrorsLive(3);
    });

    // Rear Door: Strictly model-aware rendering
    const framelessModels = ["ranch_icon", "ranch_icon_premier", "ranch_fusion", "ranch_fusion_classic", "venturous_ozark"];
    let availableRearDoors;

    if (framelessModels.includes(state.model_id)) {
      state.options.rear_door = "rear_frameless_slam_latch";
      availableRearDoors = [
        {
          id: "rear_frameless_slam_latch",
          name: "Frameless All-Glass Slam-Latch Door (Standard / Included)",
          tier: "gold",
          price: 0,
          image: "images/options/rear_frameless_slam.webp",
          desc: "Curved dark tint safety glass with single center teardrop handle and automotive rotary latches (Standard on Ranch Fusion & Icon).",
          what_you_get: {
            benefits: [
              "Frameless edge-to-edge curved automotive glass",
              "Single center teardrop handle with automotive slam-to-shut latches",
              "Standard included feature on Ranch Fusion and Ranch Icon"
            ],
            ideal_for: "Luxury SUV look, streamlined aesthetics, single-hand opening"
          }
        }
      ];
    } else {
      if (!state.options.rear_door || (state.options.rear_door !== "rear_framed_dual_t" && state.options.rear_door !== "rear_frameless_slam_latch_upgrade")) {
        state.options.rear_door = "rear_framed_dual_t";
      }
      availableRearDoors = [
        {
          id: "rear_framed_dual_t",
          name: "Heavy-Duty Framed Glass Door (Dual T-Locks)",
          tier: "silver",
          price: 0,
          image: "images/options/rear_framed_thandled.webp",
          desc: "Extruded aluminum framed safety glass with dual metal rotary T-handles (Standard / Included).",
          what_you_get: {
            benefits: [
              "Dual mechanical locking rods engage both truck bed sides",
              "Heavy-duty aluminum perimeter frame for extreme durability",
              "Standard included feature on Ranch Echo, Sierra & Skyline"
            ],
            ideal_for: "Daily work, trades, fleets, rugged reliability"
          }
        },
        {
          id: "rear_frameless_slam_latch_upgrade",
          name: "⚡ Frameless All-Glass Door (Requires Ranch Fusion / Icon)",
          tier: "gold",
          price: 325,
          image: "images/options/rear_frameless_slam.webp",
          desc: "Single center teardrop handle with frameless curved dark tint glass. Requires upgrading cap model to Ranch Fusion or Ranch Icon.",
          what_you_get: {
            benefits: [
              "Single center teardrop handle with automotive slam-to-shut latching",
              "Frameless edge-to-edge dark tint curved glass",
              "Requires upgrade to Ranch Fusion or Ranch Icon"
            ],
            ideal_for: "Upgrade to Ranch Fusion or Ranch Icon"
          }
        }
      ];
    }

    renderTileGrid("rearDoorGrid", availableRearDoors, state.options.rear_door, (id) => {
      if (id === "rear_frameless_slam_latch_upgrade" || (id === "rear_frameless_slam_latch" && !framelessModels.includes(state.model_id))) {
        state.options.rear_door = "rear_frameless_slam_latch_upgrade";
        const curModel = LTA_MODELS.find((m) => m.id === state.model_id);
        renderInlineUpgradeCard("rearDoorInlineUpgradeContainer", {
          title: "Frameless All-Glass Door requires Ranch Fusion or Ranch Icon",
          explanation: `The Frameless Curved All-Glass Rear Door with single center teardrop handle is exclusive to our frameless series and cannot be installed on the <b>${curModel ? curModel.name : "Ranch Echo"}</b>.<br><br><b>Choose an upgrade model below to equip this door, or click the Heavy-Duty Framed Door above to continue on Ranch Echo:</b>`,
          targetOptions: { rear_door: "rear_frameless_slam_latch" },
          upgradeModelIds: ["ranch_fusion", "ranch_icon"]
        });
        renderOptions();
        recalculatePrice();
        checkFieldErrorsLive(3);
        return;
      }
      renderInlineUpgradeCard("rearDoorInlineUpgradeContainer", null);
      state.options.rear_door = id;
      renderOptions();
      recalculatePrice();
      checkFieldErrorsLive(3);
    });

    // Roof Structure Reinforcement (Triggers Upgrade Prompt for 600 lb Commercial Load)
    const commercialModels = ["ranch_workforce", "ranch_pro_series", "unicover_heavy_duty", "swiss_heavy_duty"];
    let availableRoofStructures;
    if (commercialModels.includes(state.model_id)) {
      availableRoofStructures = OPTIONS_CATALOG.roof_reinforcement;
    } else {
      if (!state.options.roof_reinforcement || state.options.roof_reinforcement === "hd_600lb_roof_reinforce") {
        state.options.roof_reinforcement = "roof_standard_honeycomb";
      }
      availableRoofStructures = [
        {
          id: "roof_standard_honeycomb",
          name: "Standard Honeycomb Reinforced Roof",
          tier: "silver",
          price: 0,
          image: "images/options/roof_heavy_reinforce.webp",
          desc: "Multi-layer fiberglass honeycomb sandwich construction rated for standard recreational crossbars and 200 lb dynamic load.",
          what_you_get: {
            benefits: ["Factory standard structural integrity", "Ideal for Yakima/Thule kayak and ski racks"],
            ideal_for: "Recreational camping, bikes, kayaks, roof tents up to 200 lb"
          }
        },
        {
          id: "hd_600lb_roof_reinforce_upgrade",
          name: "⚡ 600 lb Commercial HD Skeleton (Requires Ranch WorkForce)",
          tier: "gold",
          price: 385,
          image: "images/options/roof_heavy_reinforce.webp",
          desc: "Internal galvanized tubular steel skeletal framework supporting 600 lb contractor ladder racks. Requires Ranch WorkForce.",
          what_you_get: {
            benefits: ["Contractor-grade 600 lb commercial load rating", "Requires Ranch WorkForce or Pro Series"],
            ideal_for: "Heavy contractor trades, lumber, extension ladders"
          }
        }
      ];
    }

    renderTileGrid("roofReinforceGrid", availableRoofStructures, state.options.roof_reinforcement, (id) => {
      if (id === "hd_600lb_roof_reinforce_upgrade" || (id === "hd_600lb_roof_reinforce" && !commercialModels.includes(state.model_id))) {
        state.options.roof_reinforcement = "hd_600lb_roof_reinforce_upgrade";
        const curModel = LTA_MODELS.find((m) => m.id === state.model_id);
        renderInlineUpgradeCard("roofReinforceInlineUpgradeContainer", {
          title: "600 lb Commercial HD Roof Skeleton requires Commercial Cap",
          explanation: `The 600 lb internal reinforced roof skeleton is engineered for commercial trades and contractor upfits. It cannot be added to the <b>${curModel ? curModel.name : "recreational cap"}</b>.<br><br><b>Choose a commercial model below to add 600 lb roof capacity:</b>`,
          targetOptions: { roof_reinforcement: "hd_600lb_roof_reinforce" },
          upgradeModelIds: ["ranch_workforce", "ranch_pro_series"]
        });
        renderOptions();
        recalculatePrice();
        checkFieldErrorsLive(4);
        return;
      }
      renderInlineUpgradeCard("roofReinforceInlineUpgradeContainer", null);
      state.options.roof_reinforcement = id;
      renderOptions();
      recalculatePrice();
      checkFieldErrorsLive(4);
    });

    // Roof Rack
    renderTileGrid("roofRackGrid", OPTIONS_CATALOG.roof_racks, state.options.roof_rack, (id) => {
      state.options.roof_rack = id;
      renderOptions();
      updateVisualizer();
      recalculatePrice();
      checkFieldErrorsLive(4);
    });

    // Official 8-Tier Lighting Packages
    const activeLightingId = state.options.lighting_package || state.options.interior_lighting || "pkg_1_no_lights";
    renderTileGrid("lightingGrid", OPTIONS_CATALOG.lighting_packages, activeLightingId, (id) => {
      state.options.lighting_package = id;
      state.options.interior_lighting = id;
      renderOptions();
      recalculatePrice();
      checkFieldErrorsLive(4);
    });

    // Cap-Pack Ceiling Storage Systems
    renderTileGrid("capPackGrid", OPTIONS_CATALOG.cap_packs, state.options.cap_pack_system, (id) => {
      state.options.cap_pack_system = id;
      renderOptions();
      recalculatePrice();
      checkFieldErrorsLive(4);
    });

    // Side Tool Boxes & Shelving Storage (Compatible on Fiberglass caps, Aluminum HD, and Ranch WorkForce)
    const toolboxCompatibleModels = [
      "ranch_icon", "ranch_icon_premier", "ranch_fusion", "ranch_fusion_classic",
      "ranch_echo", "ranch_sierra", "ranch_sierra_xtra", "ranch_skyline", "venturous_ozark",
      "unicover_heavy_duty", "swiss_heavy_duty", "ranch_workforce"
    ];
    const fiberglassModels = [
      "ranch_icon", "ranch_icon_premier", "ranch_fusion", "ranch_fusion_classic",
      "ranch_echo", "ranch_sierra", "ranch_sierra_xtra", "ranch_skyline", "venturous_ozark"
    ];
    const isFiberglass = fiberglassModels.includes(state.model_id);
    const isToolboxCompatible = toolboxCompatibleModels.includes(state.model_id);

    const toolboxSection = document.getElementById("sectionSideToolbox");
    const reinforceNotice = document.getElementById("toolboxReinforceNotice");
    if (reinforceNotice) {
      if (isFiberglass) {
        reinforceNotice.innerHTML = `ℹ️ <b>Shell Reinforcement:</b> Fiberglass caps require mandatory heavy-duty shell reinforcement (<b>+$50.00 per side</b>) when side toolboxes are added.`;
      } else {
        reinforceNotice.innerHTML = `ℹ️ <b>Shell Reinforcement:</b> Commercial Aluminum HD &amp; WorkForce shells are <b>exempt</b> from reinforcement fees ($0.00).`;
      }
    }

    if (toolboxSection) {
      if (isToolboxCompatible) {
        toolboxSection.classList.remove("hidden");
        renderInlineUpgradeCard("toolboxInlineUpgradeContainer", null);

        // Driver Side Toolbox Grid
        const curDs = state.options.toolbox_driver || "toolbox_driver_none";
        renderTileGrid("driverToolboxGrid", OPTIONS_CATALOG.toolboxes_driver, curDs, (id) => {
          state.options.toolbox_driver = id;
          state.options.side_toolbox_driver = id !== "toolbox_driver_none";
          renderOptions();
          recalculatePrice();
          checkFieldErrorsLive(4);
        });

        // Passenger Side Toolbox Grid
        const curPs = state.options.toolbox_passenger || "toolbox_passenger_none";
        renderTileGrid("passengerToolboxGrid", OPTIONS_CATALOG.toolboxes_passenger, curPs, (id) => {
          state.options.toolbox_passenger = id;
          state.options.side_toolbox_passenger = id !== "toolbox_passenger_none";
          renderOptions();
          recalculatePrice();
          checkFieldErrorsLive(4);
        });
      } else {
        toolboxSection.classList.add("hidden");
      }
    }

    // Decals & Wrap Rails (Internal Employee-only customization)
    const isEmployee = Boolean(
      window.IS_EMPLOYEE_MODE ||
      (typeof window !== "undefined" && (
        new URLSearchParams(window.location.search).get("employee") === "1" ||
        window.location.pathname.includes("employee")
      ))
    );
    const decalsSection = document.getElementById("sectionDecalsTrim");
    if (decalsSection) {
      if (isEmployee) {
        decalsSection.classList.remove("hidden");
        renderTileGrid("decalGrid", OPTIONS_CATALOG.decals, state.options.rear_decal, (id) => {
          state.options.rear_decal = id;
          renderOptions();
          recalculatePrice();
        });

        renderTileGrid("wrapRailGrid", OPTIONS_CATALOG.wrap_rails, state.options.wrap_rail_trim, (id) => {
          state.options.wrap_rail_trim = id;
          renderOptions();
          recalculatePrice();
        });
      } else {
        decalsSection.classList.add("hidden");
      }
    }
  }
}

function renderTileGrid(containerId, items, selectedId, onSelect) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";

  items.forEach((item) => {
    const isSelected = item.id === selectedId;
    const isPendingUpgrade = item.id.includes("upgrade") && isSelected;
    const tierClass = item.tier ? `tier-${item.tier}` : "";
    const tile = document.createElement("div");
    tile.className = `option-tile ${tierClass} ${isSelected ? "active" : ""} ${isPendingUpgrade ? "pending-upgrade" : ""}`;
    tile.dataset.id = item.id;
    tile.onclick = () => {
      onSelect(item.id);
      saveStateToStorage();
    };

    const priceText = item.price === 0
      ? "INCLUDED ($0)"
      : item.price < 0
      ? `-$${Math.abs(item.price).toLocaleString()} (Save $${Math.abs(item.price)})`
      : `+$${item.price.toLocaleString()}`;
    const priceClass = item.price < 0 ? "opt-price opt-credit" : "opt-price";

    const tierBadge = item.tier
      ? `<span class="model-tier-badge tier-${item.tier}-badge">${item.tier.toUpperCase()} TIER</span>`
      : "";

    tile.innerHTML = `
      <div>
        <div class="option-tile-header">
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span class="opt-name">${item.name}</span>
            ${tierBadge}
          </div>
          <span class="${priceClass}">${priceText}</span>
        </div>
        <p class="opt-desc">${item.desc}</p>
      </div>
      ${item.what_you_get ? `
        <button class="btn-what-you-get" onclick="event.stopPropagation(); showWhatYouGet('option', '${item.id}')">
          🔍 What You Get
        </button>
      ` : ""}
    `;
    container.appendChild(tile);
  });
}

// Sanitize active options to conform strictly to the active cap model
function sanitizeOptionsForModel(modelId) {
  if (!modelId) return;
  const framelessModels = ["ranch_icon", "ranch_icon_premier", "ranch_fusion", "ranch_fusion_classic", "venturous_ozark"];
  const commercialModels = ["ranch_workforce", "ranch_pro_series", "unicover_heavy_duty", "swiss_heavy_duty"];
  const isLid = ["ranch_legacy_lid", "ranch_sportwrap_lid", "ranch_fusion_lid", "unicover_aurora_lid"].includes(modelId);
  const isAluminum = ["ranch_pro_series", "unicover_light_duty", "unicover_heavy_duty", "swiss_heavy_duty"].includes(modelId);

  // 1. Frameless Rear Door & Keyless Remote
  if (!framelessModels.includes(modelId) && !isLid) {
    if (state.options.rear_door === "rear_frameless_slam_latch") {
      state.options.rear_door = "rear_framed_dual_t";
    }
    state.options.keyless_remote = false;
  }

  // 2. Commercial 600lb roof structure and toolboxes
  if (!commercialModels.includes(modelId)) {
    if (state.options.roof_reinforcement === "hd_600lb_roof_reinforce") {
      state.options.roof_reinforcement = "roof_standard_honeycomb";
    }
    state.options.side_toolbox = "toolbox_none";
    state.options.side_toolbox_driver = false;
    state.options.side_toolbox_passenger = false;
    state.options.interior_hd_chop_roof = false;
  }

  // 3. SportWrap headliner
  if (modelId === "ranch_sportwrap_lid") {
    state.options.carpet_headliner = false;
  }

  // 4. Double aluminum cargo doors
  if (!isAluminum && state.options.rear_door === "rear_commercial_double") {
    state.options.rear_door = "rear_framed_dual_t";
  }
}

// Select Model
function selectModel(modelId) {
  state.model_id = modelId;
  sanitizeOptionsForModel(modelId);
  renderModels();
  renderOptions();
  updateVisualizer();
  recalculatePrice();
  saveStateToStorage();
  checkFieldErrorsLive(2);
}

// Toggle Error Badge on field
function toggleBadge(elementId, isMissing, showErrors, customErrorText) {
  const el = document.getElementById(elementId);
  if (!el) return;
  if (showErrors && isMissing) {
    el.classList.add("visible-error");
    if (customErrorText) el.innerText = customErrorText;
    else el.innerText = "* REQUIRED";
  } else {
    el.classList.remove("visible-error");
  }
}

// Validate a specific step (returns boolean isValid and array of missing field labels)
function validateStep(stepNumber, showErrors = false) {
  if (stepNumber === 1) {
    const vinInput = document.getElementById("vehVin");
    const currentVin = vinInput && vinInput.value ? vinInput.value.trim().toUpperCase() : (state.vehicle.vin || "").trim().toUpperCase();
    state.vehicle.vin = currentVin;

    const isBypass = currentVin === "TESTING" || currentVin === "OVERRIDE";
    const vinValid = isBypass || isValidVIN(currentVin);
    const vinMissing = !vinValid;

    // Sync DOM fields into state
    const vehMake = document.getElementById("vehMake");
    const vehModel = document.getElementById("vehModel");
    const vehYear = document.getElementById("vehYear");
    const vehBed = document.getElementById("vehBed");

    if (vehMake && vehMake.value) state.vehicle.make = vehMake.value;
    if (vehModel && vehModel.value) state.vehicle.model = vehModel.value;
    if (vehYear && vehYear.value) state.vehicle.year = vehYear.value;
    if (vehBed && vehBed.value) state.vehicle.bed_size = vehBed.value;

    if (isBypass) {
      state.vehicle.make = state.vehicle.make || "Ford";
      state.vehicle.model = state.vehicle.model || "F-150";
      state.vehicle.year = state.vehicle.year || "2024";
      state.vehicle.bed_size = state.vehicle.bed_size || "5.5ft";
      state.vehicle.paint_code = state.vehicle.paint_code || "YZ";
      state.vehicle.paint_name = state.vehicle.paint_name || "Oxford White";
      state.vehicle.paint_hex = state.vehicle.paint_hex || "#FFFFFF";
    }

    const makeMissing = !state.vehicle.make;
    const modelMissing = !state.vehicle.model;
    const yearMissing = !state.vehicle.year;
    const bedMissing = !state.vehicle.bed_size;
    const paintMissing = !state.vehicle.paint_code || state.vehicle.paint_code.trim().length === 0;

    toggleBadge("req-vehVin", vinMissing, showErrors, state.vehicle.vin && state.vehicle.vin.trim().length > 0 && !isBypass ? "* INVALID VIN (CHECKSUM FAILED)" : "* REQUIRED");
    toggleBadge("req-vehMake", makeMissing, showErrors);
    toggleBadge("req-vehModel", modelMissing, showErrors);
    toggleBadge("req-vehYear", yearMissing, showErrors);
    toggleBadge("req-vehBed", bedMissing, showErrors);
    toggleBadge("req-paintColor", paintMissing, showErrors);

    if (vinInput) {
      if (showErrors && vinMissing) vinInput.classList.add("input-error");
      else vinInput.classList.remove("input-error");
    }

    const missing = [];
    if (vinMissing) missing.push("Valid 17-Character VIN");
    if (makeMissing) missing.push("Truck Manufacturer");
    if (modelMissing) missing.push("Truck Model");
    if (yearMissing) missing.push("Model Year");
    if (bedMissing) missing.push("Bed Length Selection");
    if (paintMissing) missing.push("Factory OEM Paint Color / Custom Code");

    const errBox = document.getElementById("step1ErrorBox");
    if (errBox) {
      if (showErrors && missing.length > 0) {
        errBox.classList.remove("hidden");
        errBox.innerHTML = `⚠️ <b>REQUIRED SELECTIONS MISSING:</b> Please complete all required fields marked in red:<br>• ${missing.join("<br>• ")}`;
      } else if (missing.length === 0) {
        errBox.classList.add("hidden");
      }
    }

    return missing.length === 0;
  }

  if (stepNumber === 2) {
    const modelMissing = !state.model_id;
    toggleBadge("req-capModel", modelMissing, showErrors);

    const errBox = document.getElementById("step2ErrorBox");
    if (errBox) {
      if (showErrors && modelMissing) {
        errBox.classList.remove("hidden");
        errBox.innerHTML = `⚠️ <b>CAP MODEL REQUIRED:</b> Please select an LTA truck cap model to proceed.`;
      } else if (!modelMissing) {
        errBox.classList.add("hidden");
      }
    }

    return !modelMissing;
  }

  if (stepNumber === 3) {
    const isLid = state.model_id === "ranch_fusion_lid" || state.model_id === "unicover_aurora_lid";
    if (isLid) {
      const lockMissing = !state.options.tonneau_locking;
      const lightMissing = !state.options.tonneau_lighting;
      toggleBadge("req-tonneauLocking", lockMissing, showErrors);
      toggleBadge("req-tonneauLighting", lightMissing, showErrors);
      const missing = [];
      if (lockMissing) missing.push("Locking & Security Mechanism");
      if (lightMissing) missing.push("Under-Cover Lighting System");
      const errBox = document.getElementById("step3ErrorBox");
      if (errBox) {
        if (showErrors && missing.length > 0) {
          errBox.classList.remove("hidden");
          errBox.innerHTML = `⚠️ <b>TONNEAU SPECIFICATIONS REQUIRED:</b> Please choose an option for each section:<br>• ${missing.join("<br>• ")}`;
        } else if (missing.length === 0) {
          errBox.classList.add("hidden");
        }
      }
      return missing.length === 0;
    }

    const isAluminum = ["unicover_light_duty", "unicover_heavy_duty", "swiss_heavy_duty"].includes(state.model_id);
    if (isAluminum) {
      const heightMissing = !state.options.aluminum_height;
      const sideMissing = !state.options.aluminum_side_layout;
      const colorMissing = !state.options.aluminum_color;

      toggleBadge("req-aluminumHeight", heightMissing, showErrors);
      toggleBadge("req-aluminumSideLayout", sideMissing, showErrors);
      toggleBadge("req-aluminumColor", colorMissing, showErrors);

      const missing = [];
      if (heightMissing) missing.push("Aluminum Height Profile");
      if (sideMissing) missing.push("Side Window & Utility Door Layout");
      if (colorMissing) missing.push("Aluminum Exterior Color");

      const errBox = document.getElementById("step3ErrorBox");
      if (errBox) {
        if (showErrors && missing.length > 0) {
          errBox.classList.remove("hidden");
          errBox.innerHTML = `⚠️ <b>ALUMINUM SPECIFICATIONS REQUIRED:</b> Please choose an option for each section:<br>• ${missing.join("<br>• ")}`;
        } else if (missing.length === 0) {
          errBox.classList.add("hidden");
        }
      }
      return missing.length === 0;
    }

    const framelessModels = ["ranch_icon", "ranch_icon_premier", "ranch_fusion", "ranch_fusion_classic", "venturous_ozark"];
    const isFramelessDoorOnFramedModel = (state.options.rear_door === "rear_frameless_slam_latch_upgrade" || state.options.rear_door === "rear_frameless_slam_latch") && !framelessModels.includes(state.model_id);

    const driverMissing = !state.options.side_windows_driver;
    const passengerMissing = !state.options.side_windows_passenger;
    const frontMissing = !state.options.front_window;
    const rearMissing = !state.options.rear_door || state.options.rear_door === "rear_frameless_slam_latch_upgrade";

    toggleBadge("req-driverSide", driverMissing, showErrors);
    toggleBadge("req-passengerSide", passengerMissing, showErrors);
    toggleBadge("req-frontWindow", frontMissing, showErrors);
    toggleBadge("req-rearDoor", rearMissing || isFramelessDoorOnFramedModel, showErrors);

    const missing = [];
    if (driverMissing) missing.push("Driver-Side Access Window");
    if (passengerMissing) missing.push("Passenger-Side Access Window");
    if (frontMissing) missing.push("Front Cab Window");
    if (!state.options.rear_door) missing.push("Rear Door Access");
    if (isFramelessDoorOnFramedModel) missing.push("Cap Model Upgrade Required: You selected the Frameless Rear Door on a Ranch Echo. Please upgrade to Ranch Fusion or Ranch Icon below, or click the Heavy-Duty Framed Glass Door above.");

    const errBox = document.getElementById("step3ErrorBox");
    if (errBox) {
      if (showErrors && (missing.length > 0 || isFramelessDoorOnFramedModel)) {
        errBox.classList.remove("hidden");
        errBox.innerHTML = `⚠️ <b>REQUIRED ACTION:</b> Please resolve the following before continuing:<br>• ${missing.join("<br>• ")}`;
      } else if (missing.length === 0 && !isFramelessDoorOnFramedModel) {
        errBox.classList.add("hidden");
      }
    }

    if (isFramelessDoorOnFramedModel) {
      const curModel = LTA_MODELS.find((m) => m.id === state.model_id);
      renderInlineUpgradeCard("rearDoorInlineUpgradeContainer", {
        title: "Frameless All-Glass Door requires Ranch Fusion or Ranch Icon",
        explanation: `The Frameless Curved All-Glass Rear Door cannot be fitted to the <b>${curModel ? curModel.name : "Ranch Echo"}</b>.<br><br><b>Please click an upgrade button below to switch your build to Ranch Fusion or Ranch Icon, or click the Heavy-Duty Framed Door above to continue with your Ranch Echo build:</b>`,
        targetOptions: { rear_door: "rear_frameless_slam_latch" },
        upgradeModelIds: ["ranch_fusion", "ranch_icon"]
      });
      return false;
    }

    return missing.length === 0;
  }

  if (stepNumber === 4) {
    const isLid = state.model_id === "ranch_fusion_lid" || state.model_id === "unicover_aurora_lid";
    if (isLid) {
      const rackMissing = state.options.tonneau_rack === null;
      toggleBadge("req-tonneauRack", rackMissing, showErrors);
      const missing = [];
      if (rackMissing) missing.push("Over-Lid Crossbar Rack System");
      const errBox = document.getElementById("step4ErrorBox");
      if (errBox) {
        if (showErrors && missing.length > 0) {
          errBox.classList.remove("hidden");
          errBox.innerHTML = `⚠️ <b>TONNEAU ACCESSORIES REQUIRED:</b> Please select a rack option:<br>• ${missing.join("<br>• ")}`;
        } else if (missing.length === 0) {
          errBox.classList.add("hidden");
        }
      }
      return missing.length === 0;
    }

    const isAluminum = ["unicover_light_duty", "unicover_heavy_duty", "swiss_heavy_duty"].includes(state.model_id);
    if (isAluminum) {
      const reinforceMissing = state.options.roof_reinforcement === null;
      const rackMissing = state.options.roof_rack === null;
      const lightingMissing = state.options.lighting_package === null && state.options.interior_lighting === null;
      const toolboxMissing = state.options.side_toolbox === null;

      toggleBadge("req-roofReinforce", reinforceMissing, showErrors);
      toggleBadge("req-roofRack", rackMissing, showErrors);
      toggleBadge("req-lighting", lightingMissing, showErrors);
      toggleBadge("req-sideToolbox", toolboxMissing, showErrors);

      const missing = [];
      if (reinforceMissing) missing.push("Roof Structure & Reinforcement");
      if (rackMissing) missing.push("Roof Rack System Selection");
      if (lightingMissing) missing.push("Official Interior Lighting Package");
      if (toolboxMissing) missing.push("Commercial Side Tool Boxes Selection");

      const errBox = document.getElementById("step4ErrorBox");
      if (errBox) {
        if (showErrors && missing.length > 0) {
          errBox.classList.remove("hidden");
          errBox.innerHTML = `⚠️ <b>COMMERCIAL ACCESSORIES REQUIRED:</b> Please complete all required items:<br>• ${missing.join("<br>• ")}`;
        } else if (missing.length === 0) {
          errBox.classList.add("hidden");
        }
      }
      return missing.length === 0;
    }

    const commercialModels = ["ranch_workforce", "ranch_pro_series", "unicover_heavy_duty", "swiss_heavy_duty"];
    const framelessModels = ["ranch_icon", "ranch_icon_premier", "ranch_fusion", "ranch_fusion_classic", "venturous_ozark"];
    const toolboxCompatibleModels = [
      "ranch_icon", "ranch_icon_premier", "ranch_fusion", "ranch_fusion_classic",
      "ranch_echo", "ranch_sierra", "ranch_sierra_xtra", "ranch_skyline", "venturous_ozark",
      "unicover_heavy_duty", "swiss_heavy_duty", "ranch_workforce"
    ];

    const isHdRoofOnRecreational = (state.options.roof_reinforcement === "hd_600lb_roof_reinforce_upgrade" || state.options.roof_reinforcement === "hd_600lb_roof_reinforce") && !commercialModels.includes(state.model_id);
    const isKeylessOnFramed = state.options.keyless_remote && !framelessModels.includes(state.model_id);

    const reinforceMissing = state.options.roof_reinforcement === null || state.options.roof_reinforcement === "hd_600lb_roof_reinforce_upgrade";
    const rackMissing = state.options.roof_rack === null;
    const lightingMissing = state.options.lighting_package === null && state.options.interior_lighting === null;
    const capPackMissing = state.options.cap_pack_system === null;
    const dsToolboxMissing = toolboxCompatibleModels.includes(state.model_id) && !state.options.toolbox_driver;
    const psToolboxMissing = toolboxCompatibleModels.includes(state.model_id) && !state.options.toolbox_passenger;

    toggleBadge("req-roofReinforce", reinforceMissing || isHdRoofOnRecreational, showErrors);
    toggleBadge("req-roofRack", rackMissing, showErrors);
    toggleBadge("req-lighting", lightingMissing, showErrors);
    toggleBadge("req-capPack", capPackMissing, showErrors);
    toggleBadge("req-driverToolbox", dsToolboxMissing, showErrors);
    toggleBadge("req-passengerToolbox", psToolboxMissing, showErrors);

    const missing = [];
    if (!state.options.roof_reinforcement) missing.push("Roof Structure & Reinforcement");
    if (rackMissing) missing.push("Roof Rack System Selection");
    if (lightingMissing) missing.push("Official Interior Lighting Package");
    if (capPackMissing) missing.push("Cap-Pack Storage Selection");
    if (dsToolboxMissing) missing.push("Driver-Side Toolbox Selection");
    if (psToolboxMissing) missing.push("Passenger-Side Toolbox Selection");
    if (isHdRoofOnRecreational) missing.push("Commercial Model Upgrade Required: 600 lb roof requires Ranch WorkForce or Pro Series");
    if (isKeylessOnFramed) missing.push("Model Upgrade Required: Keyless Remote requires Ranch Fusion or Icon");

    const errBox = document.getElementById("step4ErrorBox");
    if (errBox) {
      if (showErrors && (missing.length > 0 || isHdRoofOnRecreational || isKeylessOnFramed)) {
        errBox.classList.remove("hidden");
        errBox.innerHTML = `⚠️ <b>REQUIRED ACTION:</b> Please resolve the following before continuing:<br>• ${missing.join("<br>• ")}`;
      } else if (missing.length === 0) {
        errBox.classList.add("hidden");
      }
    }

    if (isHdRoofOnRecreational) {
      renderInlineUpgradeCard("roofReinforceInlineUpgradeContainer", {
        title: "600 lb Commercial HD Roof Skeleton requires Commercial Cap",
        explanation: `The 600 lb internal reinforced roof skeleton is engineered for commercial trades and contractor upfits. Upgrade to the <b>Ranch WorkForce</b> (Fiberglass) or <b>Ranch Pro Series</b> (Aluminum) to add 600 lb load capacity:`,
        targetOptions: { roof_reinforcement: "hd_600lb_roof_reinforce" },
        upgradeModelIds: ["ranch_workforce", "ranch_pro_series"]
      });
      return false;
    }

    if (isKeylessOnFramed) {
      renderInlineUpgradeCard("keylessInlineUpgradeContainer", {
        title: "Remote Keyless Entry requires Ranch Fusion or Ranch Icon",
        explanation: `Remote Keyless Entry requires a single-handle frameless all-glass rear door. Upgrade to the <b>Ranch Fusion</b> or <b>Ranch Icon</b> to unlock keyless entry:`,
        targetOptions: { keyless_remote: true, rear_door: "rear_frameless_slam_latch" },
        upgradeModelIds: ["ranch_fusion", "ranch_icon"]
      });
      return false;
    }

    return missing.length === 0;
  }

  if (stepNumber === 5) {
    state.options.installation_preference = "pro_install_seneca";
    const custName = document.getElementById("custName");
    const custEmail = document.getElementById("custEmail");
    const custPhone = document.getElementById("custPhone");
    const custZip = document.getElementById("custZip");
    const custUse = document.getElementById("custUse");
    const custContactPref = document.getElementById("custContactPref");

    const nameMissing = !custName || !custName.value.trim();
    const emailMissing = !custEmail || !custEmail.value.trim() || !custEmail.value.includes("@");
    const phoneMissing = !custPhone || !custPhone.value.trim();
    const zipMissing = !custZip || !custZip.value.trim();
    const useMissing = !custUse || !custUse.value;
    const contactMissing = !custContactPref || !custContactPref.value;

    toggleBadge("req-custName", nameMissing, showErrors);
    toggleBadge("req-custEmail", emailMissing, showErrors);
    toggleBadge("req-custPhone", phoneMissing, showErrors);
    toggleBadge("req-custZip", zipMissing, showErrors);
    toggleBadge("req-custUse", useMissing, showErrors);
    toggleBadge("req-custContactPref", contactMissing, showErrors);

    const missing = [];
    if (nameMissing) missing.push("Full Name");
    if (emailMissing) missing.push("Email Address");
    if (phoneMissing) missing.push("Phone Number");
    if (zipMissing) missing.push("Zip Code");
    if (useMissing) missing.push("Primary Vehicle Use");
    if (contactMissing) missing.push("Preferred Contact Method");

    const errBox = document.getElementById("step5ErrorBox");
    if (errBox) {
      if (showErrors && missing.length > 0) {
        errBox.classList.remove("hidden");
        errBox.innerHTML = `⚠️ <b>REQUIRED FIELDS MISSING:</b> Please complete all required items marked in red:<br>• ${missing.join("<br>• ")}`;
      } else if (missing.length === 0) {
        errBox.classList.add("hidden");
      }
    }

    return missing.length === 0;
  }

  return true;
}

// Live error check on interaction (removes red tag as soon as valid info is chosen)
function checkFieldErrorsLive(stepNumber) {
  if (stepSubmitted[stepNumber]) {
    validateStep(stepNumber, true);
  }
}

// Auto-Decode VIN via backend proxy & NHTSA VPIC
async function performVinDecode(vin) {
  const btnVinDecode = document.getElementById("btnVinDecode");
  const vehMake = document.getElementById("vehMake");
  const vehModel = document.getElementById("vehModel");
  const vehYear = document.getElementById("vehYear");
  const vehVin = document.getElementById("vehVin");

  const clean = (vin || "").trim().toUpperCase();
  const isBypass = ["TESTING", "TEST", "OVERRIDE", "BYPASS"].includes(clean);

  if (isBypass) {
    state.vehicle.vin = clean;
    if (vehVin) vehVin.value = clean;

    if (!state.vehicle.make) {
      state.vehicle.make = "Ford";
      if (vehMake) vehMake.value = "Ford";
      updateModelsDropdown("Ford", "F-150");

      state.vehicle.model = "F-150";
      if (vehModel) vehModel.value = "F-150";

      state.vehicle.year = "2024";
      populateYearDropdown("2024");
      if (vehYear) vehYear.value = "2024";

      updateBedSizesDropdown("Ford", "F-150", "5.5ft");
      state.vehicle.bed_size = "5.5ft";

      state.vehicle.paint_code = "YZ";
      state.vehicle.paint_name = "Oxford White";
      state.vehicle.paint_hex = "#FFFFFF";
      updateColorSwatches("Ford", "F-150", "2024", "YZ");
    } else {
      const make = state.vehicle.make;
      const model = state.vehicle.model || (vehModel && vehModel.value) || "F-150";
      const year = state.vehicle.year || (vehYear && vehYear.value) || "2024";
      
      populateYearDropdown(year);
      if (vehYear) vehYear.value = year;
      state.vehicle.year = year;
      
      updateBedSizesDropdown(make, model, state.vehicle.bed_size);
      updateColorSwatches(make, model, year, state.vehicle.paint_code);
    }

    renderModels();
    updateSpecsBadge();
    updateVisualizer();
    recalculatePrice();

    const banner = document.getElementById("ruleAlertBanner");
    if (banner) {
      banner.classList.remove("hidden");
      if (clean === "OVERRIDE" || clean === "BYPASS") {
        banner.innerHTML = `<div>⚡ <b>OVERRIDE BYPASS ACTIVE:</b> VIN verification bypassed for override! Vehicle fitment and availability of product cannot be guaranteed.</div>`;
      } else {
        banner.innerHTML = `<div>⚡ <b>TESTING BYPASS ACTIVE:</b> VIN verification bypassed for testing! ${state.vehicle.year} ${state.vehicle.make} ${state.vehicle.model} configured.</div>`;
      }
    }

    // Clear step 1 errors
    toggleBadge("req-vehVin", false);
    toggleBadge("req-vehMake", false);
    toggleBadge("req-vehModel", false);
    toggleBadge("req-vehYear", false);
    toggleBadge("req-vehBed", false);
    toggleBadge("req-paintColor", false);
    const errBox = document.getElementById("step1ErrorBox");
    if (errBox) errBox.classList.add("hidden");
    const vinInput = document.getElementById("vehVin");
    if (vinInput) vinInput.classList.remove("input-error");

    if (btnVinDecode) {
      btnVinDecode.style.background = "linear-gradient(135deg, #00E5FF, #00B4D8)";
      btnVinDecode.style.color = "#06090E";
      btnVinDecode.innerText = "✓ Bypass Active";
      setTimeout(() => {
        if (btnVinDecode) btnVinDecode.innerText = "🔍 Auto-Match Specs";
      }, 2000);
    }

    saveStateToStorage();
    return;
  }

  if (!isValidVIN(clean)) {
    alert("Please enter a valid 17-digit VIN. Checksum validation failed.");
    return;
  }

  if (btnVinDecode) btnVinDecode.innerText = "⏳ Decoding...";

  try {
    const res = await fetch(`${API_BASE}/api/configurator/decode-vin?vin=${clean}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.make) {
        let normalizedMake = data.make;
        const upper = data.make.toUpperCase();
        if (upper === "FORD") normalizedMake = "Ford";
        else if (upper === "CHEVROLET" || upper === "CHEVY") normalizedMake = "Chevrolet";
        else if (upper === "GMC") normalizedMake = "GMC";
        else if (upper === "RAM" || upper === "DODGE") normalizedMake = "Ram";
        else if (upper === "TOYOTA") normalizedMake = "Toyota";
        else if (upper === "JEEP") normalizedMake = "Jeep";

        state.vehicle.make = normalizedMake;
        if (vehMake) vehMake.value = normalizedMake;

        const targetModel = data.model || "F-150";
        updateModelsDropdown(normalizedMake, targetModel);

        if (data.year) {
          state.vehicle.year = data.year;
          populateYearDropdown(data.year);
        }

        updateColorSwatches(normalizedMake, targetModel, data.year || state.vehicle.year);
        updateSpecsBadge();
        checkFieldErrorsLive(1);
        const banner = document.getElementById("ruleAlertBanner");
        if (banner) {
          banner.classList.remove("hidden");
          banner.innerHTML = `<div>✅ <b>VIN VERIFIED:</b> Successfully matched ${data.year || ""} ${data.make} ${data.model || ""}!</div>`;
        }
      }
    }
  } catch (err) {
    console.warn("VIN decode fallback:", err);
  } finally {
    if (btnVinDecode) btnVinDecode.innerText = "🔍 Auto-Match Specs";
  }
}

// Attach Event Listeners
function attachEventListeners() {
  // Reset Configurator / Start Over button
  const resetBtn = document.getElementById("resetConfiguratorBtn");
  if (resetBtn) {
    resetBtn.onclick = () => resetConfigurator();
  }

  // Step Navigation buttons
  document.querySelectorAll(".step-btn").forEach((btn) => {
    btn.onclick = () => goToStep(parseInt(btn.dataset.step, 10));
  });

  document.querySelectorAll(".next-step-btn").forEach((btn) => {
    btn.onclick = () => goToStep(parseInt(btn.dataset.target, 10));
  });

  document.querySelectorAll(".prev-step-btn").forEach((btn) => {
    btn.onclick = () => goToStep(parseInt(btn.dataset.target, 10));
  });

  // VIN Entry (Spot #1)
  const vehVin = document.getElementById("vehVin");
  const btnVinDecode = document.getElementById("btnVinDecode");

  if (vehVin) {
    vehVin.oninput = () => {
      const val = vehVin.value.trim().toUpperCase();
      state.vehicle.vin = val;
      checkFieldErrorsLive(1);

      if (isValidVIN(val)) {
        if (btnVinDecode) {
          btnVinDecode.style.background = "linear-gradient(135deg, #00E5FF, #00B4D8)";
          btnVinDecode.style.color = "#06090E";
        }
        if (val.length === 17 && !state.vehicle.make) {
          performVinDecode(val);
        }
      }
    };
  }

  if (btnVinDecode) {
    btnVinDecode.onclick = () => {
      const vin = (vehVin ? vehVin.value : "").trim().toUpperCase();
      if (!vin) {
        alert("Please enter a VIN.");
        return;
      }
      performVinDecode(vin);
    };
  }

  // Vehicle dropdown changes
  const vehMake = document.getElementById("vehMake");
  const vehModel = document.getElementById("vehModel");
  const vehYear = document.getElementById("vehYear");

  if (vehMake) {
    vehMake.onchange = () => {
      state.vehicle.make = vehMake.value;
      updateModelsDropdown(vehMake.value);
      updateColorSwatches(vehMake.value, state.vehicle.model, state.vehicle.year);
      renderModels();
      updateSpecsBadge();
      saveStateToStorage();
      checkFieldErrorsLive(1);
    };
  }

  if (vehModel) {
    vehModel.onchange = () => {
      state.vehicle.model = vehModel.value;
      updateBedSizesDropdown(state.vehicle.make, vehModel.value);
      updateColorSwatches(state.vehicle.make, vehModel.value, state.vehicle.year);
      renderModels();
      updateSpecsBadge();
      saveStateToStorage();
      checkFieldErrorsLive(1);
    };
  }

  if (vehYear) {
    vehYear.onchange = () => {
      state.vehicle.year = vehYear.value;
      updateColorSwatches(state.vehicle.make, state.vehicle.model, vehYear.value);
      renderModels();
      updateSpecsBadge();
      saveStateToStorage();
      checkFieldErrorsLive(1);
    };
  }

  // Custom Paint Code Inputs
  const customPaintBox = document.getElementById("customPaintBox");
  const customPaintCode = document.getElementById("customPaintCode");
  const customPaintName = document.getElementById("customPaintName");

  if (customPaintCode) {
    customPaintCode.oninput = () => {
      const code = customPaintCode.value.trim().toUpperCase();
      state.vehicle.paint_code = code || "CUSTOM";
      state.vehicle.custom_paint_code = code;
      updateSpecsBadge();
      saveStateToStorage();
      checkFieldErrorsLive(1);
    };
  }

  if (customPaintName) {
    customPaintName.oninput = () => {
      const name = customPaintName.value.trim();
      state.vehicle.paint_name = name || "Custom OEM Paint";
      updateSpecsBadge();
      saveStateToStorage();
      checkFieldErrorsLive(1);
    };
  }

  // Toggles (with Incompatibility Detection & Inline Upgrade Cards)
  const chkKeyless = document.getElementById("chkKeylessRemote");
  if (chkKeyless) {
    chkKeyless.onchange = (e) => {
      const framelessModels = ["ranch_icon", "ranch_icon_premier", "ranch_fusion", "ranch_fusion_classic", "venturous_ozark", "ranch_legacy_lid", "ranch_sportwrap_lid", "ranch_fusion_lid", "unicover_aurora_lid"];
      if (!framelessModels.includes(state.model_id)) {
        if (e.target.checked) {
          state.options.keyless_remote = true;
          renderInlineUpgradeCard("keylessInlineUpgradeContainer", {
            title: "Remote Keyless Entry requires Ranch Fusion or Ranch Icon",
            explanation: "Remote Keyless Entry synchronizes your vehicle's OEM key fob to automatically lock and unlock your truck cap. This feature requires our single-handle frameless all-glass rear door.<br><br><b>Choose an upgrade model below to enable Remote Keyless Entry, or uncheck the toggle above to continue on your current model:</b>",
            targetOptions: { keyless_remote: true, rear_door: "rear_frameless_slam_latch" },
            upgradeModelIds: ["ranch_fusion", "ranch_icon"]
          });
        } else {
          state.options.keyless_remote = false;
          renderInlineUpgradeCard("keylessInlineUpgradeContainer", null);
        }
        saveStateToStorage();
        recalculatePrice();
        return;
      }
      renderInlineUpgradeCard("keylessInlineUpgradeContainer", null);
      state.options.keyless_remote = e.target.checked;
      saveStateToStorage();
      recalculatePrice();
    };
  }

  // Interior gear toggles
  const chkHeadliner = document.getElementById("chkHeadliner");
  if (chkHeadliner) {
    chkHeadliner.onchange = (e) => {
      const isIcon = state.model_id === "ranch_icon";
      const isOzark = state.model_id === "venturous_ozark";
      const isFusion = state.model_id === "ranch_fusion";
      const isSierraXtra = state.model_id === "ranch_sierra_xtra";
      const isLegacy = state.model_id === "ranch_legacy_lid";
      const isStdHeadlinerModel = isIcon || isOzark || isFusion || isSierraXtra || isLegacy;
      const curModel = LTA_MODELS.find((m) => m.id === state.model_id);
      const modelName = curModel ? curModel.name : "your cap";

      if (state.model_id === "ranch_sportwrap_lid") {
        if (e.target.checked) {
          state.options.carpet_headliner = true;
          renderInlineUpgradeCard("headlinerInlineUpgradeContainer", {
            title: "Carpet Headliner requires Ranch Legacy Tonneau",
            explanation: "The Ranch SportWrap tonneau is engineered with a smooth fiberglass underside. To include a full carpeted headliner, upgrade to the <b>Ranch Legacy Tonneau Cover</b>:",
            targetOptions: { carpet_headliner: true },
            upgradeModelIds: ["ranch_legacy_lid"]
          });
        } else {
          state.options.carpet_headliner = false;
          renderInlineUpgradeCard("headlinerInlineUpgradeContainer", null);
        }
        updateToggleBoxVisuals();
        saveStateToStorage();
        recalculatePrice();
        return;
      }

      // Confirmation safeguard when unchecking standard included headliner
      if (!e.target.checked && isStdHeadlinerModel) {
        const confirmed = confirm(`Are you sure you want to remove the Full Charcoal Carpet Interior Headliner included standard with the ${modelName}?`);
        if (!confirmed) {
          e.target.checked = true;
          updateToggleBoxVisuals();
          return;
        }
      }

      renderInlineUpgradeCard("headlinerInlineUpgradeContainer", null);
      state.options.carpet_headliner = e.target.checked;
      updateToggleBoxVisuals();
      saveStateToStorage();
      recalculatePrice();
    };
  }

  const chkCargoNet = document.getElementById("chkCargoNet");
  if (chkCargoNet) {
    chkCargoNet.onchange = (e) => {
      state.options.interior_cargo_net = e.target.checked;
      updateToggleBoxVisuals();
      saveStateToStorage();
      recalculatePrice();
    };
  }

  const chkUsbFuseBox = document.getElementById("chkUsbFuseBox");
  if (chkUsbFuseBox) {
    chkUsbFuseBox.onchange = (e) => {
      state.options.interior_usb_fuse_box = e.target.checked;
      updateToggleBoxVisuals();
      saveStateToStorage();
      recalculatePrice();
    };
  }

  const chkClothesHanger = document.getElementById("chkClothesHanger");
  if (chkClothesHanger) {
    chkClothesHanger.onchange = (e) => {
      state.options.interior_clothes_hanger = e.target.checked;
      updateToggleBoxVisuals();
      saveStateToStorage();
      recalculatePrice();
    };
  }

  const chkRodHolder = document.getElementById("chkRodHolder");
  if (chkRodHolder) {
    chkRodHolder.onchange = (e) => {
      state.options.interior_rod_holder = e.target.checked;
      updateToggleBoxVisuals();
      saveStateToStorage();
      recalculatePrice();
    };
  }

  const chkHdChopRoof = document.getElementById("chkHdChopRoof");
  if (chkHdChopRoof) {
    chkHdChopRoof.onchange = (e) => {
      const commercialModels = ["ranch_workforce", "ranch_pro_series", "unicover_heavy_duty", "swiss_heavy_duty"];
      if (e.target.checked && !commercialModels.includes(state.model_id)) {
        e.target.checked = false;
        showUpgradePrompt({
          title: "⚡ Heavy-Duty Chop Roof Upgrade",
          explanation: "Heavy-duty internal structural chop roof reinforcements require our commercial heavy-duty shells: the <b>Ranch WorkForce</b> (Commercial Fiberglass) or <b>Ranch Pro Series</b> (Commercial Aluminum).",
          targetOptions: { interior_hd_chop_roof: true },
          upgradeModelIds: ["ranch_workforce", "ranch_pro_series"]
        });
        updateToggleBoxVisuals();
        return;
      }
      state.options.interior_hd_chop_roof = e.target.checked;
      updateToggleBoxVisuals();
      saveStateToStorage();
      recalculatePrice();
    };
  }

  // Installation cards (Mandatory Seneca Shop Install)
  document.querySelectorAll(".install-card").forEach((card) => {
    card.onclick = () => {
      document.querySelectorAll(".install-card").forEach((c) => c.classList.remove("active"));
      card.classList.add("active");
      state.options.installation_preference = card.dataset.install;
      saveStateToStorage();
      recalculatePrice();
      checkFieldErrorsLive(5);
    };
  });

  // Step 5 input listeners for live error clearing and persistence
  const custName = document.getElementById("custName");
  if (custName) {
    custName.oninput = () => {
      state.customer.name = custName.value;
      saveStateToStorage();
      checkFieldErrorsLive(5);
    };
  }
  const custEmail = document.getElementById("custEmail");
  if (custEmail) {
    custEmail.oninput = () => {
      state.customer.email = custEmail.value;
      saveStateToStorage();
      checkFieldErrorsLive(5);
    };
  }
  const custPhone = document.getElementById("custPhone");
  if (custPhone) {
    custPhone.oninput = () => {
      state.customer.phone = custPhone.value;
      saveStateToStorage();
      checkFieldErrorsLive(5);
    };
  }
  const custZip = document.getElementById("custZip");
  if (custZip) {
    custZip.oninput = () => {
      state.customer.zip = custZip.value;
      saveStateToStorage();
      checkFieldErrorsLive(5);
    };
  }
  const custUse = document.getElementById("custUse");
  if (custUse) {
    custUse.onchange = () => {
      state.customer.use = custUse.value;
      saveStateToStorage();
      checkFieldErrorsLive(5);
    };
  }
  const custContactPref = document.getElementById("custContactPref");
  if (custContactPref) {
    custContactPref.onchange = () => {
      state.customer.contact_pref = custContactPref.value;
      saveStateToStorage();
      checkFieldErrorsLive(5);
    };
  }
}

// Dynamic Visual & Inclusions State for Toggle Boxes
function updateToggleBoxVisuals() {
  const isIcon = state.model_id === "ranch_icon";
  const isOzark = state.model_id === "venturous_ozark";
  const isFusion = state.model_id === "ranch_fusion";
  const isSierraXtra = state.model_id === "ranch_sierra_xtra";
  const isLegacy = state.model_id === "ranch_legacy_lid";
  const isStdHeadliner = isIcon || isOzark || isFusion || isSierraXtra || isLegacy;
  const curModel = LTA_MODELS.find((m) => m.id === state.model_id);
  const modelName = curModel ? curModel.name : "";

  // Headliner
  const chkHeadliner = document.getElementById("chkHeadliner");
  if (chkHeadliner) {
    const box = chkHeadliner.closest(".extra-toggle-box");
    if (box) {
      box.classList.toggle("is-checked", chkHeadliner.checked);
      box.classList.toggle("is-included", chkHeadliner.checked && isStdHeadliner);
    }

    const titleEl = document.getElementById("headlinerTitleWrap");
    const descEl = document.getElementById("headlinerDescWrap");
    if (titleEl && descEl) {
      if (isStdHeadliner && modelName) {
        titleEl.innerHTML = `<b>Full Charcoal Carpet Interior Headliner</b> <span class="badge-included-pill">✓ INCLUDED WITH ${modelName.toUpperCase()}</span>`;
        descEl.innerHTML = `<small class="included-desc">$0.00 (Standard included with ${modelName}) • Eliminates overnight condensation dripping & dampens road noise.</small>`;
      } else {
        titleEl.innerHTML = `<b>Full Charcoal Carpet Interior Headliner</b>`;
        descEl.innerHTML = `<small>+$175.00 • Eliminates overnight condensation dripping & dampens road noise.</small>`;
      }
    }
  }

  // Checkbox boxes styling
  ["chkCargoNet", "chkUsbFuseBox", "chkClothesHanger", "chkRodHolder", "chkHdChopRoof", "chkKeylessRemote"].forEach((id) => {
    const chk = document.getElementById(id);
    if (chk) {
      const box = chk.closest(".extra-toggle-box");
      if (box) {
        box.classList.toggle("is-checked", chk.checked);
      }
    }
  });
}

// Navigation Step Controller with Strict Validation Gating & History
function goToStep(targetStep) {
  if (!window.IS_EMPLOYEE_MODE && targetStep > state.currentStep) {
    // Validate every preceding step sequentially
    for (let s = 1; s < targetStep; s++) {
      stepSubmitted[s] = true;
      const isValid = validateStep(s, true);
      if (!isValid) {
        // Enforce remaining on the invalid step
        state.currentStep = s;
        document.querySelectorAll(".step-btn").forEach((b) => {
          b.classList.toggle("active", parseInt(b.dataset.step, 10) === s);
        });
        document.querySelectorAll(".step-pane").forEach((p) => {
          p.classList.toggle("active", p.id === `stepPane${s}`);
        });

        // Scroll directly to the inline upgrade container or error box
        const rearUpgrade = document.getElementById("rearDoorInlineUpgradeContainer");
        const roofUpgrade = document.getElementById("roofReinforceInlineUpgradeContainer");
        const toolboxUpgrade = document.getElementById("toolboxInlineUpgradeContainer");
        const errBox = document.getElementById(`step${s}ErrorBox`);

        if (rearUpgrade && !rearUpgrade.classList.contains("hidden")) {
          rearUpgrade.scrollIntoView({ behavior: "smooth", block: "center" });
        } else if (roofUpgrade && !roofUpgrade.classList.contains("hidden")) {
          roofUpgrade.scrollIntoView({ behavior: "smooth", block: "center" });
        } else if (toolboxUpgrade && !toolboxUpgrade.classList.contains("hidden")) {
          toolboxUpgrade.scrollIntoView({ behavior: "smooth", block: "center" });
        } else if (errBox && !errBox.classList.contains("hidden")) {
          errBox.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        return false;
      }
    }
  }

  state.currentStep = targetStep;
  document.querySelectorAll(".step-btn").forEach((b) => {
    b.classList.toggle("active", parseInt(b.dataset.step, 10) === targetStep);
  });
  document.querySelectorAll(".step-pane").forEach((p) => {
    p.classList.toggle("active", p.id === `stepPane${targetStep}`);
  });

  saveStateToStorage();

  try {
    if (history.state?.step !== targetStep) {
      history.pushState({ step: targetStep }, `Step ${targetStep}`, `#step-${targetStep}`);
    }
  } catch (e) {}

  window.scrollTo({ top: 0, behavior: "smooth" });
}

window.goToStep = goToStep;
window.state = state;
window.recalculatePrice = recalculatePrice;
window.updateVisualizer = updateVisualizer;

// Master OEM Paint Color Catalog (Matched by Make, Model, and Year)
const OEM_PAINT_CATALOG = {
  Ford: {
    default: [
      { code: "YZ", name: "Oxford White", hex: "#FFFFFF", years: [1990, 2030] },
      { code: "UM", name: "Agate Black Metallic", hex: "#141517", years: [2019, 2030] },
      { code: "M7", name: "Carbonized Gray Metallic", hex: "#525659", years: [2021, 2030] },
      { code: "JS", name: "Iconic Silver Metallic", hex: "#A8A9AD", years: [2020, 2030] },
      { code: "D4", name: "Rapid Red Metallic", hex: "#8C1D24", years: [2020, 2030] },
      { code: "HX", name: "Antimatter Blue Metallic", hex: "#1B263B", years: [2021, 2030] },
      { code: "B3", name: "Atlas Blue Metallic", hex: "#1E4E8C", years: [2022, 2030] },
      { code: "DR", name: "Avalanche Gray", hex: "#ADB4BC", years: [2023, 2030] },
      { code: "AZ", name: "Star White Metallic", hex: "#F5F7FA", years: [2020, 2030] },
      { code: "PQ", name: "Race Red", hex: "#C8221E", years: [2000, 2030] },
      { code: "D1", name: "Stone Gray Metallic", hex: "#6E665E", years: [2018, 2024] },
      { code: "G1", name: "Shadow Black", hex: "#111111", years: [2015, 2020] },
      { code: "J7", name: "Magnetic Metallic", hex: "#4B4F54", years: [2015, 2020] },
      { code: "UX", name: "Ingot Silver", hex: "#B7B9B8", years: [2010, 2019] },
      { code: "RR", name: "Ruby Red Metallic", hex: "#7D1C22", years: [2013, 2019] },
      { code: "N1", name: "Blue Jeans Metallic", hex: "#21334E", years: [2013, 2020] },
      { code: "E7", name: "Velocity Blue", hex: "#17539B", years: [2019, 2022] },
      { code: "JX", name: "Lead Foot Gray", hex: "#565A5E", years: [2018, 2021] }
    ],
    Maverick: [
      { code: "YZ", name: "Oxford White", hex: "#FFFFFF", years: [2022, 2030] },
      { code: "UM", name: "Shadow / Agate Black", hex: "#141517", years: [2022, 2030] },
      { code: "M7", name: "Carbonized Gray", hex: "#525659", years: [2022, 2030] },
      { code: "JS", name: "Iconic Silver", hex: "#A8A9AD", years: [2022, 2030] },
      { code: "KU", name: "Area 51", hex: "#596F7A", years: [2022, 2024] },
      { code: "NE", name: "Cactus Gray", hex: "#9DA79F", years: [2022, 2030] },
      { code: "SB", name: "Cyber Orange", hex: "#E89923", years: [2022, 2023] },
      { code: "D4", name: "Rapid Red Metallic", hex: "#8C1D24", years: [2022, 2030] },
      { code: "B3", name: "Atlas Blue Metallic", hex: "#1E4E8C", years: [2022, 2030] },
      { code: "E7", name: "Velocity Blue", hex: "#17539B", years: [2022, 2023] },
      { code: "DR", name: "Avalanche Gray", hex: "#ADB4BC", years: [2023, 2030] },
      { code: "EA", name: "Hot Pepper Red", hex: "#B52E1E", years: [2022, 2024] },
      { code: "FA", name: "Eruption Green", hex: "#234733", years: [2025, 2030] },
      { code: "VA", name: "Desert Sand", hex: "#B2A28C", years: [2024, 2030] },
      { code: "G4", name: "Azure Gray", hex: "#536B78", years: [2024, 2030] }
    ],
    Ranger: [
      { code: "YZ", name: "Oxford White", hex: "#FFFFFF", years: [2019, 2030] },
      { code: "UM", name: "Shadow / Agate Black", hex: "#141517", years: [2019, 2030] },
      { code: "M7", name: "Carbonized Gray", hex: "#525659", years: [2021, 2030] },
      { code: "JS", name: "Iconic Silver", hex: "#A8A9AD", years: [2020, 2030] },
      { code: "NE", name: "Cactus Gray", hex: "#9DA79F", years: [2021, 2030] },
      { code: "D4", name: "Rapid Red Metallic", hex: "#8C1D24", years: [2020, 2030] },
      { code: "PQ", name: "Race Red", hex: "#C8221E", years: [2019, 2030] },
      { code: "E7", name: "Velocity Blue", hex: "#17539B", years: [2021, 2023] },
      { code: "DR", name: "Avalanche Gray", hex: "#ADB4BC", years: [2024, 2030] },
      { code: "G4", name: "Azure Gray", hex: "#536B78", years: [2024, 2030] },
      { code: "J7", name: "Magnetic Metallic", hex: "#4B4F54", years: [2019, 2020] },
      { code: "UX", name: "Ingot Silver", hex: "#B7B9B8", years: [2019, 2019] }
    ]
  },
  Chevrolet: {
    default: [
      { code: "GAZ", name: "Summit White", hex: "#F2F4F7", years: [1995, 2030] },
      { code: "GBA", name: "Black", hex: "#111215", years: [1995, 2030] },
      { code: "GXD", name: "Sterling Gray Metallic", hex: "#696C72", years: [2023, 2030] },
      { code: "G6M", name: "Dark Ash Metallic", hex: "#3A3D42", years: [2022, 2030] },
      { code: "GNO", name: "Slate Gray Metallic", hex: "#555C66", years: [2024, 2030] },
      { code: "GXP", name: "Lakeshore Blue Metallic", hex: "#224263", years: [2024, 2030] },
      { code: "GLN", name: "Glacier Blue Metallic", hex: "#3B6B99", years: [2022, 2030] },
      { code: "G7C", name: "Red Hot", hex: "#B81B24", years: [2015, 2030] },
      { code: "GNT", name: "Radiant Red Tintcoat", hex: "#7F151C", years: [2023, 2030] },
      { code: "GXN", name: "Harvest Bronze Metallic", hex: "#5C5144", years: [2023, 2024] },
      { code: "G1W", name: "Iridescent Pearl Tricoat", hex: "#FAF9F6", years: [2016, 2030] },
      { code: "GA0", name: "Northsky Blue Metallic", hex: "#1C324E", years: [2019, 2023] },
      { code: "GJI", name: "Shadow Gray Metallic", hex: "#3F464D", years: [2019, 2022] },
      { code: "G9K", name: "Satin Steel Metallic", hex: "#8E9398", years: [2019, 2022] },
      { code: "GAN", name: "Silver Ice Metallic", hex: "#C0C2C5", years: [2009, 2022] },
      { code: "GSK", name: "Cherry Red Tintcoat", hex: "#6F1820", years: [2021, 2022] },
      { code: "GP5", name: "Cajun Red Tintcoat", hex: "#7A1B22", years: [2017, 2020] },
      { code: "GTL", name: "Sand Dune Metallic", hex: "#B5A593", years: [2021, 2023] },
      { code: "GCP", name: "Nitro Yellow Metallic", hex: "#D4B838", years: [2023, 2024] }
    ]
  },
  GMC: {
    default: [
      { code: "GAZ", name: "Summit White", hex: "#F2F4F7", years: [1995, 2030] },
      { code: "GBA", name: "Onyx Black", hex: "#111215", years: [1995, 2030] },
      { code: "G6M", name: "Titanium Rush Metallic", hex: "#3C3843", years: [2022, 2030] },
      { code: "GXD", name: "Sterling Metallic", hex: "#696C72", years: [2023, 2030] },
      { code: "GXP", name: "Downpour Metallic", hex: "#1E3A58", years: [2024, 2030] },
      { code: "GNO", name: "Thunderstorm Gray", hex: "#555C66", years: [2024, 2030] },
      { code: "GNT", name: "Volcanic Red Tintcoat", hex: "#7F151C", years: [2023, 2030] },
      { code: "G7C", name: "Cardinal Red", hex: "#B81B24", years: [2015, 2030] },
      { code: "G1W", name: "White Frost Tricoat", hex: "#FAF9F6", years: [2016, 2030] },
      { code: "GLN", name: "Dynamic Blue Metallic", hex: "#3B6B99", years: [2022, 2030] },
      { code: "GA0", name: "Pacific Blue Metallic", hex: "#1C324E", years: [2019, 2023] },
      { code: "GTL", name: "Desert Sand Metallic", hex: "#B5A593", years: [2022, 2023] },
      { code: "GSK", name: "Cayenne Red Tintcoat", hex: "#6F1820", years: [2021, 2022] },
      { code: "GJI", name: "Dark Sky Metallic", hex: "#3F464D", years: [2019, 2022] },
      { code: "GAN", name: "Quicksilver Metallic", hex: "#C0C2C5", years: [2009, 2022] },
      { code: "GS6", name: "Smokey Quartz Metallic", hex: "#443B39", years: [2019, 2021] },
      { code: "GXN", name: "Deep Bronze Metallic", hex: "#4A4336", years: [2023, 2024] }
    ]
  },
  Ram: {
    default: [
      { code: "PW7", name: "Bright White Clearcoat", hex: "#FFFFFF", years: [1995, 2030] },
      { code: "PXJ", name: "Diamond Black Crystal Pearl", hex: "#121316", years: [2018, 2030] },
      { code: "PAU", name: "Granite Crystal Metallic", hex: "#474A4F", years: [2014, 2030] },
      { code: "PSC", name: "Billet Silver Metallic", hex: "#B0B3B8", years: [2014, 2030] },
      { code: "PBJ", name: "Hydro Blue Pearlcoat", hex: "#1C5599", years: [2018, 2030] },
      { code: "PRV", name: "Delmonico Red Pearlcoat", hex: "#631B22", years: [2016, 2030] },
      { code: "PR4", name: "Flame Red Clearcoat", hex: "#C2232A", years: [1995, 2030] },
      { code: "PPX", name: "Patriot Blue Pearlcoat", hex: "#1C2A44", years: [2019, 2030] },
      { code: "PBN", name: "Forged Blue Metallic", hex: "#324B66", years: [2025, 2030] },
      { code: "PDN", name: "Ceramic Gray Clearcoat", hex: "#838991", years: [2021, 2024] },
      { code: "PFP", name: "Olive Green Pearlcoat", hex: "#414A3C", years: [2020, 2024] },
      { code: "PAR", name: "Maximum Steel Metallic", hex: "#37414A", years: [2013, 2022] },
      { code: "PBL", name: "Night Edge Blue", hex: "#172336", years: [2023, 2025] },
      { code: "PRM", name: "Molten Red", hex: "#9E1B23", years: [2024, 2030] },
      { code: "PX8", name: "Brilliant Black Crystal", hex: "#0F1012", years: [2009, 2018] },
      { code: "PWD", name: "Ivory White Tri-Coat", hex: "#FAF7F2", years: [2019, 2024] },
      { code: "PW6", name: "Walnut Brown Metallic", hex: "#483A2F", years: [2019, 2021] }
    ]
  },
  Toyota: {
    default: [
      { code: "040", name: "Super White / Ice Cap", hex: "#FFFFFF", years: [1995, 2030] },
      { code: "218", name: "Midnight Black Metallic", hex: "#141518", years: [2014, 2030] },
      { code: "1G3", name: "Magnetic Gray Metallic", hex: "#52555A", years: [2009, 2030] },
      { code: "1J9", name: "Celestial Silver Metallic", hex: "#B4B7BC", years: [2018, 2030] },
      { code: "1L7", name: "Underground", hex: "#3A3D42", years: [2024, 2030] },
      { code: "3U5", name: "Supersonic Red", hex: "#B81C26", years: [2021, 2030] },
      { code: "8X8", name: "Blueprint", hex: "#192A4D", years: [2022, 2030] },
      { code: "8W7", name: "Blue Crush Metallic", hex: "#1F3E74", years: [2022, 2030] },
      { code: "089", name: "Wind Chill Pearl", hex: "#F5F6F8", years: [2022, 2030] },
      { code: "4Y6", name: "Mudbath", hex: "#7A6F62", years: [2025, 2030] },
      { code: "4X3", name: "Terra", hex: "#854432", years: [2024, 2024] },
      { code: "4W5", name: "Solar Octane", hex: "#E05A1E", years: [2023, 2024] },
      { code: "6X3", name: "Bronze Oxide", hex: "#4F4D41", years: [2024, 2030] },
      { code: "6V7", name: "Army Green", hex: "#4A5240", years: [2020, 2022] },
      { code: "6X8", name: "Lunar Rock", hex: "#8A968D", years: [2021, 2023] },
      { code: "1H5", name: "Cement", hex: "#8A8E93", years: [2017, 2021] },
      { code: "4V6", name: "Quicksand", hex: "#B6A68E", years: [2016, 2020] },
      { code: "8T6", name: "Voodoo Blue", hex: "#1E65B8", years: [2019, 2021] },
      { code: "8W2", name: "Cavalry Blue", hex: "#44637E", years: [2018, 2019] },
      { code: "3R3", name: "Barcelona Red Metallic", hex: "#881A22", years: [2009, 2021] },
      { code: "4X7", name: "Smoked Mesquite", hex: "#4E3B31", years: [2014, 2023] }
    ]
  },
  Jeep: {
    default: [
      { code: "PW7", name: "Bright White Clearcoat", hex: "#FFFFFF", years: [2020, 2030] },
      { code: "PX8", name: "Black Clearcoat", hex: "#0F1012", years: [2020, 2030] },
      { code: "PAU", name: "Granite Crystal Metallic", hex: "#474A4F", years: [2020, 2030] },
      { code: "PDN", name: "Sting-Gray Clearcoat", hex: "#7C8288", years: [2020, 2023] },
      { code: "PDS", name: "Anvil Clearcoat", hex: "#5A6570", years: [2024, 2030] },
      { code: "PBJ", name: "Hydro Blue Pearlcoat", hex: "#1C5599", years: [2020, 2030] },
      { code: "PRC", name: "Firecracker Red Clearcoat", hex: "#C81D25", years: [2020, 2030] },
      { code: "PJF", name: "High Velocity Yellow", hex: "#DCE038", years: [2023, 2024] },
      { code: "PGG", name: "Sarge Green Clearcoat", hex: "#3D4738", years: [2020, 2024] },
      { code: "PGP", name: "Earl Clearcoat", hex: "#9CAEB3", years: [2023, 2024] },
      { code: "PUA", name: "Gobi Clearcoat", hex: "#B8AA92", years: [2020, 2022] },
      { code: "PRH", name: "Snazzberry Pearlcoat", hex: "#681829", years: [2021, 2022] },
      { code: "PSE", name: "Silver Zynith", hex: "#B8BBC0", years: [2022, 2024] },
      { code: "PFM", name: "Gecko Clearcoat", hex: "#55B338", years: [2021, 2021] },
      { code: "PHP", name: "Tuscadero Pink", hex: "#C8427E", years: [2024, 2024] }
    ]
  },
  Nissan: {
    default: [
      { code: "QAK", name: "Glacier White", hex: "#FFFFFF", years: [2010, 2030] },
      { code: "KH3", name: "Super Black", hex: "#111214", years: [2010, 2030] },
      { code: "KAD", name: "Gun Metallic", hex: "#53565B", years: [2010, 2030] },
      { code: "KBY", name: "Boulder Gray Pearl", hex: "#7B8289", years: [2022, 2030] },
      { code: "DAN", name: "Tactical Green Metallic", hex: "#3F493E", years: [2022, 2030] },
      { code: "NAH", name: "Cardinal Red Metallic", hex: "#7E1B24", years: [2022, 2030] },
      { code: "A20", name: "Red Alert", hex: "#B61F28", years: [2010, 2023] },
      { code: "EAN", name: "Baja Storm", hex: "#A4937D", years: [2022, 2030] },
      { code: "RAY", name: "Deep Blue Pearl", hex: "#1A2F54", years: [2020, 2030] },
      { code: "RBD", name: "Bluestone Pearl", hex: "#445C72", years: [2024, 2030] },
      { code: "K23", name: "Brilliant Silver Metallic", hex: "#B6B9BE", years: [2010, 2021] }
    ]
  }
};

function updateColorSwatches(make, model, year, preselectedCode) {
  const container = document.getElementById("colorSwatches");
  if (!container) return;
  container.innerHTML = "";

  const customPaintBox = document.getElementById("customPaintBox") || document.getElementById("customPaintCodeContainer");
  const customPaintCode = document.getElementById("customPaintCode");
  const customPaintName = document.getElementById("customPaintName");

  const normalizedMake = make && OEM_PAINT_CATALOG[make] ? make : "Ford";
  const makePalettes = OEM_PAINT_CATALOG[normalizedMake] || OEM_PAINT_CATALOG["Ford"];

  let colorList = [];
  if (model && makePalettes[model]) {
    colorList = makePalettes[model];
  } else if (makePalettes.default) {
    colorList = makePalettes.default;
  } else {
    colorList = OEM_PAINT_CATALOG["Ford"].default;
  }

  // Filter by Year if provided
  const yrNum = parseInt(year, 10);
  if (yrNum && !isNaN(yrNum)) {
    const filtered = colorList.filter((c) => {
      if (!c.years) return true;
      return yrNum >= c.years[0] && yrNum <= c.years[1];
    });
    if (filtered.length >= 4) {
      colorList = filtered;
    }
  }

  // Swatches list with Textured Black & Custom Paint Code
  const allSwatches = [
    ...colorList.map((c) => ({
      code: c.code,
      name: c.name,
      hex: c.hex,
      isCustom: false,
      isMatte: false
    })),
    {
      code: "TXT",
      name: "Textured Matte Black",
      hex: "#252525",
      isCustom: false,
      isMatte: true
    },
    {
      code: "CUSTOM",
      name: "Custom / Other OEM Paint Code",
      hex: "#4A5568",
      isCustom: true,
      isMatte: false
    }
  ];

  // Determine which code to select
  let activeCode = preselectedCode || state.vehicle.paint_code;
  const codeExists = allSwatches.some((s) => s.code === activeCode);
  if (!activeCode || !codeExists) {
    activeCode = allSwatches[0].code;
  }

  allSwatches.forEach((swatch) => {
    const isSelected = swatch.code === activeCode;
    const card = document.createElement("div");
    card.className = `swatch-card ${isSelected ? "active" : ""}`;
    card.dataset.code = swatch.code;
    card.dataset.name = swatch.name;
    card.dataset.hex = swatch.hex;
    card.dataset.color = swatch.code;
    if (swatch.isCustom) card.id = "swatchCustom";

    const circle = document.createElement("span");
    circle.className = `swatch-circle ${swatch.isCustom ? "swatch-rainbow" : ""}`;
    if (!swatch.isCustom) {
      circle.style.background = swatch.hex;
      const hexUpper = swatch.hex.toUpperCase();
      if (hexUpper === "#FFFFFF" || hexUpper === "#F2F4F7" || hexUpper === "#FAF9F6" || hexUpper === "#F5F6F8" || hexUpper === "#FAF7F2") {
        circle.style.border = "1px solid #CCC";
      } else if (swatch.isMatte) {
        circle.style.border = "1px dashed #777";
      }
    }

    const title = document.createElement("span");
    title.className = "swatch-title";
    title.innerText = swatch.isCustom || swatch.isMatte ? swatch.name : `${swatch.name} (${swatch.code})`;

    card.appendChild(circle);
    card.appendChild(title);

    card.onclick = () => {
      document.querySelectorAll(".swatch-card").forEach((s) => s.classList.remove("active"));
      card.classList.add("active");

      if (swatch.isCustom) {
        if (customPaintBox) customPaintBox.classList.remove("hidden");
        if (customPaintCode) customPaintCode.focus();
        state.vehicle.paint_code = customPaintCode && customPaintCode.value.trim() ? customPaintCode.value.trim().toUpperCase() : "CUSTOM";
        state.vehicle.paint_name = customPaintName && customPaintName.value.trim() ? customPaintName.value.trim() : "Custom OEM Paint";
        state.vehicle.custom_paint_code = state.vehicle.paint_code;
        state.vehicle.paint_hex = "#4A5568";
      } else {
        if (customPaintBox) customPaintBox.classList.add("hidden");
        state.vehicle.paint_hex = swatch.hex;
        state.vehicle.paint_code = swatch.code;
        state.vehicle.paint_name = swatch.name;
        state.vehicle.custom_paint_code = "";
      }
      updateVisualizer();
      updateSpecsBadge();
      saveStateToStorage();
      checkFieldErrorsLive(1);
    };

    container.appendChild(card);
  });

  // Apply active selection to vehicle state
  const selectedObj = allSwatches.find((s) => s.code === activeCode) || allSwatches[0];
  if (selectedObj.isCustom) {
    if (customPaintBox) customPaintBox.classList.remove("hidden");
    state.vehicle.paint_code = customPaintCode && customPaintCode.value.trim() ? customPaintCode.value.trim().toUpperCase() : "CUSTOM";
    state.vehicle.paint_name = customPaintName && customPaintName.value.trim() ? customPaintName.value.trim() : "Custom OEM Paint";
    state.vehicle.custom_paint_code = state.vehicle.paint_code;
    state.vehicle.paint_hex = "#4A5568";
  } else {
    if (customPaintBox) customPaintBox.classList.add("hidden");
    state.vehicle.paint_hex = selectedObj.hex;
    state.vehicle.paint_code = selectedObj.code;
    state.vehicle.paint_name = selectedObj.name;
    state.vehicle.custom_paint_code = "";
  }

  updateVisualizer();
  updateSpecsBadge();
}

// Cascading Vehicle Dropdowns
function updateModelsDropdown(make, preselectModel) {
  const vehModel = document.getElementById("vehModel");
  if (!vehModel) return;
  vehModel.innerHTML = '<option value="">-- Choose Model (Required) --</option>';

  if (!make) return;

  const models = {
    Ford: ["F-150", "F-250 / F-350 Super Duty", "Ranger", "Maverick"],
    Chevrolet: ["Silverado 1500", "Silverado 2500 / 3500 HD", "Colorado"],
    GMC: ["Sierra 1500", "Sierra 2500 / 3500 HD", "Canyon"],
    Ram: ["Ram 1500", "Ram 2500 / 3500 HD"],
    Toyota: ["Tacoma", "Tundra"],
    Jeep: ["Gladiator"],
    Nissan: ["Frontier", "Titan"]
  }[make] || ["Custom / Universal"];

  models.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m;
    opt.innerText = m;
    vehModel.appendChild(opt);
  });

  if (preselectModel) {
    vehModel.value = preselectModel;
    state.vehicle.model = preselectModel;
    updateBedSizesDropdown(make, preselectModel);
  } else {
    state.vehicle.model = "";
    updateBedSizesDropdown(make, "");
  }
}

// Bed Length Buttons / Tiles Grid (Interactive button cards only)
function updateBedSizesDropdown(make, model, preselectBed) {
  const bedTilesGrid = document.getElementById("bedTilesGrid");
  
  if (!make || !model) {
    if (bedTilesGrid) bedTilesGrid.innerHTML = '<div class="opt-desc" style="padding: 10px; color: var(--tgu-text-muted);">Please enter a VIN or choose Make & Model above to view compatible factory bed lengths.</div>';
    state.vehicle.bed_size = "";
    return;
  }

  let beds = [
    { id: "5.5ft", name: "5'6\" (5.5 ft) Short Bed", desc: "SuperCrew / Crew Cab", length_inches: 66 },
    { id: "6.5ft", name: "6'6\" (6.5 ft) Standard Bed", desc: "SuperCab / SuperCrew", length_inches: 78 },
    { id: "8.0ft", name: "8'0\" (8.0 ft) Long Bed", desc: "Regular Cab / Commercial", length_inches: 96 }
  ];

  if (model.includes("Tacoma")) {
    beds = [
      { id: "5.0ft", name: "5'0\" (60 in) Short Bed", desc: "Double Cab", length_inches: 60 },
      { id: "6.0ft", name: "6'0\" (73 in) Long Bed", desc: "Double Cab / Access Cab", length_inches: 73 }
    ];
  } else if (model.includes("Tundra")) {
    beds = [
      { id: "5.5ft", name: "5'6\" (66 in) Short Bed", desc: "CrewMax", length_inches: 66 },
      { id: "6.5ft", name: "6'6\" (78 in) Standard Bed", desc: "Double Cab / CrewMax", length_inches: 78 },
      { id: "8.1ft", name: "8'1\" (97 in) Long Bed", desc: "Double Cab", length_inches: 97 }
    ];
  } else if (model.includes("Silverado 1500") || model.includes("Sierra 1500")) {
    beds = [
      { id: "5.8ft", name: "5'8\" (70 in) Short Bed", desc: "Crew Cab (MultiFlex / MultiPro)", length_inches: 70 },
      { id: "6.6ft", name: "6'6\" (79.5 in) Standard Bed", desc: "Double Cab / Crew Cab", length_inches: 79.5 },
      { id: "8.0ft", name: "8'0\" (98 in) Long Bed", desc: "Regular Cab", length_inches: 98 }
    ];
  } else if (model.includes("Silverado 2500") || model.includes("Sierra 2500") || model.includes("Super Duty")) {
    beds = [
      { id: "6.75ft", name: "6'9\" (81 in) Short Bed", desc: "Crew Cab / SuperCab", length_inches: 81 },
      { id: "8.0ft", name: "8'2\" (98 in) Long Bed", desc: "Crew Cab / Regular Cab", length_inches: 98 }
    ];
  } else if (model.includes("Gladiator")) {
    beds = [{ id: "5.0ft", name: "5'0\" (60 in) Bed", desc: "4-Door Crew Cab", length_inches: 60 }];
  } else if (model.includes("Maverick")) {
    beds = [{ id: "4.5ft", name: "4'6\" (54 in) Bed", desc: "SuperCrew", length_inches: 54 }];
  }

  if (preselectBed) {
    state.vehicle.bed_size = preselectBed;
  } else if (!state.vehicle.bed_size || !beds.some((b) => b.id === state.vehicle.bed_size)) {
    state.vehicle.bed_size = beds[0].id;
  }

  if (bedTilesGrid) {
    bedTilesGrid.innerHTML = "";
    beds.forEach((b) => {
      const isSelected = b.id === state.vehicle.bed_size;
      const tile = document.createElement("div");
      tile.className = `bed-tile ${isSelected ? "active" : ""}`;
      tile.onclick = () => {
        state.vehicle.bed_size = b.id;
        updateBedSizesDropdown(make, model, b.id);
        renderModels();
        updateSpecsBadge();
        saveStateToStorage();
        checkFieldErrorsLive(1);
      };
      tile.innerHTML = `
        <div class="bed-tile-name">${b.name}</div>
        <div class="bed-tile-desc">${b.desc}</div>
        <div class="bed-tile-badge">${b.length_inches ? b.length_inches + " inches" : ""} ${isSelected ? "✓ SELECTED" : ""}</div>
      `;
      bedTilesGrid.appendChild(tile);
    });
  }
}

// Update Specs Badges
function updateSpecsBadge() {
  const fitment = state.vehicle.make ? `${state.vehicle.year || ""} ${state.vehicle.make} ${state.vehicle.model || ""} (${state.vehicle.bed_size || "No bed selected"})` : "Enter VIN or Select Truck in Step 1";
  const color = state.vehicle.paint_name ? `${state.vehicle.paint_name} (${state.vehicle.paint_code})` : "Select Color in Step 1";

  document.getElementById("visFitmentBadge").innerText = fitment;
  document.getElementById("visColorBadge").innerText = color;
}

// Update 2D SVG Visualizer
function updateVisualizer() {
  const curModel = LTA_MODELS.find((m) => m.id === state.model_id);
  document.getElementById("visModelLabel").innerText = curModel ? curModel.name : "Select Cap Model";

  const capBody = document.getElementById("svgCapBody");
  const capWindow = document.getElementById("svgCapWindow");
  const capRacks = document.getElementById("svgCapRacks");

  // Paint color
  capBody.setAttribute("fill", state.vehicle.paint_hex || "#2A2E33");

  if (!state.model_id) {
    capBody.setAttribute("d", "M 230 130 L 240 85 Q 260 80 540 80 Q 560 85 560 130 Z");
    capBody.setAttribute("opacity", "0.4");
    capWindow.setAttribute("opacity", "0");
    capRacks.setAttribute("opacity", "0");
    return;
  }

  capBody.setAttribute("opacity", "1");

  // Wedge Shape for Skyline (Mid-Rise)
  if (state.model_id === "ranch_skyline") {
    capBody.setAttribute("d", "M 230 130 L 240 75 Q 260 65 540 65 Q 560 70 560 130 Z");
    capWindow.setAttribute("d", "M 260 120 L 265 85 L 530 85 L 535 120 Z");
    capWindow.setAttribute("opacity", "0.9");
  } else if (["ranch_legacy_lid", "ranch_sportwrap_lid", "ranch_fusion_lid", "unicover_aurora_lid"].includes(state.model_id)) {
    capBody.setAttribute("d", "M 230 130 L 240 122 L 560 122 L 560 130 Z");
    capWindow.setAttribute("opacity", "0");
  } else {
    capBody.setAttribute("d", "M 230 130 L 240 85 Q 260 80 540 80 Q 560 85 560 130 Z");
    capWindow.setAttribute("d", "M 260 120 L 265 95 L 530 95 L 535 120 Z");
    capWindow.setAttribute("opacity", "0.9");
  }

  // Roof Rack Visibility
  if (state.options.roof_rack && state.options.roof_rack !== "rack_none") {
    capRacks.setAttribute("opacity", "1");
  } else {
    capRacks.setAttribute("opacity", "0");
  }
}

// Recalculate Pricing & Rules Engine
async function recalculatePrice() {
  if (!state.model_id) {
    document.getElementById("totModelName").innerText = "-- Select Cap Model in Step 2 --";
    document.getElementById("totBasePrice").innerText = "$0.00";
    document.getElementById("totOptionsList").innerHTML = `<div class="opt-row"><div class="opt-name-wrap"><span class="opt-name">No options selected</span></div><span class="opt-price">$0.00</span></div>`;
    document.getElementById("totGrandTotal").innerText = "$0.00";
    return;
  }

  const payload = {
    vehicle: {
      ...state.vehicle,
      bed_size: state.vehicle.bed_size || "5.5ft"
    },
    model_id: state.model_id,
    options: {
      ...state.options,
      interior_cargo_net: !!state.options.cargo_net || !!state.options.interior_cargo_net,
      interior_usb_fuse_box: !!state.options.interior_usb_fuse || !!state.options.interior_usb_fuse_box,
      interior_clothes_hanger: !!state.options.interior_clothes_hanger,
      interior_rod_holder: !!state.options.interior_rod_holder,
      interior_hd_chop_roof: !!state.options.hd_chop_top_reinforce || !!state.options.interior_hd_chop_roof,
      side_windows_driver: state.options.side_windows_driver || "win_sliders_screen",
      side_windows_passenger: state.options.side_windows_passenger || "win_sliders_screen",
      front_window: state.options.front_window || "front_solid_picture",
      rear_door: state.options.rear_door || "rear_framed_dual_t",
      installation_preference: "pro_install_seneca"
    }
  };

  try {
    const res = await fetch(`${API_BASE}/api/configurator/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      state.pricing = data;
      renderTotalizer(data);
      renderAlerts(data.alerts);
    }
  } catch (e) {
    console.warn("Using client-side calculation fallback", e);
  }
}

// Remove a specific selected option from state and re-render
function removeSelectedOption(optId, optCat, optName) {
  optId = optId || "";
  optCat = optCat || "";
  optName = optName || "";

  const isIcon = state.model_id === "ranch_icon";
  const isOzark = state.model_id === "venturous_ozark";

  // Checkbox: Headliner
  if (optId.includes("headliner") || optName.toLowerCase().includes("headliner")) {
    if (isIcon || isOzark) return; // Standard included on Icon/Ozark
    state.options.carpet_headliner = false;
    const chk = document.getElementById("chkHeadliner");
    if (chk) chk.checked = false;
  }
  // Checkbox: Cargo Net
  else if (optId.includes("cargo_net") || optName.toLowerCase().includes("cargo net")) {
    state.options.cargo_net = false;
    state.options.interior_cargo_net = false;
    const chk = document.getElementById("chkCargoNet");
    if (chk) chk.checked = false;
  }
  // Checkbox: Clothes Hanger
  else if (optId.includes("clothes") || optName.toLowerCase().includes("clothes hanger")) {
    state.options.interior_clothes_hanger = false;
    const chk = document.getElementById("chkClothesHanger");
    if (chk) chk.checked = false;
  }
  // Checkbox: Rod Holder
  else if (optId.includes("rod_holder") || optName.toLowerCase().includes("rod holder")) {
    state.options.interior_rod_holder = false;
    const chk = document.getElementById("chkRodHolder");
    if (chk) chk.checked = false;
  }
  // Checkbox: USB Fuse Box
  else if (optId.includes("usb") || optName.toLowerCase().includes("usb")) {
    state.options.interior_usb_fuse = false;
    state.options.interior_usb_fuse_box = false;
    const chk = document.getElementById("chkUsbFuseBox");
    if (chk) chk.checked = false;
  }
  // Checkbox: HD Chop Top
  else if (optId.includes("chop") || optName.toLowerCase().includes("chop")) {
    state.options.hd_chop_top_reinforce = false;
    state.options.interior_hd_chop_roof = false;
    const chk = document.getElementById("chkHdChopRoof");
    if (chk) chk.checked = false;
  }
  // Keyless Remote Sync
  else if (optId.includes("keyless") || optName.toLowerCase().includes("keyless")) {
    state.options.keyless_remote = false;
    if (state.options.tonneau_locking === "tonneau_keyless_remote_sync") {
      state.options.tonneau_locking = "tonneau_rotary_standard";
    }
    const chk = document.getElementById("chkKeylessRemote");
    if (chk) chk.checked = false;
  }
  // Roof Racks & Tonneau Racks
  else if (optId.startsWith("rack_") || optId.startsWith("tonneau_rack_") || optCat.includes("rack") || optName.toLowerCase().includes("rack") || optName.toLowerCase().includes("crossbar")) {
    state.options.roof_rack = "rack_none";
    state.options.tonneau_rack = "tonneau_rack_none";
  }
  // Roof Structure Reinforcement
  else if (optId.startsWith("roof_") || optCat.includes("structure") || optCat.includes("reinforce") || optName.toLowerCase().includes("skeleton") || optName.toLowerCase().includes("track channels")) {
    state.options.roof_reinforcement = "roof_std_honeycomb";
  }
  // Lighting Packages
  else if (optId.startsWith("pkg_") || optId.startsWith("tonneau_light_") || optCat.includes("light") || optName.toLowerCase().includes("light")) {
    state.options.lighting_package = "pkg_1_no_lights";
    state.options.interior_lighting = "pkg_1_no_lights";
    state.options.tonneau_lighting = "tonneau_light_standard_dome";
  }
  // Toolboxes
  else if (optId.startsWith("toolbox_ds_") || optId === "reinforcement_ds_toolbox" || (optCat.includes("toolbox") && optName.toLowerCase().includes("driver"))) {
    state.options.toolbox_driver = "toolbox_driver_none";
    state.options.side_toolbox_driver = false;
  }
  else if (optId.startsWith("toolbox_ps_") || optId === "reinforcement_ps_toolbox" || (optCat.includes("toolbox") && optName.toLowerCase().includes("passenger"))) {
    state.options.toolbox_passenger = "toolbox_passenger_none";
    state.options.side_toolbox_passenger = false;
  }
  else if (optId.startsWith("box_") || optId.startsWith("toolbox_") || optCat.includes("toolbox") || optName.toLowerCase().includes("toolbox")) {
    state.options.toolbox_driver = "toolbox_driver_none";
    state.options.toolbox_passenger = "toolbox_passenger_none";
    state.options.side_toolbox = "toolbox_none";
    state.options.side_toolbox_driver = false;
    state.options.side_toolbox_passenger = false;
  }
  // Cap-Pack Ceiling Storage
  else if (optId.startsWith("cappack_") || optCat.includes("cap_pack") || optName.toLowerCase().includes("cap-pack")) {
    state.options.cap_pack_system = "cappack_none";
  }
  // Decals & Wrap Trim
  else if (optId.startsWith("decal_") || optCat.includes("decal") || optName.toLowerCase().includes("decal")) {
    state.options.rear_decal = "decal_none";
  } else if (optId.startsWith("wrap_") || optCat.includes("wrap") || optName.toLowerCase().includes("wrap")) {
    state.options.wrap_rail_trim = "wrap_trim_none";
  }
  // Front Window (revert to solid picture)
  else if (optId.startsWith("front_") || optCat === "front_window" || optName.toLowerCase().includes("front")) {
    state.options.front_window = "front_solid_picture";
  }
  // Rear Door (revert to framed dual T)
  else if (optId.startsWith("rear_") || optCat === "rear_door" || optName.toLowerCase().includes("rear door")) {
    state.options.rear_door = "rear_framed_dual_t";
  }
  // Side Windows (revert to standard slider)
  else if (optId.startsWith("win_") || optCat.includes("side")) {
    if (optName.toLowerCase().includes("driver") || optId === state.options.side_windows_driver) {
      state.options.side_windows_driver = "win_sliders_screen";
    }
    if (optName.toLowerCase().includes("passenger") || optId === state.options.side_windows_passenger) {
      state.options.side_windows_passenger = "win_sliders_screen";
    }
  }
  // Fallback match
  else {
    for (const k in state.options) {
      if (state.options[k] === optId) {
        state.options[k] = null;
      }
    }
  }

  // Update UI and Recalculate
  renderOptions();
  updateVisualizer();
  recalculatePrice();
}

// Reset Configurator (Start Over)
function resetConfigurator() {
  if (!confirm("Are you sure you want to reset all selections and start over?")) {
    return;
  }

  // 1. Reset state
  state.currentStep = 1;
  state.activeCategory = "all";
  state.vehicle = {
    year: "",
    make: "",
    model: "",
    bed_size: "",
    cab_style: "Crew Cab",
    tailgate_type: "Standard",
    vin: "",
    paint_code: "",
    paint_name: "",
    custom_paint_code: "",
    paint_hex: "#2A2E33"
  };
  state.model_id = null;
  state.options = {
    side_windows_driver: null,
    side_windows_passenger: null,
    front_window: null,
    rear_door: null,
    aluminum_height: null,
    aluminum_side_layout: null,
    aluminum_color: null,
    tonneau_locking: null,
    tonneau_lighting: null,
    tonneau_rack: null,
    keyless_remote: false,
    roof_rack: null,
    carpet_headliner: false,
    led_light_strip: false,
    side_toolbox_driver: false,
    side_toolbox_passenger: false,
    paint_finish: "paint_oem_match",
    installation_preference: null
  };
  state.pricing = null;

  // Reset submitted validation flags
  for (const s in stepSubmitted) {
    stepSubmitted[s] = false;
  }

  // 2. Reset Step 1 Form Inputs
  const vehYear = document.getElementById("vehYear");
  if (vehYear) vehYear.value = "";
  const vehMake = document.getElementById("vehMake");
  if (vehMake) vehMake.value = "";
  const vehModel = document.getElementById("vehModel");
  if (vehModel) vehModel.innerHTML = '<option value="">-- Choose Model (Required) --</option>';
  const vehVin = document.getElementById("vehVin");
  if (vehVin) vehVin.value = "";
  const vehPaintCode = document.getElementById("vehPaintCode");
  if (vehPaintCode) vehPaintCode.value = "";
  const vehCustomPaint = document.getElementById("vehCustomPaint");
  if (vehCustomPaint) {
    vehCustomPaint.value = "";
    vehCustomPaint.classList.add("hidden");
  }

  // Reset bed tiles
  const bedTilesGrid = document.getElementById("bedTilesGrid");
  if (bedTilesGrid) bedTilesGrid.innerHTML = "";

  // Reset paint chips
  const oemColorGrid = document.getElementById("oemColorGrid");
  if (oemColorGrid) oemColorGrid.innerHTML = "";

  // 3. Reset Step 2 Models Grid
  document.querySelectorAll(".cat-tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.cat === "all"));
  renderModels();

  // 4. Reset Step 4 checkboxes
  ["chkKeylessRemote", "chkHeadliner", "chkCargoNet", "chkUsbFuseBox", "chkClothesHanger", "chkRodHolder", "chkHdChopRoof"].forEach((id) => {
    const chk = document.getElementById(id);
    if (chk) {
      chk.checked = false;
      chk.disabled = false;
    }
  });

  // 5. Reset Step 5 Lead Form Inputs
  ["custName", "custEmail", "custPhone", "custZip", "custNotes"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // 6. Reset Visualizer & Totalizer
  renderOptions();
  updateSpecsBadge();
  updateVisualizer();
  recalculatePrice();

  // 7. Clear all error banners / validation badges
  document.querySelectorAll(".error-msg, .field-error").forEach((el) => el.remove());
  document.querySelectorAll(".is-invalid").forEach((el) => el.classList.remove("is-invalid"));
  const alertBanner = document.getElementById("ruleAlertBanner");
  if (alertBanner) alertBanner.classList.add("hidden");

  // 8. Navigate to Step 1
  goToStep(1);
}

// Render Price Breakdown
function renderTotalizer(data) {
  if (!data) return;

  const setElText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
  };

  const labor = data.labor_total || 0;
  const subtotal = data.subtotal || (data.base_price + (data.options_total || 0));
  const tax = data.tax_total !== undefined ? data.tax_total : Math.round((subtotal + labor) * 0.06 * 100) / 100;
  const grandTotal = data.grand_total !== undefined ? data.grand_total : (subtotal + labor + tax);

  const hasKeyless = (data.selected_options || []).some(
    (o) => (o.item_id && o.item_id.includes("keyless")) || (o.name && o.name.toLowerCase().includes("keyless"))
  ) || !!state.options.keyless_remote || state.options.tonneau_locking === "tonneau_keyless_remote_sync";

  const laborLabel = hasKeyless
    ? "Pro Shop Installation (Base $200 + $120 Keyless Wiring)"
    : "Pro Shop Installation (Seneca, SC)";
  setElText("totLaborName", laborLabel);

  const pbLaborLabelEl = document.getElementById("pbLaborLabel");
  if (pbLaborLabelEl) {
    pbLaborLabelEl.innerText = hasKeyless
      ? "Pro Installation (Base $200 + $120 Keyless Wiring)"
      : "Pro Installation (Seneca, SC)";
  }

  const installPriceBadge = document.getElementById("installPriceBadge");
  if (installPriceBadge) {
    installPriceBadge.innerText = `+$${labor.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  }
  const installDescText = document.getElementById("installDescText");
  if (installDescText) {
    installDescText.innerText = hasKeyless
      ? "Certified TGU master installation: freight uncrating, high-density double-bulb rail sealing, precision bed alignment, heavy-duty torque clamping, 12V CHMSL 3rd brake light wiring, plus dedicated 12V Keyless Remote actuator harness wiring integration (+$120 labor), and 1-Year Master Labor Warranty."
      : "Certified TGU master installation: freight uncrating, high-density double-bulb rail sealing, precision bed alignment, heavy-duty torque clamping, 12V CHMSL 3rd brake light wiring, and 1-Year Master Labor Warranty.";
  }

  setElText("totModelName", `${data.model_name || "Cap Model"} (Base)`);
  setElText("totBasePrice", `$${(data.base_price || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`);
  setElText("pbBasePrice", `$${(data.base_price || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`);
  setElText("totLaborPrice", `$${labor.toLocaleString("en-US", { minimumFractionDigits: 2 })}`);
  setElText("pbLaborPrice", `$${labor.toLocaleString("en-US", { minimumFractionDigits: 2 })}`);
  setElText("totTaxPrice", `$${tax.toLocaleString("en-US", { minimumFractionDigits: 2 })}`);
  setElText("pbTaxPrice", `$${tax.toLocaleString("en-US", { minimumFractionDigits: 2 })}`);
  setElText("totGrandTotal", `$${grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}`);
  setElText("grandTotalPrice", `$${grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}`);

  const optList = document.getElementById("totOptionsList");
  if (optList) {
    optList.innerHTML = "";
    const nonLaborOpts = (data.selected_options || []).filter((o) => o.category !== "labor");
    if (nonLaborOpts.length === 0) {
      optList.innerHTML = `<div class="opt-row"><div class="opt-name-wrap"><span class="opt-name">Standard Included Package</span></div><span class="opt-price">$0.00</span></div>`;
    } else {
      nonLaborOpts.forEach((opt) => {
        const row = document.createElement("div");
        row.className = "opt-row";

        const optId = opt.item_id || opt.id || "";
        const optCat = opt.category || "";
        const optName = opt.name || "";
        const optPrice = typeof opt.price === "number" ? opt.price : 0;

        const isStandardIncluded = (optPrice === 0 && (optId.includes("standard") || optId.includes("included") || optName.toLowerCase().includes("standard")));
        const isRemovable = !isStandardIncluded && (optPrice !== 0 || (optId && !["ranch_echo_base", "win_sliders_screen", "front_solid_picture", "rear_framed_dual_t"].includes(optId)));

        const removeBtnHtml = isRemovable
          ? `<button type="button" class="opt-remove-btn" title="Remove ${optName}" data-opt-id="${optId}" data-opt-cat="${optCat}">✕</button>`
          : '';

        const priceFormatted = optPrice < 0
          ? `-$${Math.abs(optPrice).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
          : optPrice > 0
          ? `+$${optPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
          : `$0.00`;
        const priceClass = optPrice < 0 ? "opt-price opt-credit" : "opt-price";

        row.innerHTML = `
          <div class="opt-name-wrap">
            ${removeBtnHtml}
            <span class="opt-name">${optName}</span>
          </div>
          <span class="${priceClass}">${priceFormatted}</span>
        `;

        if (isRemovable) {
          const btn = row.querySelector(".opt-remove-btn");
          if (btn) {
            btn.onclick = (e) => {
              e.stopPropagation();
              removeSelectedOption(optId, optCat, optName);
            };
          }
        }

        optList.appendChild(row);
      });
    }
  }

  // Update Affirm financing estimation (36 mo @ 10% APR)
  const monthlyEst = Math.round((grandTotal / 36) * 1.15);
  const finBadge = document.querySelector(".financing-badge span");
  if (finBadge) {
    finBadge.innerHTML = `💳 Financing as low as <b>$${monthlyEst}/mo</b> with Affirm`;
  }
}

// Render Rule Alerts
function renderAlerts(alerts) {
  const banner = document.getElementById("ruleAlertBanner");
  if (!alerts || alerts.length === 0) {
    banner.classList.add("hidden");
    return;
  }
  banner.classList.remove("hidden");
  banner.innerHTML = alerts.map((a) => `<div>ℹ️ <b>${a.type.toUpperCase()}:</b> ${a.message} <i>(${a.action_taken || ""})</i></div>`).join("");
}

// Set Modal Image with Multi-Tier Fallback and Smooth Transition Safeguard
function setModalImage(relPath) {
  const modalImg = document.getElementById("modalImg");
  if (!modalImg) return;
  if (!relPath) {
    modalImg.style.display = "none";
    return;
  }
  
  const cleanRel = relPath.replace(/^\//, "");
  const filename = cleanRel.split("/").pop();
  
  // Set smooth transition
  modalImg.style.opacity = "0.2";
  modalImg.style.transition = "opacity 0.25s ease-in-out";
  modalImg.style.display = "block";
  
  modalImg.onload = function() {
    modalImg.style.opacity = "1";
    modalImg.style.display = "block";
  };
  
  let attempts = 0;
  modalImg.onerror = function () {
    attempts++;
    console.warn(`Modal image load attempt ${attempts} failed:`, modalImg.src);
    
    if (attempts === 1) {
      // Fallback 1: Direct Shopify Theme CDN path
      modalImg.src = "https://shopify.truckguy.pro/cdn/shop/t/4/assets/" + filename;
    } else if (attempts === 2) {
      // Fallback 2: Parler cloud options/models path
      const folder = cleanRel.includes("model") ? "images/models/" : "images/options/";
      modalImg.src = "https://parler.cloud/configurator/" + folder + filename;
    } else if (attempts === 3) {
      // Fallback 3: Parler cloud direct path
      modalImg.src = "https://parler.cloud/configurator/" + cleanRel;
    } else {
      // If all tiers fail, gracefully hide to prevent broken icon
      modalImg.style.display = "none";
    }
  };
  
  modalImg.src = resolveAssetUrl(cleanRel);
}

// "What You Get" Explainer Modal
function showWhatYouGet(type, id) {
  const modal = document.getElementById("explainerModal");
  let item = null;

  if (type === "model") {
    item = LTA_MODELS.find((m) => m.id === id);
    if (!item) return;
    document.getElementById("modalTitle").innerText = item.name;
    document.getElementById("modalBadge").innerText = `${item.brand} • WHAT YOU GET`;
    document.getElementById("modalDesc").innerText = item.desc;
    setModalImage(item.image);
    if (item.what_you_get) {
      document.getElementById("modalBenefitsList").innerHTML = (item.what_you_get.benefits || []).map((b) => `<li>${b}</li>`).join("");
      document.getElementById("modalIdealFor").innerText = item.what_you_get.ideal_for || "";
    }
  } else {
    for (const cat in OPTIONS_CATALOG) {
      const match = OPTIONS_CATALOG[cat].find((o) => o.id === id);
      if (match) {
        item = match;
        break;
      }
    }
    if (!item) return;

    document.getElementById("modalTitle").innerText = item.name;
    document.getElementById("modalBadge").innerText = item.tier 
      ? `${item.tier.toUpperCase()} TIER • OPTION SPECIFICATIONS`
      : "OPTION SPECIFICATIONS";
    document.getElementById("modalDesc").innerText = item.desc || "";
    setModalImage(item.image || "images/options/win_sliders_screen.webp");
    if (item.what_you_get) {
      document.getElementById("modalBenefitsList").innerHTML = (item.what_you_get.benefits || []).map((b) => `<li>${b}</li>`).join("");
      document.getElementById("modalIdealFor").innerText = item.what_you_get.ideal_for || "";
    }
  }

  modal.classList.remove("hidden");
}

function closeModal() {
  document.getElementById("explainerModal").classList.add("hidden");
  document.getElementById("successModal").classList.add("hidden");
  const upModal = document.getElementById("upgradeModal");
  if (upModal) upModal.classList.add("hidden");
}

// Inline Upgrade Card Renderer (No intrusive popups)
function renderInlineUpgradeCard(containerId, config) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!config) {
    container.classList.add("hidden");
    container.innerHTML = "";
    return;
  }

  const { title, explanation, targetOptions = {}, upgradeModelIds = [] } = config;
  const compatibleIds = getCompatibleModelIdsForVehicle(state.vehicle);
  let modelsToDisplay = upgradeModelIds
    .filter((id) => compatibleIds.includes(id))
    .map((id) => LTA_MODELS.find((m) => m.id === id))
    .filter(Boolean);

  if (modelsToDisplay.length === 0) {
    modelsToDisplay = upgradeModelIds.map((id) => LTA_MODELS.find((m) => m.id === id)).filter(Boolean);
  }

  const buttonsHtml = modelsToDisplay.map((m, idx) => {
    const isPrimary = idx === 0;
    const targetOptsString = JSON.stringify(targetOptions).replace(/"/g, '&quot;');
    return `
      <button type="button" class="btn-inline-upgrade ${isPrimary ? 'primary-up' : 'secondary-up'}" onclick="applyInlineUpgrade('${m.id}', ${targetOptsString})">
        <div class="inline-up-head">
          <span class="inline-up-name">⚡ Upgrade to ${m.name}</span>
          <span class="inline-up-price">$${m.base_price.toLocaleString()}</span>
        </div>
        <div class="inline-up-desc">${m.tagline || m.desc}</div>
      </button>
    `;
  }).join("");

  container.innerHTML = `
    <div class="inline-upgrade-card">
      <div class="inline-upgrade-header">
        <span class="inline-upgrade-badge">⚡ MODEL UPGRADE REQUIRED</span>
        <span class="inline-upgrade-title">${title}</span>
      </div>
      <p class="inline-upgrade-text">${explanation}</p>
      <div class="inline-upgrade-buttons">
        ${buttonsHtml}
      </div>
    </div>
  `;
  container.classList.remove("hidden");
  try {
    container.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (e) {}
}

function applyInlineUpgrade(newModelId, targetOptions = {}) {
  state.model_id = newModelId;

  if (targetOptions && typeof targetOptions === "object") {
    Object.assign(state.options, targetOptions);
  }

  // Clear all inline upgrade cards
  ["rearDoorInlineUpgradeContainer", "keylessInlineUpgradeContainer", "roofReinforceInlineUpgradeContainer", "toolboxInlineUpgradeContainer", "headlinerInlineUpgradeContainer"].forEach((cId) => {
    renderInlineUpgradeCard(cId, null);
  });

  renderModels();
  renderOptions();
  syncStateToDOM();
  updateVisualizer();
  recalculatePrice();
  saveStateToStorage();

  const upgradedModel = LTA_MODELS.find((m) => m.id === newModelId);
  showUpgradeToast(`⚡ Build successfully upgraded to ${upgradedModel ? upgradedModel.name : "New Model"}!`);
}

window.renderInlineUpgradeCard = renderInlineUpgradeCard;
window.applyInlineUpgrade = applyInlineUpgrade;
window.applyUpgrade = applyInlineUpgrade;
window.showUpgradePrompt = function({ title, explanation, targetOptions, upgradeModelIds }) {
  renderInlineUpgradeCard("rearDoorInlineUpgradeContainer", { title, explanation, targetOptions, upgradeModelIds });
};

function showUpgradeToast(message) {
  let toast = document.getElementById("configuratorToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "configuratorToast";
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #0E1219;
      color: #00E5FF;
      border: 1px solid #00E5FF;
      box-shadow: 0 0 20px rgba(0, 229, 255, 0.4);
      padding: 14px 20px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 14px;
      z-index: 999999;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 10px;
    `;
    document.body.appendChild(toast);
  }
  toast.innerText = message;
  toast.style.opacity = "1";
  toast.style.transform = "translateY(0)";

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(20px)";
  }, 4000);
}

window.CLIENT_AUTHENTICATED_USER = null;
window.CLIENT_EDITING_QUOTE_REF = null;
window.LTA_CONFIGURATOR_AUTH = window.LTA_CONFIGURATOR_AUTH || {
  enabled: true,
  allow_guest_submission: true
};

async function initClientAuthConfig() {
  try {
    const res = await fetch(`${API_BASE}/api/configurator/auth/config`);
    if (res.ok) {
      const cfg = await res.json();
      window.LTA_CONFIGURATOR_AUTH = Object.assign({}, window.LTA_CONFIGURATOR_AUTH, cfg);
    }
  } catch (e) {
    console.warn("Could not load configurator auth config:", e);
  }
}

async function checkClientAuth() {
  await initClientAuthConfig();
  const oauthContainer = document.getElementById("oauthContainer");
  const oauthDivider = document.getElementById("oauthDivider");
  const loginPrompt = document.getElementById("oauthLoginPrompt");
  const loggedInState = document.getElementById("oauthLoggedInState");

  if (!window.LTA_CONFIGURATOR_AUTH.enabled) {
    if (oauthContainer) oauthContainer.classList.add("hidden");
    if (oauthDivider) oauthDivider.classList.add("hidden");
    return false;
  }

  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      if (data.authenticated && data.email) {
        window.CLIENT_AUTHENTICATED_USER = data;
        
        // Update Step 5 OAuth Box State
        if (loginPrompt) loginPrompt.classList.add("hidden");
        if (loggedInState) loggedInState.classList.remove("hidden");
        if (oauthDivider) oauthDivider.classList.add("hidden");

        const userNameEl = document.getElementById("oauthUserName");
        const userEmailEl = document.getElementById("oauthUserEmail");
        const userAvatarEl = document.getElementById("oauthUserAvatar");

        if (userNameEl) userNameEl.innerText = data.name || data.email.split("@")[0];
        if (userEmailEl) userEmailEl.innerText = data.email;
        if (userAvatarEl) {
          if (data.picture) {
            userAvatarEl.innerHTML = `<img src="${data.picture}" alt="Avatar" />`;
          } else {
            userAvatarEl.innerText = (data.name || data.email)[0].toUpperCase();
          }
        }

        // Auto-fill Step 5 customer info
        const nameField = document.getElementById("custName");
        const emailField = document.getElementById("custEmail");
        if (nameField && data.name && !nameField.value) {
          nameField.value = data.name;
        }
        if (emailField && data.email) {
          emailField.value = data.email;
          emailField.readOnly = true;
          emailField.style.backgroundColor = "rgba(0, 229, 255, 0.08)";
          emailField.style.borderColor = "var(--primary-cyan, #00E5FF)";
          
          let badge = document.getElementById("emailVerifiedBadge");
          if (!badge && emailField.parentNode) {
            badge = document.createElement("span");
            badge.id = "emailVerifiedBadge";
            badge.style.cssText = "display:inline-block; font-size:0.75rem; color:#10B981; font-weight:700; margin-left:8px;";
            badge.innerHTML = "✓ Verified Profile";
            emailField.parentNode.querySelector("label")?.appendChild(badge);
          }
        }
        return true;
      }
    }
  } catch (e) {
    console.warn("Client auth check:", e);
  }

  // Not authenticated
  if (loginPrompt) loginPrompt.classList.remove("hidden");
  if (loggedInState) loggedInState.classList.add("hidden");
  if (oauthDivider) oauthDivider.classList.remove("hidden");
  return false;
}

function triggerClientOAuthLogin() {
  saveStateToStorage();
  const currentUrl = new URL(window.location.href);
  currentUrl.searchParams.set("step", "5");
  const returnUrl = encodeURIComponent(currentUrl.toString());
  const authUrl = `${API_BASE}/auth/google/client-login?return_to=${returnUrl}`;
  window.location.href = authUrl;
}

function triggerClientOAuthLogout() {
  const currentUrl = new URL(window.location.href);
  currentUrl.searchParams.set("step", "5");
  const returnUrl = encodeURIComponent(currentUrl.toString());
  const logoutUrl = `${API_BASE}/auth/google/client-logout?return_to=${returnUrl}`;
  window.location.href = logoutUrl;
}

// Check for existing quote in query string
async function checkUrlQuoteRef() {
  const urlParams = new URLSearchParams(window.location.search);
  const quoteRef = urlParams.get("quote_ref");
  if (!quoteRef) return;

  try {
    const res = await fetch(`${API_BASE}/api/configurator/quotes/${encodeURIComponent(quoteRef)}`);
    if (!res.ok) return;
    const q = await res.json();
    window.CLIENT_EDITING_QUOTE_REF = quoteRef;

    if (q.vehicle) {
      Object.assign(state.vehicle, q.vehicle);
      if (document.getElementById("vehVin") && q.vehicle.vin) document.getElementById("vehVin").value = q.vehicle.vin;
      if (document.getElementById("vehYear") && q.vehicle.year) document.getElementById("vehYear").value = q.vehicle.year;
      if (document.getElementById("vehMake") && q.vehicle.make) {
        document.getElementById("vehMake").value = q.vehicle.make;
        document.getElementById("vehMake").dispatchEvent(new Event("change"));
      }
    }
    if (q.build?.model_id) {
      state.model_id = q.build.model_id;
    }
    if (q.raw_options) {
      Object.assign(state.options, q.raw_options);
    }
    if (q.customer) {
      if (document.getElementById("custName") && q.customer.full_name) document.getElementById("custName").value = q.customer.full_name;
      if (document.getElementById("custPhone") && q.customer.phone) document.getElementById("custPhone").value = q.customer.phone;
      if (document.getElementById("custZip") && q.customer.zip_code) document.getElementById("custZip").value = q.customer.zip_code;
    }

    await recalculatePrice();
    if (typeof updateVisualizer === "function") updateVisualizer();

    const banner = document.getElementById("ruleAlertBanner");
    if (banner) {
      banner.classList.remove("hidden");
      banner.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center;"><span>🔧 <b>SAVED BUILD:</b> Modifying Quote <code>${quoteRef}</code> (Revision ${(q.history?.length || 1) + 1})</span><a href="${window.location.pathname}" style="color:#00E5FF; text-decoration:underline; font-size:0.8rem;">Start Fresh Build</a></div>`;
    }
    const submitBtn = document.getElementById("submitQuoteBtn");
    if (submitBtn) {
      submitBtn.innerText = `💾 Save & Update My Build (${quoteRef})`;
    }
  } catch (err) {
    console.warn("Could not hydrate URL quote ref:", err);
  }
}

// Handle Form Submission with Step 5 Validation and OAuth Protection
async function handleQuoteSubmit(e) {
  e.preventDefault();
  stepSubmitted[5] = true;

  const isValid = validateStep(5, true);
  if (!isValid) return;

  // Verify OAuth Authentication if retailer deployment requires it
  if (window.LTA_CONFIGURATOR_AUTH?.allow_guest_submission === false && !window.CLIENT_AUTHENTICATED_USER) {
    const isAuth = await checkClientAuth();
    if (!isAuth) {
      if (confirm("🔐 GOOGLE SIGN-IN REQUIRED\n\nTo prevent quote abuse, guarantee transparent pricing, and automatically save your custom build to your customer account, please sign in with Google.\n\nClick OK to continue to Google Sign-In.")) {
        triggerClientOAuthLogin();
      }
      return;
    }
  }

  const submitBtn = document.getElementById("submitQuoteBtn");
  submitBtn.disabled = true;
  submitBtn.innerText = window.CLIENT_EDITING_QUOTE_REF ? "⏳ Updating Build Revision..." : "⏳ Submitting Quote...";

  const custName = document.getElementById("custName").value.trim();
  const custEmail = document.getElementById("custEmail").value.trim();
  const custPhone = document.getElementById("custPhone").value.trim();
  const custZip = document.getElementById("custZip").value.trim();
  const custUse = document.getElementById("custUse").value;
  const custContactPref = document.getElementById("custContactPref").value;

  const isEdit = !!window.CLIENT_EDITING_QUOTE_REF;
  const url = isEdit ? `${API_BASE}/api/configurator/quotes/${encodeURIComponent(window.CLIENT_EDITING_QUOTE_REF)}` : `${API_BASE}/api/configurator/submit-quote`;
  const method = isEdit ? "PUT" : "POST";

  const payload = {
    customer: {
      full_name: custName,
      email: custEmail,
      phone: custPhone,
      zip_code: custZip,
      primary_use: custUse,
      preferred_contact: custContactPref,
      notes: document.getElementById("custNotes").value
    },
    vehicle: state.vehicle,
    model_id: state.model_id,
    options: Object.assign({}, state.options, {
      installation_preference: state.options.installation_preference || "pro_install_seneca"
    }),
    modified_by_name: custName,
    modified_by_email: custEmail,
    role: "client",
    changes_summary: isEdit ? `Client updated custom build specifications` : `Initial client quote submission`
  };

  try {
    const res = await fetch(url, {
      method: method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      document.getElementById("succQuoteRef").innerText = data.quote_reference || window.CLIENT_EDITING_QUOTE_REF || "";
      document.getElementById("succLeadId").innerText = data.lead_unique_id || "";
      document.getElementById("succTotalPrice").innerText = `$${data.total_price.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
      document.getElementById("succMessage").innerText = data.message || "Your custom LTA truck cap quote has been submitted to Truck Guy Upfitters!";
      document.getElementById("successModal").classList.remove("hidden");
    } else {
      const err = await res.json();
      alert("Error submitting quote: " + (err.detail || "Please check all fields and try again."));
    }
  } catch (err) {
    alert("Unable to reach quote engine: " + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerText = isEdit ? `💾 Save & Update My Build (${window.CLIENT_EDITING_QUOTE_REF})` : "🚀 Submit Custom Build Quote";
  }
}

// Run auth and URL quote check on page load
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    checkClientAuth();
    checkUrlQuoteRef();
  }, 300);
});


