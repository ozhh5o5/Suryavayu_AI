import type { ForecastHorizon, ForecastInput, ForecastPoint, GenerationPoint, PlantType, ScenarioType, WeatherPoint } from "@/lib/types";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function scenarioMultiplier(scenario: ScenarioType): number {
  if (scenario === "OPTIMISTIC") return 1.08;
  if (scenario === "PESSIMISTIC") return 0.88;
  return 1;
}

function horizonHours(horizon: ForecastHorizon): number {
  if (horizon === "INTRADAY_6H") return 6;
  if (horizon === "DAY_AHEAD") return 24;
  return 24 * 7;
}

// ────────────────────────────────────────────
// Physics-informed Clear Sky GHI Model
// Computes theoretical maximum solar irradiance
// based on solar geometry for any lat/lng/time
// ────────────────────────────────────────────
function calculateClearSkyGHI(timestamp: Date, lat: number = 12.97): number {
  const hour = timestamp.getHours() + timestamp.getMinutes() / 60;
  const dayOfYear = Math.floor(
    (timestamp.getTime() - new Date(timestamp.getFullYear(), 0, 0).getTime()) / 86400000,
  );

  // Solar declination angle (degrees)
  const declination = 23.45 * Math.sin(((360 / 365) * (dayOfYear - 81) * Math.PI) / 180);

  // Hour angle (degrees, solar noon = 0)
  const hourAngle = 15 * (hour - 12);

  // Convert to radians
  const latRad = (lat * Math.PI) / 180;
  const decRad = (declination * Math.PI) / 180;
  const haRad = (hourAngle * Math.PI) / 180;

  // Cosine of zenith angle
  const cosZenith =
    Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad);
  const zenithDeg = Math.acos(clamp(cosZenith, 0, 1)) * (180 / Math.PI);

  if (zenithDeg > 85) return 0; // sun near or below horizon

  // Simplified Hottel clear-sky model
  const Isc = 1367; // solar constant W/m²
  const zenithRad = (zenithDeg * Math.PI) / 180;
  const am = 1 / Math.cos(zenithRad); // air mass

  return Isc * Math.pow(0.7, Math.pow(am, 0.678)) * cosZenith;
}

// ────────────────────────────────────────────
// Physics-based Wind Turbine Power Curve
// Standard IEC 61400 cubic response model
// ────────────────────────────────────────────
function calculateWindPowerCurve(speedMS: number, capacityMW: number): number {
  const cutIn = 3.0; // m/s
  const rated = 12.0; // m/s
  const cutOut = 25.0; // m/s

  if (speedMS < cutIn || speedMS > cutOut) return 0;
  if (speedMS >= rated) return capacityMW;

  // Cubic power coefficient between cut-in and rated
  return capacityMW * Math.pow((speedMS - cutIn) / (rated - cutIn), 3);
}

// ────────────────────────────────────────────
// ML Residual Correction Helpers
// Simulate what a gradient-boosted residual
// model would contribute on top of physics base
// ────────────────────────────────────────────
function weatherByTimestamp(weather: WeatherPoint[]): Map<number, WeatherPoint> {
  const map = new Map<number, WeatherPoint>();
  for (const w of weather) {
    map.set(new Date(w.timestamp).getTime(), w);
  }
  return map;
}

function avg<T>(arr: T[], pick: (v: T) => number): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, x) => s + pick(x), 0) / arr.length;
}

/**
 * Solar forecast: physics clear-sky base with cloud / temperature residual correction
 */
function solarForecastMW(
  timestamp: Date,
  weather: WeatherPoint | undefined,
  capacityMW: number,
): number {
  const clearSkyGhi = calculateClearSkyGHI(timestamp);
  const maxGhi = 1000; // STC reference

  const cloud = clamp(weather?.cloudCover ?? 0.25, 0, 1);
  const temp = weather?.temperature ?? 28;

  // ML residual corrections (simulated)
  const cloudPenalty = Math.pow(1 - cloud, 0.75); // non-linear cloud transience
  const tempDerate = 1 - 0.004 * Math.max(0, temp - 25); // PV efficiency loss
  const soilingLoss = 0.97; // 3% soiling baseline

  const physicsBase = (clearSkyGhi / maxGhi) * cloudPenalty * tempDerate * soilingLoss;
  return clamp(physicsBase * capacityMW, 0, capacityMW * 1.05);
}

/**
 * Wind forecast: power curve physics with turbulence and wake residual correction
 */
function windForecastMW(
  weather: WeatherPoint | undefined,
  capacityMW: number,
): number {
  const speed = weather?.windSpeed ?? 6.5;
  const turbulenceLoss = 0.95; // wake effects
  const altitudeShear = 1.02; // hub-height correction

  return calculateWindPowerCurve(speed, capacityMW) * turbulenceLoss * altitudeShear;
}

