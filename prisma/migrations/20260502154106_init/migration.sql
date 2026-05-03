-- CreateTable
CREATE TABLE "Plant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "capacityMW" REAL NOT NULL,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "district" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "commissionedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WeatherReading" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "plantId" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "ghi" REAL,
    "cloudCover" REAL,
    "temperature" REAL,
    "windSpeed" REAL,
    "windDirection" REAL,
    "humidity" REAL,
    CONSTRAINT "WeatherReading_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Generation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "plantId" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "actualMW" REAL NOT NULL,
    "availableMW" REAL NOT NULL,
    "curtailedMW" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "Generation_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Forecast" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "plantId" TEXT NOT NULL,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "forHorizon" TEXT NOT NULL,
    "scenario" TEXT NOT NULL DEFAULT 'BASE',
    "points" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "meanConfidence" REAL NOT NULL,
    "notes" TEXT,
    CONSTRAINT "Forecast_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ForecastAccuracy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "forecastId" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mape" REAL NOT NULL,
    "rmse" REAL NOT NULL,
    "mbe" REAL NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "notes" TEXT,
    CONSTRAINT "ForecastAccuracy_forecastId_fkey" FOREIGN KEY ("forecastId") REFERENCES "Forecast" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ForecastAccuracy_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "plantId" TEXT,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Alert_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ModelVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "versionTag" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "trainedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "overallMape" REAL NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false
);

-- CreateIndex
CREATE UNIQUE INDEX "Plant_code_key" ON "Plant"("code");

-- CreateIndex
CREATE INDEX "WeatherReading_plantId_timestamp_idx" ON "WeatherReading"("plantId", "timestamp");

-- CreateIndex
CREATE INDEX "Generation_plantId_timestamp_idx" ON "Generation"("plantId", "timestamp");

-- CreateIndex
CREATE INDEX "Forecast_plantId_issuedAt_idx" ON "Forecast"("plantId", "issuedAt");

-- CreateIndex
CREATE INDEX "ForecastAccuracy_plantId_computedAt_idx" ON "ForecastAccuracy"("plantId", "computedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ModelVersion_versionTag_key" ON "ModelVersion"("versionTag");
