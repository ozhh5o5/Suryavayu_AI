"use client";

import {
  AreaChart,
  Badge,
  BarChart,
  Card,
  LineChart,
  Tab,
  TabGroup,
  TabList,
  TabPanel,
  TabPanels,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  Title,
} from "@tremor/react";

export type ChartRow = Record<string, string | number | null | undefined>;

export type ShapValue = {
  label: string;
  contribution: number;
  direction: "positive" | "negative";
};

export type PlantDetailTabsProps = {
  plantType: string;
  baseMeanConfidence: number;
  baseModelVersion: string;
  explanation: string;
  shapValues: ShapValue[];
  dailyDsmSaving: number;
  forecastChart: ChartRow[];
  historyChart: ChartRow[];
  weatherChart: ChartRow[];
  mape7: number;
  mape30: number;
  rmse30: number;
  mbe30: number;
  accuracy: Array<{
    id: string;
    computedAt: string;
    mape: number;
    rmse: number;
    mbe: number;
    sampleSize: number;
  }>;
  alerts: Array<{
    id: string;
    title: string;
    description: string;
    type: string;
    severity: string;
    acknowledged: boolean;
    createdAt: string;
  }>;
};

export function PlantDetailTabs({
  plantType,
  baseMeanConfidence,
  baseModelVersion,
  explanation,
  shapValues,
  dailyDsmSaving,
  forecastChart,
  historyChart,
  weatherChart,
  mape7,
  mape30,
  rmse30,
  mbe30,
  accuracy,
  alerts,
}: PlantDetailTabsProps) {
  const weatherCategories = plantType === "SOLAR_PV" ? ["GHI", "Cloud", "Temp"] : ["Wind", "Cloud", "Temp"];

  // Aggregate hourly data into daily energy sums
  const dailyHistoryMap = new Map<string, number>();
  for (const row of historyChart) {
    const day = (row.time as string).slice(0, 5);
    const current = dailyHistoryMap.get(day) ?? 0;
    dailyHistoryMap.set(day, current + ((row.Actual as number) || 0));
  }
  const dailyHistory = Array.from(dailyHistoryMap.entries()).map(([time, Actual]) => ({
    time,
    Actual: Number(Actual.toFixed(2)),
  }));

  return (
    <TabGroup>
      <TabList variant="solid">
        <Tab>Forecast</Tab>
        <Tab>History</Tab>
        <Tab>Weather</Tab>
        <Tab>Accuracy</Tab>
        <Tab>Alerts</Tab>
      </TabList>
      <TabPanels>
        {/* ── Forecast Tab ── */}
        <TabPanel>
          <div className="space-y-4 pt-4">
            <Card>
              <Title>Forecast scenarios with quantile confidence bands</Title>
              <p className="mt-1 text-xs text-slate-500">p10/p50/p90 intervals via quantile regression · 3 scenario overlays</p>
              <div className="mt-4 h-80 w-full min-h-[20rem]">
                <LineChart
                  className="h-80"
                  data={forecastChart}
                  index="time"
                  categories={["Actual", "Base", "Optimistic", "Pessimistic", "p10", "p50", "p90"]}
                  colors={["slate", "orange", "amber", "yellow", "gray", "orange", "gray"]}
                  yAxisWidth={48}
                />
              </div>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* Confidence */}
              <Card>
                <p className="text-sm text-tremor-content">Mean confidence</p>
                <p className="text-2xl font-semibold text-tremor-content-strong">{(baseMeanConfidence * 100).toFixed(0)}%</p>
                <p className="text-xs text-tremor-content">Model: {baseModelVersion}</p>
              </Card>

              {/* Explainability */}
              <Card>
                <p className="text-sm font-medium text-tremor-content">Explainability (SuryaVayu AI)</p>
                <p className="mt-1 text-sm text-tremor-content-strong leading-relaxed">{explanation}</p>
              </Card>

              {/* SHAP Feature Importance — dynamic per-forecast */}
              <Card>
                <Title className="text-sm">SHAP Feature Importance</Title>
                <p className="text-xs text-slate-500 mb-2">Additive feature contribution to this forecast window</p>
                <div className="space-y-2">
                  {shapValues.map((f) => (
                    <div key={f.label}>
                      <div className="flex justify-between text-xs">
                        <span className="flex items-center gap-1">
                          <span className={f.direction === "negative" ? "text-red-600" : "text-emerald-600"}>
                            {f.direction === "negative" ? "▼" : "▲"}
                          </span>
                          {f.label}
                        </span>
                        <span className="font-medium">{f.contribution}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${f.contribution}%`,
                            backgroundColor: f.direction === "negative" ? "#dc2626" : "#f97316",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* DSM Cost Optimizer — dynamic savings */}
            <Card>
              <Title className="text-sm">Deviation Settlement Mechanism (DSM) Optimization</Title>
              <p className="mt-1 text-sm text-tremor-content">
                Based on CERC 2024 DSM regulations, SuryaVayu v0.3 biases forecasts toward the direction
                that minimizes asymmetric settlement penalties for the generator.
              </p>
              <div className="mt-3 flex items-center gap-6">
                <div>
                  <p className="text-xs text-slate-500">Daily penalty reduction</p>
                  <p className="text-xl font-bold text-emerald-600">₹{(dailyDsmSaving / 100000).toFixed(2)} Lakhs/day</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Annual savings estimate</p>
                  <p className="text-xl font-bold text-emerald-600">₹{((dailyDsmSaving * 365) / 10000000).toFixed(1)} Cr/year</p>
                </div>
              </div>
            </Card>
          </div>
        </TabPanel>

        {/* ── History Tab ── */}
        <TabPanel>
          <div className="space-y-4 pt-4">
            <Card>
              <Title>Generation and curtailment history</Title>
              <div className="mt-4 h-80 w-full min-h-[20rem]">
                <AreaChart
                  className="h-80"
                  data={historyChart}
                  index="time"
                  categories={["Actual", "Curtailment"]}
                  colors={["orange", "red"]}
                  yAxisWidth={48}
                />
              </div>
            </Card>
            <Card>
              <Title>Daily energy trend</Title>
              <div className="mt-4 h-72 w-full min-h-[18rem]">
                <BarChart className="h-72" data={dailyHistory} index="time" categories={["Actual"]} colors={["amber"]} yAxisWidth={48} />
              </div>
            </Card>
          </div>
        </TabPanel>

        {/* ── Weather Tab ── */}
        <TabPanel>
          <div className="space-y-4 pt-4">
            <Card>
              <Title>Weather drivers</Title>
              <div className="mt-4 h-80 w-full min-h-[20rem]">
                <LineChart
                  className="h-80"
                  data={weatherChart}
                  index="time"
                  categories={weatherCategories}
                  colors={["amber", "slate", "orange"]}
                  yAxisWidth={48}
                />
              </div>
            </Card>
            <Card>
              <p className="text-sm text-tremor-content">
                <strong>Correlation note:</strong> output dips when cloud cover exceeds 70% or wind speed stays below cut-in threshold (3 m/s).
                Temperature above 25°C causes ~0.4%/°C PV efficiency loss.
              </p>
            </Card>
          </div>
        </TabPanel>

        {/* ── Accuracy Tab ── */}
        <TabPanel>
          <div className="space-y-4 pt-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <p className="text-sm text-tremor-content">MAPE (7d)</p>
                <p className="text-2xl font-semibold text-tremor-content-strong">{mape7.toFixed(2)}%</p>
              </Card>
              <Card>
                <p className="text-sm text-tremor-content">RMSE (30 records)</p>
                <p className="text-2xl font-semibold text-tremor-content-strong">{rmse30.toFixed(2)}</p>
              </Card>
              <Card>
                <p className="text-sm text-tremor-content">MBE (30 records)</p>
                <p className="text-2xl font-semibold text-tremor-content-strong">{mbe30.toFixed(2)}</p>
              </Card>
            </div>
            <Card>
              <Title>Daily MAPE trend</Title>
              <div className="mt-4 h-72 w-full min-h-[18rem]">
                <BarChart
                  className="h-72"
                  data={accuracy.map((a) => ({
                    day: a.computedAt.slice(5, 10),
                    MAPE: a.mape,
                  }))}
                  index="day"
                  categories={["MAPE"]}
                  colors={["orange"]}
                  yAxisWidth={48}
                />
              </div>
            </Card>
            <Card>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Computed</TableHeaderCell>
                    <TableHeaderCell>MAPE</TableHeaderCell>
                    <TableHeaderCell>RMSE</TableHeaderCell>
                    <TableHeaderCell>MBE</TableHeaderCell>
                    <TableHeaderCell>Sample</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {accuracy.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{new Date(a.computedAt).toLocaleString()}</TableCell>
                      <TableCell>{a.mape.toFixed(2)}%</TableCell>
                      <TableCell>{a.rmse.toFixed(2)}</TableCell>
                      <TableCell>{a.mbe.toFixed(2)}</TableCell>
                      <TableCell>{a.sampleSize}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
            <Card>
              <p className="text-xs text-tremor-content">30-day MAPE average: {mape30.toFixed(2)}%</p>
            </Card>
          </div>
        </TabPanel>

        {/* ── Alerts Tab ── */}
        <TabPanel>
          <div className="space-y-3 pt-4">
            {alerts.map((alert) => (
              <Card key={alert.id}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-tremor-content-strong">{alert.title}</p>
                    <p className="text-sm text-tremor-content">{alert.description}</p>
                    <p className="text-xs text-tremor-content">
                      {alert.type} · {new Date(alert.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Badge color={alert.acknowledged ? "green" : "red"}>{alert.acknowledged ? "ACKED" : alert.severity}</Badge>
                </div>
              </Card>
            ))}
          </div>
        </TabPanel>
      </TabPanels>
    </TabGroup>
  );
}
