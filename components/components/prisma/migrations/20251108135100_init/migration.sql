-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "licenseNumber" TEXT,
    "vehicleNo" TEXT,
    "startDate" TIMESTAMP(3),
    "profileImageUrl" TEXT,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyEarning" (
    "id" SERIAL NOT NULL,
    "driverId" TEXT NOT NULL,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "weekEndDate" TIMESTAMP(3) NOT NULL,
    "earningsInINR" DECIMAL(12,2) NOT NULL,
    "tripsCompleted" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyEarning_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Driver_phone_key" ON "Driver"("phone");

-- CreateIndex
CREATE INDEX "WeeklyEarning_weekStartDate_idx" ON "WeeklyEarning"("weekStartDate");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyEarning_driverId_weekStartDate_key" ON "WeeklyEarning"("driverId", "weekStartDate");
---Delete 
ALTER TABLE "WeeklyEarning" DROP CONSTRAINT IF EXISTS "WeeklyEarning_driverId_fkey";



-- Recreate the FK explicitly (make sure this matches your current schema)
ALTER TABLE "WeeklyEarning"
  ADD CONSTRAINT "WeeklyEarning_driverId_fkey"
  FOREIGN KEY ("driverId") REFERENCES "Driver"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;