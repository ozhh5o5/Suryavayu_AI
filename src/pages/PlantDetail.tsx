import { Link, useParams } from "react-router-dom";
import { Badge, Card, Title } from "@tremor/react";
import { PlantDetailTabs } from "@/components/plant-detail-tabs";
import { DATA } from "@/data/mock-data";
import { explainForecastVariance, simulateShapValues } from "@/lib/ai";
import { calculateDsmPenalty } from "@/lib/metrics";
import type { ForecastPoint } from "@/lib/types";

function getPlantData(id: string) {
  const plant = DATA.plants.find(p => p.id === id);
  if (!plant) return null;

  const generation = DATA.generation
    .filter(g => g.plantId === id)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 24 * 30)
    .reverse();

  const weather = DATA.weather
    .filter(w => w.plantId === id)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 24 * 30)
    .map(w => ({ ...w, timestamp: new Date(w.timestamp) }))
    .reverse();

  const plantForecasts = DATA.forecasts.filter(f => f.plantId === id && f.forHorizon === "DAY_AHEAD");
  
  const base = plantForecasts.filter(f => f.scenario === "BASE")
    .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime())[0];
  const optimistic = plantForecasts.filter(f => f.scenario === "OPTIMISTIC")
    .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime())[0];
  const pessimistic = plantForecasts.filter(f => f.scenario === "PESSIMISTIC")
    .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime())[0];

  const parse = (payload: string | null | undefined): ForecastPoint[] =>
    payload
      ? (JSON.parse(payload) as Array<{ timestamp: string; forecastMW: number; p10: number; p50: number; p90: number }>).map((row) => ({
          timestamp: new Date(row.timestamp),
          forecastMW: row.forecastMW,
          p10: row.p10,
          p50: row.p50,
          p90: row.p90,
        }))
      : [];

  const basePoints = parse(base?.points);
  const optimisticPoints = parse(optimistic?.points);
  const pessimisticPoints = parse(pessimistic?.points);
  const explanation = explainForecastVariance(basePoints, weather.slice(-24), "BASE");

  const shapValues = simulateShapValues(plant.type as any, weather.slice(-24));

  const recentGen = generation.slice(-24);
  let totalPenaltyWithout = 0;
  let totalPenaltyWith = 0;
  for (let i = 0; i < Math.min(recentGen.length, basePoints.length); i++) {
    const naiveForecast = recentGen[i].actualMW * 1.2;
    totalPenaltyWithout += calculateDsmPenalty(recentGen[i].actualMW, naiveForecast, plant.capacityMW);
    totalPenaltyWith += calculateDsmPenalty(recentGen[i].actualMW, basePoints[i]?.forecastMW ?? recentGen[i].actualMW, plant.capacityMW);
  }
  const dailyDsmSaving = Math.max(0, totalPenaltyWithout - totalPenaltyWith);

  const accuracy = DATA.accuracy
    .filter(a => a.plantId === id)
    .sort((a, b) => new Date(b.computedAt).getTime() - new Date(a.computedAt).getTime())
    .slice(0, 30);
    
  const alerts = DATA.alerts
    .filter(a => a.plantId === id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 30);

  return {
    plant, generation, weather, base, basePoints, optimisticPoints, pessimisticPoints,
    explanation, shapValues, dailyDsmSaving, accuracy, alerts,
  };
}

export default function PlantDetailPage() {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;

  const data = getPlantData(id);
  if (!data) {
    return (
      <Card>
        <p className="text-tremor-content">Plant not found.</p>
      </Card>
    );
  }

  const historyChart = data.generation.slice(-24 * 14).map((row) => ({
    time: new Date(row.timestamp).toISOString().slice(5, 16).replace("T", " "),
    Actual: row.actualMW,
    Curtailment: row.curtailedMW,
  }));

  const forecastChart = data.basePoints.map((point, idx) => ({
    time: point.timestamp.toISOString().slice(5, 16).replace("T", " "),
    Actual: data.generation[data.generation.length - data.basePoints.length + idx]?.actualMW ?? null,
    Base: point.forecastMW,
    Optimistic: data.optimisticPoints[idx]?.forecastMW ?? null,
    Pessimistic: data.pessimisticPoints[idx]?.forecastMW ?? null,
    p10: point.p10,
    p50: point.p50,
    p90: point.p90,
  }));

  const weatherChart = data.weather.slice(-24 * 7).map((row) => ({
    time: new Date(row.timestamp).toISOString().slice(5, 16).replace("T", " "),
    GHI: row.ghi ?? 0,
    Cloud: (row.cloudCover ?? 0) * 100,
    Temp: row.temperature ?? 0,
    Wind: row.windSpeed ?? 0,
  }));

  const mape7 = data.accuracy.slice(0, 7).reduce((sum, a) => sum + a.mape, 0) / Math.max(data.accuracy.slice(0, 7).length, 1);
  const mape30 = data.accuracy.reduce((sum, a) => sum + a.mape, 0) / Math.max(data.accuracy.length, 1);
  const rmse30 = data.accuracy.reduce((sum, a) => sum + a.rmse, 0) / Math.max(data.accuracy.length, 1);
  const mbe30 = data.accuracy.reduce((sum, a) => sum + a.mbe, 0) / Math.max(data.accuracy.length, 1);

  return (
    <div className="space-y-4">
      <Link to="/plants" className="text-sm font-medium text-orange-700 hover:text-orange-800">
        ← Back to plants
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Title>{data.plant.name}</Title>
          <p className="text-sm text-tremor-content">
            {data.plant.code} · {data.plant.type} · {data.plant.capacityMW.toFixed(1)} MW · {data.plant.district}
          </p>
        </div>
        <Badge color={data.plant.status === "OFFLINE" ? "red" : data.plant.status === "MAINTENANCE" ? "orange" : "emerald"}>
          {data.plant.status}
        </Badge>
      </div>

      <PlantDetailTabs
        plantType={data.plant.type as any}
        baseMeanConfidence={data.base?.meanConfidence ?? 0}
        baseModelVersion={data.base?.modelVersion ?? "sv-0.3"}
        explanation={data.explanation}
        shapValues={data.shapValues}
        dailyDsmSaving={data.dailyDsmSaving}
        forecastChart={forecastChart}
        historyChart={historyChart}
        weatherChart={weatherChart}
        mape7={mape7}
        mape30={mape30}
        rmse30={rmse30}
        mbe30={mbe30}
        accuracy={data.accuracy.map((a) => ({
          id: a.id,
          computedAt: typeof a.computedAt === "string" ? a.computedAt : (a.computedAt as any).toISOString(),
          mape: a.mape,
          rmse: a.rmse,
          mbe: a.mbe,
          sampleSize: a.sampleSize,
        }))}
        alerts={data.alerts.map((a) => ({
          id: a.id,
          title: a.title,
          description: a.description,
          type: a.type,
          severity: a.severity,
          acknowledged: a.acknowledged,
          createdAt: typeof a.createdAt === "string" ? a.createdAt : (a.createdAt as any).toISOString(),
        }))}
      />
    </div>
  );
}
