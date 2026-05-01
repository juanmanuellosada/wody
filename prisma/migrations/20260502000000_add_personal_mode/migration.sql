-- AlterEnum
ALTER TYPE "GymKind" ADD VALUE 'PERSONAL';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PersonalAccessWhitelist" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "PersonalAccessWhitelist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PersonalAccessWhitelist_email_key" ON "PersonalAccessWhitelist"("email");

-- AddForeignKey
ALTER TABLE "PersonalAccessWhitelist" ADD CONSTRAINT "PersonalAccessWhitelist_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
