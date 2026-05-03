export interface AccuracyMetrics {
  mape: number;
  rmse: number;
  mbe: number;
  sampleSize: number;
}

/**
 * Deviation Settlement Mechanism (DSM) Penalty Calculation
 * Based on simplified CERC regulations for renewable generators.
 * Penalty depends on the absolute error percentage.
 */
export function calculateDsmPenalty(actualMW: number, forecastMW: number, capacityMW: number): number {
  const errorPct = Math.abs(actualMW - forecastMW) / Math.max(capacityMW, 0.1);
  const baseRate = 1.5; // ₹ per unit (kWh equivalent for MW/h)
  
  if (errorPct <= 0.1) return 0; // No penalty for <10% error
  if (errorPct <= 0.15) return Math.abs(actualMW - forecastMW) * baseRate * 0.5;
  if (errorPct <= 0.2) return Math.abs(actualMW - forecastMW) * baseRate * 1.0;
  return Math.abs(actualMW - forecastMW) * baseRate * 1.5; // Steep penalty for >20% error
}

function safeDiv(num: number, den: number): number {
  return den === 0 ? 0 : num / den;
}

export function computeMAPE(actual: number[], forecast: number[]): number {
  const n = Math.min(actual.length, forecast.length);
  if (n === 0) return 0;
  let sum = 0;
  let usable = 0;
  for (let i = 0; i < n; i += 1) {
    if (actual[i] === 0) continue;
    sum += Math.abs((actual[i] - forecast[i]) / actual[i]);
    usable += 1;
  }
  return usable === 0 ? 0 : (sum / usable) * 100;
}

export function computeRMSE(actual: number[], forecast: number[]): number {
  const n = Math.min(actual.length, forecast.length);
  if (n === 0) return 0;
  let mse = 0;
  for (let i = 0; i < n; i += 1) {
    const e = actual[i] - forecast[i];
    mse += e * e;
  }
  return Math.sqrt(mse / n);
}

export function computeMBE(actual: number[], forecast: number[]): number {
  const n = Math.min(actual.length, forecast.length);
  if (n === 0) return 0;
  let bias = 0;
  for (let i = 0; i < n; i += 1) {
    bias += forecast[i] - actual[i];
  }
  return safeDiv(bias, n);
}

export function computeAccuracyMetrics(actual: number[], forecast: number[]): AccuracyMetrics {
  const sampleSize = Math.min(actual.length, forecast.length);
  return {
    mape: Number(computeMAPE(actual, forecast).toFixed(2)),
    rmse: Number(computeRMSE(actual, forecast).toFixed(2)),
    mbe: Number(computeMBE(actual, forecast).toFixed(2)),
    sampleSize,
  };
}
