import type { ForecastPoint, ScenarioType, WeatherPoint } from "@/lib/types";

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

// ────────────────────────────────────────────
// SHAP Feature Importance (simulated)
// Decomposes each forecast into additive
// feature contributions for explainability
// ────────────────────────────────────────────
export interface ShapValues {
  label: string;
  contribution: number; // percentage 0-100
  direction: "positive" | "negative";
}

/**
 * Simulates SHAP-like feature importance breakdown
 * based on plant type and current weather conditions.
 * In production this would come from a real SHAP explainer.
 */
export function simulateShapValues(
  plantType: string,
  weather: WeatherPoint[],
): ShapValues[] {
  const avgCloud = avg(weather.map((w) => (w.cloudCover ?? 0.3) * 100));
  const avgWind = avg(weather.map((w) => w.windSpeed ?? 6));
  const avgTemp = avg(weather.map((w) => w.temperature ?? 28));

  if (plantType === "SOLAR_PV") {
    const cloudImpact = Math.min(50, Math.round(avgCloud * 0.7));
    const tempImpact = Math.round(Math.max(0, avgTemp - 25) * 2);
    const diurnalImpact = 100 - cloudImpact - tempImpact - 15;
    return [
      { label: "Cloud Cover / Transience", contribution: cloudImpact, direction: "negative" },
      { label: "Clear-Sky GHI (Physics)", contribution: Math.max(10, diurnalImpact), direction: "positive" },
      { label: "Historical Persistence", contribution: 15, direction: "positive" },
      { label: "Temperature Derating", contribution: Math.max(2, tempImpact), direction: "negative" },
    ];
  }

  // WIND
  const windImpact = Math.min(65, Math.round(avgWind * 5));
  const turbulenceImpact = Math.min(20, Math.round(avgWind * 1.5));
  return [
    { label: "Wind Speed (Power Curve)", contribution: windImpact, direction: "positive" },
    { label: "Turbulence & Wake Effects", contribution: turbulenceImpact, direction: "negative" },
    { label: "Historical Persistence", contribution: 15, direction: "positive" },
    { label: "Atmospheric Pressure", contribution: Math.max(5, 100 - windImpact - turbulenceImpact - 15), direction: "positive" },
  ];
}

// ────────────────────────────────────────────
// Ramp Event Early Warning (Feature 6)
// Generates SLDC-formatted alert details
// ────────────────────────────────────────────
export interface RampEventDetail {
  magnitudeMW: number;
  durationMinutes: number;
  affectedPlant: string;
  causalEvent: string;
  thermalReserveRecommendation: string;
}

export function generateRampEventDetail(
  plantName: string,
  previousMW: number,
  currentMW: number,
  weather: WeatherPoint | undefined,
): RampEventDetail {
  const delta = Math.abs(currentMW - previousMW);
  const isDropping = currentMW < previousMW;

  let causalEvent = "Unidentified weather transition";
  if (weather) {
    const cloud = weather.cloudCover ?? 0;
    const wind = weather.windSpeed ?? 6;
    if (cloud > 0.7) causalEvent = `Dense cloud cover (${(cloud * 100).toFixed(0)}%) reducing solar irradiance`;
    else if (wind < 3) causalEvent = `Wind speed below cut-in threshold (${wind.toFixed(1)} m/s)`;
    else if (wind > 20) causalEvent = `High wind speed approaching cut-out (${wind.toFixed(1)} m/s)`;
    else if (isDropping) causalEvent = `Rapid weather front passage with ${(cloud * 100).toFixed(0)}% cloud buildup`;
    else causalEvent = `Cloud clearing event — irradiance recovery expected`;
  }

  return {
    magnitudeMW: Number(delta.toFixed(1)),
    durationMinutes: 30,
    affectedPlant: plantName,
    causalEvent,
    thermalReserveRecommendation: delta > 50
      ? `URGENT: Ramp up ${Math.ceil(delta * 1.1)} MW thermal reserve within 15 minutes`
      : `Advisory: Pre-position ${Math.ceil(delta * 0.8)} MW spinning reserve`,
  };
}

// ────────────────────────────────────────────
// Forecast Variance Explanation (AI)
// ────────────────────────────────────────────
export async function explainForecastVariance(
  points: ForecastPoint[],
  weather: WeatherPoint[],
  scenario: ScenarioType,
): Promise<string> {
  if (process.env.USE_MOCK_AI !== "false") {
    const avgMw = avg(points.map((p) => p.forecastMW));
    const avgCloud = avg(weather.map((w) => w.cloudCover ?? 0.2));
    const avgWind = avg(weather.map((w) => w.windSpeed ?? 6.5));
    const avgP10 = avg(points.map((p) => p.p10));
    const avgP90 = avg(points.map((p) => p.p90));
    const scenarioText =
      scenario === "OPTIMISTIC"
        ? "optimistic uplift assumptions"
        : scenario === "PESSIMISTIC"
          ? "conservative stress assumptions"
          : "baseline weather assumptions";

    return [
      `SuryaVayu AI (v0.3) used ${scenarioText} with physics-informed clear-sky grounding.`,
      `Projected mean output: ${avgMw.toFixed(1)} MW (p10: ${avgP10.toFixed(1)}, p90: ${avgP90.toFixed(1)} MW).`,
      `Cloud cover averages ${(avgCloud * 100).toFixed(0)}%, wind speed ${avgWind.toFixed(1)} m/s.`,
      `SHAP analysis identifies ${avgCloud > 0.4 ? "cloud transience" : "diurnal pattern"} as the primary variance driver for this window.`,
      `Confidence intervals are calibrated via quantile regression for 15-minute grid scheduling.`,
    ].join(" ");
  }
  throw new Error("Real AI not implemented yet — set USE_MOCK_AI=true");
}
