-- CreateEnum
CREATE TYPE "CheckInStatus" AS ENUM ('ON_TIME', 'LATE', 'VERY_LATE');

-- AlterTable
ALTER TABLE "attendance" ADD COLUMN     "checkInStatus" "CheckInStatus";
