import React, { Suspense } from "react";
import type { PlantStatus } from "@/lib/types";

type PlantMapEntry = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: PlantStatus;
  capacityMW: number;
  district: string;
};

const PlantMap = React.lazy(() => import("./plant-map").then((mod) => ({ default: mod.PlantMap })));

export function PlantMapPanel({ plants }: { plants: PlantMapEntry[] }) {
  return (
    <Suspense fallback={<div className="h-[360px] flex items-center justify-center bg-orange-50 rounded-lg">Loading Map...</div>}>
      <PlantMap plants={plants} />
    </Suspense>
  );
}