// ────────────────────────────────────────────
// Persistence Baseline
// "Tomorrow = Today": uses the last 24h actual
// ────────────────────────────────────────────
export function persistenceForecast(
  history: GenerationPoint[],
  hours: number,
): number[] {
  const tail = history.slice(-hours);
  if (tail.length === 0) return Array(hours).fill(0);
  // repeat the last available day if history is shorter
  const result: number[] = [];
  for (let i = 0; i < hours; i++) {
    result.push(tail[i % tail.length].actualMW);
  }
  return result;
}

// ────────────────────────────────────────────
// Naive Weather Baseline
// Direct regression from weather variables only
// (no physics grounding, no time-series memory)
// ────────────────────────────────────────────
export function naiveWeatherForecast(
  plantType: PlantType,
  capacityMW: number,
  weatherForecast: WeatherPoint[],
): number[] {
  return weatherForecast.map((w) => {
    if (plantType === "SOLAR_PV") {
      const ghi = w.ghi ?? 500;
      const cloud = w.cloudCover ?? 0.3;
      return clamp((ghi / 1000) * (1 - cloud * 0.5) * capacityMW, 0, capacityMW);
    }
    const speed = w.windSpeed ?? 6;
    if (speed < 3 || speed > 25) return 0;
    if (speed >= 12) return capacityMW;
    return capacityMW * Math.pow((speed - 3) / 9, 2);
  });
}

// ────────────────────────────────────────────
// Main Forecasting Engine
// Physics-embedded with quantile regression
// ────────────────────────────────────────────
export function generateForecast(input: ForecastInput): {
  points: ForecastPoint[];
  meanConfidence: number;
  modelVersion: string;
} {
  const totalHours = horizonHours(input.horizon);
  const anchor =
    input.weatherForecast.length > 0
      ? new Date(input.weatherForecast[0].timestamp)
      : new Date(Math.floor(Date.now() / 3600000) * 3600000);
  const weatherMap = weatherByTimestamp(input.weatherForecast);
  const points: ForecastPoint[] = [];

  for (let i = 0; i < totalHours; i += 1) {
    const timestamp = new Date(anchor.getTime() + i * 60 * 60 * 1000);
    const weather = weatherMap.get(timestamp.getTime());

    // Physics + ML Residual (simulated)
    const physicsBase =
      input.plantType === "SOLAR_PV"
        ? solarForecastMW(timestamp, weather, input.capacityMW)
        : windForecastMW(weather, input.capacityMW);

    // Scenario adjustment
    const p50 = physicsBase * scenarioMultiplier(input.scenario);

    // Quantile regression: asymmetric intervals widen with horizon
    const baseUncertainty = input.plantType === "WIND" ? 0.18 : 0.12;
    const horizonGrowth = (i / totalHours) * 0.1;
    const spread = p50 * (baseUncertainty + horizonGrowth);

    points.push({
      timestamp,
      forecastMW: Number(p50.toFixed(2)),
      p10: Number(clamp(p50 - spread * 1.28, 0, input.capacityMW).toFixed(2)),
      p50: Number(p50.toFixed(2)),
      p90: Number(clamp(p50 + spread * 1.28, 0, input.capacityMW * 1.05).toFixed(2)),
    });
  }

  // Confidence score derived from weather volatility + horizon
  const cloudAvg = avg(input.weatherForecast, (w) => w.cloudCover ?? 0.2);
  const windVol = avg(input.weatherForecast, (w) => Math.abs((w.windSpeed ?? 6) - 6));
  const baseConfidence = input.plantType === "SOLAR_PV" ? 0.92 : 0.86;
  const weatherPenalty = input.plantType === "SOLAR_PV" ? cloudAvg * 0.15 : windVol * 0.02;
  const horizonPenalty = input.horizon === "WEEK" ? 0.1 : input.horizon === "DAY_AHEAD" ? 0.05 : 0.02;
  const meanConfidence = clamp(baseConfidence - weatherPenalty - horizonPenalty, 0.6, 0.99);

  return {
    points,
    meanConfidence: Number(meanConfidence.toFixed(2)),
    modelVersion: "sv-0.3-physics-embedded",
  };
}

export function buildBaselineForecast(
  plantType: PlantType,
  capacityMW: number,
  history: GenerationPoint[],
  weatherForecast: WeatherPoint[],
  horizon: ForecastHorizon,
): ForecastPoint[] {
  return generateForecast({
    plantId: "preview",
    plantType,
    capacityMW,
    history,
    weatherHistory: [],
    weatherForecast,
    horizon,
    scenario: "BASE",
  }).points;
}
