-- CreateTable
CREATE TABLE "analyses" (
    "id" TEXT NOT NULL,
    "project_name" TEXT NOT NULL,
    "station_name" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "design_esal_millions" DOUBLE PRECISION NOT NULL,
    "design_speed_kmh" DOUBLE PRECISION NOT NULL,
    "accept_consider_bump" BOOLEAN NOT NULL DEFAULT false,
    "reliability_percent" INTEGER NOT NULL DEFAULT 98,
    "file_name" TEXT NOT NULL,
    "file_sha256" TEXT NOT NULL,
    "station" JSONB NOT NULL,
    "climate" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "climate_grade" TEXT NOT NULL,
    "final_grade" TEXT NOT NULL,
    "engine_version" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "analyses_created_at_idx" ON "analyses"("created_at");
