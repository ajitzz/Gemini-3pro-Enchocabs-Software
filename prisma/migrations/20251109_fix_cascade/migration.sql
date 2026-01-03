-- prisma/migrations/20251109_fix_cascade/migration.sql
ALTER TABLE "WeeklyEarning" DROP CONSTRAINT IF EXISTS "WeeklyEarning_driverId_fkey";
ALTER TABLE "WeeklyEarning"
  ADD CONSTRAINT "WeeklyEarning_driverId_fkey"
  FOREIGN KEY ("driverId") REFERENCES "Driver"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;