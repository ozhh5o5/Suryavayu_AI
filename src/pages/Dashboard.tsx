import { Link } from "react-router-dom";
import { AreaChart, Badge, Card, Metric, Text, Title } from "@tremor/react";
import { DATA } from "@/data/mock-data";
import { parseForecastPoints } from "@/lib/data";
import { PlantMapPanel } from "@/components/plant-map-panel";
import type { PlantStatus } from "@/lib/types";

function getDashboardData() {
  const plants = [...DATA.plants].sort((a, b) => a.name.localeCompare(b.name));
  
  const latestGeneration = plants.map((plant) => {
    const plantGen = DATA.generation.filter(g => g.plantId === plant.id);
    const latest = plantGen.length > 0 ? plantGen[plantGen.length - 1] : null;
    return { plantId: plant.id, mw: latest?.actualMW ?? 0 };
  });

  const baselineForecasts = plants.map((plant) => {
    const plantForecasts = DATA.forecasts.filter(
      f => f.plantId === plant.id && f.scenario === "BASE" && f.forHorizon === "DAY_AHEAD"
    );
    const f = plantForecasts.length > 0 ? plantForecasts[plantForecasts.length - 1] : null;
    const first = f ? parseForecastPoints(f.points)[0] : null;
    return { plantId: plant.id, mw: first?.forecastMW ?? 0 };
  });

  const totalCapacity = plants.reduce((sum, p) => sum + p.capacityMW, 0);
  const currentOutput = latestGeneration.reduce((sum, row) => sum + row.mw, 0);
  const tomorrowForecast = baselineForecasts.reduce((sum, row) => sum + row.mw, 0);
  
  const openAlertsCount = DATA.alerts.filter(a => !a.acknowledged).length;
  
  const recentAlerts = [...DATA.alerts]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8)
    .map(alert => ({
      ...alert,
      plant: plants.find(p => p.id === alert.plantId) || null
    }));

  const weekStart = new Date(Date.now() - 7 * 24 * 3600 * 1000).getTime();
  const timelineRows = DATA.generation
    .filter(g => new Date(g.timestamp).getTime() >= weekStart)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const hourlyBuckets = new Map<string, { actual: number; forecast: number }>();
  for (const row of timelineRows) {
    const hourStamp = new Date(row.timestamp);
    hourStamp.setMinutes(0, 0, 0);
    const key = hourStamp.toISOString().slice(0, 16);
    const bucket = hourlyBuckets.get(key) ?? { actual: 0, forecast: 0 };
    bucket.actual += row.actualMW;
    bucket.forecast += row.availableMW;
    hourlyBuckets.set(key, bucket);
  }

  const timeline = Array.from(hourlyBuckets.entries()).map(([hour, value]) => {
    const hourInt = parseInt(hour.slice(11, 13));
    const noise = 1 + (Math.sin(hourInt / 4) * 0.05) + (Math.random() * 0.04 - 0.02);
    return {
      hour: hour.slice(5, 16).replace("T", " "),
      Actual: Number(value.actual.toFixed(2)),
      Forecast: Number((value.forecast * noise).toFixed(2)),
    };
  });

  const clusters = Array.from(new Set(plants.map((p) => p.district))).map((district) => {
    const clusterPlants = plants.filter((p) => p.district === district);
    const clusterCapacity = clusterPlants.reduce((sum, p) => sum + p.capacityMW, 0);
    const clusterOutput = clusterPlants.reduce((sum, p) => {
      const gen = latestGeneration.find((g) => g.plantId === p.id);
      return sum + (gen?.mw ?? 0);
    }, 0);
    const solarCount = clusterPlants.filter((p) => p.type === "SOLAR_PV").length;
    const windCount = clusterPlants.filter((p) => p.type === "WIND").length;
    return { name: district, capacity: clusterCapacity, output: clusterOutput, count: clusterPlants.length, solarCount, windCount };
  });

  const solarPlants = plants.filter((p) => p.type === "SOLAR_PV");
  const windPlants = plants.filter((p) => p.type === "WIND");
  const regionStats = {
    solarCapacity: solarPlants.reduce((s, p) => s + p.capacityMW, 0),
    solarOutput: solarPlants.reduce((s, p) => {
      const gen = latestGeneration.find((g) => g.plantId === p.id);
      return s + (gen?.mw ?? 0);
    }, 0),
    windCapacity: windPlants.reduce((s, p) => s + p.capacityMW, 0),
    windOutput: windPlants.reduce((s, p) => {
      const gen = latestGeneration.find((g) => g.plantId === p.id);
      return s + (gen?.mw ?? 0);
    }, 0),
  };

  return { plants, totalCapacity, currentOutput, tomorrowForecast, openAlerts: openAlertsCount, recentAlerts, timeline, clusters, regionStats };
}

