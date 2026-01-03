/*
  Warnings:

  - You are about to drop the column `startDate` on the `Driver` table. All the data in the column will be lost.
  - You are about to drop the column `vehicleNo` on the `Driver` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Driver_phone_key";

-- AlterTable
ALTER TABLE "Driver" DROP COLUMN "startDate",
DROP COLUMN "vehicleNo",
ADD COLUMN     "joinDate" TIMESTAMP(3);
