import { Link } from "react-router-dom";
import { Badge, Card, Select, SelectItem, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow, Title } from "@tremor/react";
import { DATA } from "@/data/mock-data";
import { parseForecastPoints } from "@/lib/data";

function getPlants() {
  const plants = [...DATA.plants].sort((a, b) => a.name.localeCompare(b.name));
  
  return plants.map((plant) => {
    const plantGen = DATA.generation.filter(g => g.plantId === plant.id);
    const latest = plantGen.length > 0 ? plantGen[plantGen.length - 1] : null;
    
    const plantForecasts = DATA.forecasts.filter(
      f => f.plantId === plant.id && f.scenario === "BASE" && f.forHorizon === "DAY_AHEAD"
    ).sort((a, b) => new Date(a.issuedAt).getTime() - new Date(b.issuedAt).getTime());
    const forecast = plantForecasts.length > 0 ? plantForecasts[plantForecasts.length - 1] : null;
    
    const plantAcc = DATA.accuracy.filter(a => a.plantId === plant.id)
      .sort((a, b) => new Date(a.computedAt).getTime() - new Date(b.computedAt).getTime());
    const mape = plantAcc.length > 0 ? plantAcc[plantAcc.length - 1] : null;

    const tomorrow = forecast ? Number((parseForecastPoints(forecast.points))[0]?.forecastMW ?? 0) : 0;
    
    return { plant, latestMW: latest?.actualMW ?? 0, tomorrow, mape: mape?.mape ?? null };
  });
}

export default function PlantsPage() {
  const rows = getPlants();

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <Title>Plants</Title>
          <p className="text-sm text-slate-600">Filter and monitor all solar and wind assets.</p>
        </div>
        <div className="flex gap-2">
          <Select defaultValue="ALL" className="w-40">
            <SelectItem value="ALL">All types</SelectItem>
            <SelectItem value="SOLAR_PV">Solar</SelectItem>
            <SelectItem value="WIND">Wind</SelectItem>
          </Select>
          <Select defaultValue="ALL" className="w-40">
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
            <SelectItem value="CURTAILED">Curtailed</SelectItem>
            <SelectItem value="OFFLINE">Offline</SelectItem>
          </Select>
        </div>
      </div>

      <Card>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Plant</TableHeaderCell>
              <TableHeaderCell>Type</TableHeaderCell>
              <TableHeaderCell>District</TableHeaderCell>
              <TableHeaderCell>Capacity MW</TableHeaderCell>
              <TableHeaderCell>Current MW</TableHeaderCell>
              <TableHeaderCell>Tomorrow MW</TableHeaderCell>
              <TableHeaderCell>MAPE</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.plant.id}>
                <TableCell>
                  <Link to={`/plants/${row.plant.id}`} className="font-medium text-orange-700 hover:text-orange-800">
                    {row.plant.code} · {row.plant.name}
                  </Link>
                </TableCell>
                <TableCell>{row.plant.type === "SOLAR_PV" ? "Solar" : "Wind"}</TableCell>
                <TableCell>{row.plant.district}</TableCell>
                <TableCell>{row.plant.capacityMW.toFixed(1)}</TableCell>
                <TableCell>{row.latestMW.toFixed(1)}</TableCell>
                <TableCell>{row.tomorrow.toFixed(1)}</TableCell>
                <TableCell>{row.mape === null ? "NA" : `${row.mape.toFixed(2)}%`}</TableCell>
                <TableCell>
                  <Badge color={row.plant.status === "OFFLINE" ? "red" : row.plant.status === "MAINTENANCE" ? "orange" : "emerald"}>
                    {row.plant.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
