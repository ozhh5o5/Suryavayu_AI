import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

async function main() {
  console.log("Dumping DB...");

  const plants = await prisma.plant.findMany();
  const generation = await prisma.generation.findMany({
    // take only last 7 days to keep file size reasonable for SPA
    where: { timestamp: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) } },
    orderBy: { timestamp: 'asc' }
  });
  const weather = await prisma.weatherReading.findMany({
    where: { timestamp: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) } },
    orderBy: { timestamp: 'asc' }
  });
  const forecasts = await prisma.forecast.findMany();
  const alerts = await prisma.alert.findMany();
  const models = await prisma.modelVersion.findMany();
  const accuracy = await prisma.forecastAccuracy.findMany();

  const data = {
    plants,
    generation,
    weather,
    forecasts,
    alerts,
    models,
    accuracy,
  };

  const dir = path.join(process.cwd(), "src", "data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const filePath = path.join(dir, "mock-data.ts");
  const content = `export const DATA = ${JSON.stringify(data, null, 2)};\n`;
  
  fs.writeFileSync(filePath, content, "utf-8");
  console.log("Dumped to src/data/mock-data.ts");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