export default function DashboardPage() {
  const data = getDashboardData();

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card decoration="top" decorationColor="orange">
          <Text>Total Capacity</Text>
          <Metric>{data.totalCapacity.toFixed(1)} MW</Metric>
        </Card>
        <Card decoration="top" decorationColor="amber">
          <Text>Current Output</Text>
          <Metric>{data.currentOutput.toFixed(1)} MW</Metric>
        </Card>
        <Card decoration="top" decorationColor="yellow">
          <Text>Tomorrow Forecast</Text>
          <Metric>{data.tomorrowForecast.toFixed(1)} MW</Metric>
        </Card>
        <Card decoration="top" decorationColor="red">
          <Text>Open Alerts</Text>
          <Metric>{data.openAlerts}</Metric>
        </Card>
      </div>

      <Card>
        <Title>Network-wide actual vs forecast (last 7 days)</Title>
        <AreaChart className="mt-4 h-80" data={data.timeline} index="hour" categories={["Actual", "Forecast"]} colors={["orange", "amber"]} />
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card decoration="left" decorationColor="amber">
          <div className="flex items-center justify-between">
            <div>
              <Text>☀️ Karnataka Solar Fleet</Text>
              <Metric>{data.regionStats.solarOutput.toFixed(1)} MW</Metric>
            </div>
            <div className="text-right">
              <Text>Installed</Text>
              <Text className="text-lg font-semibold text-slate-900">{data.regionStats.solarCapacity.toFixed(0)} MW</Text>
              <Text className="text-xs">{((data.regionStats.solarOutput / Math.max(data.regionStats.solarCapacity, 1)) * 100).toFixed(1)}% CUF</Text>
            </div>
          </div>
        </Card>
        <Card decoration="left" decorationColor="slate">
          <div className="flex items-center justify-between">
            <div>
              <Text>🌬️ Karnataka Wind Fleet</Text>
              <Metric>{data.regionStats.windOutput.toFixed(1)} MW</Metric>
            </div>
            <div className="text-right">
              <Text>Installed</Text>
              <Text className="text-lg font-semibold text-slate-900">{data.regionStats.windCapacity.toFixed(0)} MW</Text>
              <Text className="text-xs">{((data.regionStats.windOutput / Math.max(data.regionStats.windCapacity, 1)) * 100).toFixed(1)}% CUF</Text>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {data.clusters.map((cluster) => (
          <Card key={cluster.name}>
            <Title>{cluster.name} Cluster</Title>
            <Text>{cluster.count} plants ({cluster.solarCount} solar, {cluster.windCount} wind)</Text>
            <div className="mt-4 flex items-end justify-between">
              <div>
                <Text>Generation</Text>
                <Metric>{cluster.output.toFixed(1)} MW</Metric>
              </div>
              <div className="text-right">
                <Text>Capacity</Text>
                <Text className="font-medium text-slate-900">{cluster.capacity.toFixed(0)} MW</Text>
              </div>
            </div>
            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div 
                className="h-full bg-orange-500 transition-all" 
                style={{ width: `${Math.min(100, (cluster.output / cluster.capacity) * 100)}%` }}
              />
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <Title>Plant map</Title>
          <Text>Status colored markers across Karnataka.</Text>
          <div className="mt-4">
            <PlantMapPanel
              plants={data.plants.map((p) => ({
                id: p.id,
                name: p.name,
                lat: p.lat,
                lng: p.lng,
                status: p.status as PlantStatus,
                capacityMW: p.capacityMW,
                district: p.district,
              }))}
            />
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <Title>Recent alerts</Title>
            <Link to="/alerts" className="text-sm font-medium text-orange-700">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {data.recentAlerts.map((alert) => (
              <div key={alert.id} className="rounded-md border border-orange-100 p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <Badge color={alert.severity === "CRITICAL" ? "red" : alert.severity === "HIGH" ? "orange" : "amber"}>
                    {alert.severity}
                  </Badge>
                  <Text>{new Date(alert.createdAt).toLocaleString()}</Text>
                </div>
                <p className="text-sm font-medium">{alert.title}</p>
                <p className="text-xs text-slate-600">{alert.plant?.name ?? "Network"} · {alert.type}</p>
              </div>
            ))}
          </div>
          <button
            className="mt-4 inline-block rounded-md bg-orange-600 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-700 cursor-not-allowed opacity-50"
            disabled
          >
            Generate Forecasts (API Disabled in SPA)
          </button>
        </Card>
      </div>
    </div>
  );
}
