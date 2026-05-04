-- CreateTable
CREATE TABLE "JoinRequestTeacher" (
    "joinRequestId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JoinRequestTeacher_pkey" PRIMARY KEY ("joinRequestId", "teacherId")
);

-- CreateIndex
CREATE INDEX "JoinRequestTeacher_teacherId_idx" ON "JoinRequestTeacher"("teacherId");

-- AddForeignKey
ALTER TABLE "JoinRequestTeacher" ADD CONSTRAINT "JoinRequestTeacher_joinRequestId_fkey"
    FOREIGN KEY ("joinRequestId") REFERENCES "JoinRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JoinRequestTeacher" ADD CONSTRAINT "JoinRequestTeacher_teacherId_fkey"
    FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill from the old singular column
INSERT INTO "JoinRequestTeacher" ("joinRequestId", "teacherId", "createdAt")
SELECT "id", "teacherId", COALESCE("createdAt", CURRENT_TIMESTAMP)
FROM "JoinRequest"
WHERE "teacherId" IS NOT NULL;

-- Drop old FK and column
ALTER TABLE "JoinRequest" DROP CONSTRAINT IF EXISTS "JoinRequest_teacherId_fkey";
ALTER TABLE "JoinRequest" DROP COLUMN "teacherId";
