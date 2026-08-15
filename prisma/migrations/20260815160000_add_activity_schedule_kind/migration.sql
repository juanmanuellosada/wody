-- CreateEnum
CREATE TYPE "ActivityScheduleKind" AS ENUM ('WEEKLY', 'ONE_OFF');

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "scheduleKind" "ActivityScheduleKind" NOT NULL DEFAULT 'WEEKLY';

-- AlterTable
ALTER TABLE "ActivitySlot" ADD COLUMN     "date" DATE,
ALTER COLUMN "dayOfWeek" DROP NOT NULL;

