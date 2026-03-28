// European country codes (ISO 3166-1 alpha-2)
export const EU_COUNTRY_CODES = new Set([
  "de",
  "fr",
  "nl",
  "be",
  "gb",
  "at",
  "ch",
  "se",
  "no",
  "dk",
  "fi",
  "pl",
  "it",
  "es",
  "pt",
  "cz",
  "hu",
  "ro",
  "bg",
  "hr",
  "sk",
  "si",
  "lt",
  "lv",
  "ee",
  "ie",
  "lu",
  "mt",
  "cy",
  "gr",
  "rs",
  "ba",
  "me",
  "mk",
  "al",
  "ua",
  "md",
  "by",
  "is",
  "li",
]);

const EU_CITY_MULTIPLIERS: Record<string, number> = {
  paris: 1.25,
  london: 1.3,
  zurich: 1.35,
  oslo: 1.3,
  stockholm: 1.2,
  amsterdam: 1.15,
  brussels: 1.1,
  copenhagen: 1.25,
  munich: 1.15,
  frankfurt: 1.1,
  berlin: 1.05,
  vienna: 1.1,
  rome: 1.05,
  madrid: 1.0,
  barcelona: 1.05,
  milan: 1.1,
  warsaw: 0.85,
  prague: 0.9,
  budapest: 0.85,
  bucharest: 0.8,
};

export type Currency = "TRY" | "EUR";

export interface PricingResult {
  price: number;
  currency: Currency;
  symbol: string;
  label: string;
  marketNote?: string;
}

export function detectCurrencyFromAddress(
  displayName: string,
  countryCode?: string,
): Currency {
  if (countryCode && countryCode.toLowerCase() !== "tr") {
    const cc = countryCode.toLowerCase();
    if (EU_COUNTRY_CODES.has(cc)) return "EUR";
  }
  const lower = displayName.toLowerCase();
  const euroKeywords = [
    ", germany",
    ", deutschland",
    ", france",
    ", netherlands",
    ", belgium",
    ", united kingdom",
    ", austria",
    ", switzerland",
    ", sweden",
    ", norway",
    ", denmark",
    ", finland",
    ", poland",
    ", italy",
    ", spain",
    ", portugal",
    ", czech",
    ", hungary",
    ", romania",
    ", bulgaria",
    ", croatia",
    ", slovakia",
    ", slovenia",
    ", greece",
    ", ireland",
    ", luxembourg",
  ];
  if (euroKeywords.some((k) => lower.includes(k))) return "EUR";
  return "TRY";
}

function getCityMultiplier(displayName: string): number {
  const lower = displayName.toLowerCase();
  for (const [city, mult] of Object.entries(EU_CITY_MULTIPLIERS)) {
    if (lower.includes(city)) return mult;
  }
  return 1.0;
}

// Uber/Bolt EU average ~€1.8/km — we offer 20% below market
const EU_BASE_RATE_KM = 1.8 * 0.8;
const EU_BASE_RATE_MIN = 0.3 * 0.8;
const EU_BASE_FEE = 2.5 * 0.8;

const TR_BASE_RATE_KM = 120;
const TR_BASE_FEE = 1000;
const TR_RATE_MIN = 3;

export function calcRidePrice(
  distanceKm: number,
  durationMin: number,
  currency: Currency,
  displayName: string,
  isExpress = false,
): PricingResult {
  const expMult = isExpress ? 1.4 : 1.0;
  if (currency === "EUR") {
    const cityMult = getCityMultiplier(displayName);
    const raw =
      (EU_BASE_FEE +
        distanceKm * EU_BASE_RATE_KM +
        durationMin * EU_BASE_RATE_MIN) *
      cityMult *
      expMult;
    const price = Math.max(4, Math.round(raw * 10) / 10);
    return {
      price,
      currency: "EUR",
      symbol: "€",
      label: `€${price.toFixed(2)}`,
      marketNote: "(piyasanin %20 altinda)",
    };
  }
  const trafficBonus = durationMin > 20 ? 450 : durationMin > 10 ? 250 : 0;
  const rawTry =
    TR_BASE_FEE +
    distanceKm * TR_BASE_RATE_KM +
    durationMin * TR_RATE_MIN +
    trafficBonus;
  const priceTry = Math.min(2800, Math.max(800, Math.round(rawTry * expMult)));
  return {
    price: priceTry,
    currency: "TRY",
    symbol: "₺",
    label: `₺${priceTry}`,
  };
}

export function calcDeliveryPrice(
  distanceKm: number,
  packageType: "small" | "medium" | "sensitive",
  currency: Currency,
  displayName: string,
  isExpress = false,
): PricingResult {
  const riskMult =
    packageType === "sensitive" ? 1.5 : packageType === "medium" ? 1.2 : 1.0;
  const expMult = isExpress ? 1.8 : 1.0;
  if (currency === "EUR") {
    const cityMult = getCityMultiplier(displayName);
    const raw = (3.0 + distanceKm * 1.2) * riskMult * expMult * cityMult;
    const price = Math.max(3, Math.round(raw * 10) / 10);
    return {
      price,
      currency: "EUR",
      symbol: "€",
      label: `€${price.toFixed(2)}`,
      marketNote: "(piyasanin %20 altinda)",
    };
  }
  const rawTry = (15 + distanceKm * 2) * riskMult * expMult;
  const priceTry = Math.round(rawTry);
  return {
    price: priceTry,
    currency: "TRY",
    symbol: "₺",
    label: `₺${priceTry}`,
  };
}
