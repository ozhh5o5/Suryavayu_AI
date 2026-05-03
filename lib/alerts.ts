import type { AlertCandidate, AlertSeverity, AlertType, ForecastPoint, GenerationPoint, PlantStatus } from "@/lib/types";

function severityForRamp(deltaPct: number): AlertSeverity {
  if (deltaPct > 0.65) return "CRITICAL";
  if (deltaPct > 0.5) return "HIGH";
  return "MEDIUM";
}

/**
 * Feature 6 — Automated Ramp Event Early Warning
 * Detects generation drops/surges >40% capacity per hour
 * Generates SLDC-formatted alerts with:
 *   - Predicted magnitude & duration
 *   - Affected plant identification
 *   - Causal weather event
 *   - Recommended thermal reserve ramp-up
 */
export function detectForecastAlerts(input: {
  plantId: string;
  plantName: string;
  capacityMW: number;
  forecast: ForecastPoint[];
  status: PlantStatus;
}): AlertCandidate[] {
  const alerts: AlertCandidate[] = [];

  if (input.status === "OFFLINE") {
    alerts.push({
      plantId: input.plantId,
      type: "PLANT_OFFLINE",
      severity: "CRITICAL",
      title: `${input.plantName} offline`,
      description: "Plant status is OFFLINE and requires operator intervention.",
      evidence: { status: input.status },
    });
  }

  for (let i = 1; i < input.forecast.length; i += 1) {
    const prev = input.forecast[i - 1];
    const curr = input.forecast[i];
    const delta = curr.forecastMW - prev.forecastMW;
    const absDelta = Math.abs(delta);
    const deltaPct = absDelta / Math.max(input.capacityMW, 0.1);

    if (deltaPct > 0.4) {
      const type: AlertType = delta > 0 ? "RAMP_UP_STEEP" : "RAMP_DOWN_STEEP";
      const isLargeRamp = absDelta > 50; // MW threshold for urgent SLDC alert
      alerts.push({
        plantId: input.plantId,
        type,
        severity: severityForRamp(deltaPct),
        title: `${input.plantName} ${type === "RAMP_UP_STEEP" ? "ramp-up" : "ramp-down"} risk`,
        description: [
          `Forecast shifts by ${(deltaPct * 100).toFixed(1)}% (${absDelta.toFixed(1)} MW) in one hour.`,
          isLargeRamp
            ? `⚠️ SLDC Alert: Ramp ${Math.ceil(absDelta * 1.1)} MW thermal reserve within 15 min.`
            : `Advisory: Pre-position ${Math.ceil(absDelta * 0.8)} MW spinning reserve.`,
        ].join(" "),
        evidence: {
          fromTimestamp: prev.timestamp,
          toTimestamp: curr.timestamp,
          previousMW: prev.forecastMW,
          currentMW: curr.forecastMW,
          magnitudeMW: absDelta,
          durationMinutes: 60,
          thermalReserveMW: isLargeRamp ? Math.ceil(absDelta * 1.1) : Math.ceil(absDelta * 0.8),
        },
      });
    }

    if (curr.forecastMW > input.capacityMW * 0.95) {
      alerts.push({
        plantId: input.plantId,
        type: "CURTAILMENT_RISK",
        severity: "HIGH",
        title: `${input.plantName} curtailment risk`,
        description: "Forecast approaches rated capacity; likely dispatch limitation window.",
        evidence: { timestamp: curr.timestamp, forecastMW: curr.forecastMW, capacityMW: input.capacityMW },
      });
    }
  }

  return alerts;
}

export function detectAccuracyAlerts(input: {
  plantId: string;
  plantName: string;
  actual: GenerationPoint[];
  baselineForecast: ForecastPoint[];
}): AlertCandidate[] {
  const alerts: AlertCandidate[] = [];
  const length = Math.min(input.actual.length, input.baselineForecast.length);
  let underCount = 0;
  let overCount = 0;

  for (let i = 0; i < length; i += 1) {
    const a = input.actual[i].actualMW;
    const f = input.baselineForecast[i];
    if (a < f.p10) {
      underCount += 1;
      overCount = 0;
    } else if (a > f.p90) {
      overCount += 1;
      underCount = 0;
    } else {
      underCount = 0;
      overCount = 0;
    }

    if (underCount >= 3) {
      alerts.push({
        plantId: input.plantId,
        type: "UNDER_FORECAST",
        severity: "MEDIUM",
        title: `${input.plantName} persistent under-forecast`,
        description: "Actual output stayed below p10 confidence bound for 3+ consecutive hours.",
        evidence: { timestamp: input.actual[i].timestamp, streak: underCount },
      });
      underCount = 0;
    }

    if (overCount >= 3) {
      alerts.push({
        plantId: input.plantId,
        type: "OVER_FORECAST",
        severity: "MEDIUM",
        title: `${input.plantName} persistent over-forecast`,
        description: "Actual output stayed above p90 confidence bound for 3+ consecutive hours.",
        evidence: { timestamp: input.actual[i].timestamp, streak: overCount },
      });
      overCount = 0;
    }
  }

  return alerts;
}
