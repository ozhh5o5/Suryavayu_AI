import type { ForecastPoint } from "@/lib/types";

export function parseForecastPoints(points: string): ForecastPoint[] {
  const parsed = JSON.parse(points) as Array<{
    timestamp: string;
    forecastMW: number;
    p10: number;
    p50: number;
    p90: number;
  }>;
  return parsed.map((p) => ({
    timestamp: new Date(p.timestamp),
    forecastMW: p.forecastMW,
    p10: p.p10,
    p50: p.p50,
    p90: p.p90,
  }));
}
