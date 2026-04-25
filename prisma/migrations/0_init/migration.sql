warn The configuration property `package.json#prisma` is deprecated and will be removed in Prisma 7. Please migrate to a Prisma config file (e.g., `prisma.config.ts`).
For more information, see: https://pris.ly/prisma-config

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."AccessState" AS ENUM ('PENDING', 'GRANTED', 'DENIED');

-- CreateEnum
CREATE TYPE "public"."CouponRule" AS ENUM ('ONCE_PER_USER', 'ONCE_GLOBAL', 'UNLIMITED');

-- CreateEnum
CREATE TYPE "public"."GymKind" AS ENUM ('GYM', 'BOX');

-- CreateEnum
CREATE TYPE "public"."RedemptionStatus" AS ENUM ('PENDING', 'CONSUMED');

-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('ADMIN', 'TEACHER', 'STUDENT', 'ACCESS');

-- CreateEnum
CREATE TYPE "public"."StudentType" AS ENUM ('GENERAL', 'PERSONALIZED');

-- CreateEnum
CREATE TYPE "public"."WodTargetType" AS ENUM ('ALL', 'GROUP', 'STUDENT', 'PERSONALIZED');

-- CreateTable
CREATE TABLE "public"."AccessLog" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "state" "public"."AccessState" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "AccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Coupon" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "instagramHandle" TEXT NOT NULL,
    "instagramUrl" TEXT NOT NULL,
    "logoKey" TEXT,
    "rule" "public"."CouponRule" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requiresConsumedSlug" TEXT,
    "hideWhenConsumed" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "fixedCode" TEXT,
    "websiteUrl" TEXT,
    "restrictions" TEXT,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CouponRedemption" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "public"."RedemptionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Group" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Gym" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "primaryColor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" "public"."GymKind" NOT NULL DEFAULT 'BOX',
    "blockedAt" TIMESTAMP(3),
    "autoBlockAfterDays" INTEGER NOT NULL DEFAULT 20,
    "nextMemberNumber" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Gym_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PR" (
    "id" TEXT NOT NULL,
    "exercise" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "date" DATE NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PR_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TeacherStudent" (
    "teacherId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,

    CONSTRAINT "TeacherStudent_pkey" PRIMARY KEY ("teacherId","studentId")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL,
    "gymId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "studentType" "public"."StudentType" NOT NULL DEFAULT 'PERSONALIZED',
    "groupId" TEXT,
    "nextPaymentDate" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blockedAt" TIMESTAMP(3),
    "lastDueNotifiedOn" DATE,
    "memberNumber" INTEGER NOT NULL,
    "canCreateOwnRoutines" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Wod" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "teacherId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "targetGroupId" TEXT,
    "targetStudentId" TEXT,
    "targetType" "public"."WodTargetType" NOT NULL DEFAULT 'ALL',
    "title" TEXT NOT NULL DEFAULT 'WOD',

    CONSTRAINT "Wod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccessLog_gymId_at_idx" ON "public"."AccessLog"("gymId" ASC, "at" DESC);

-- CreateIndex
CREATE INDEX "AccessLog_gymId_state_at_idx" ON "public"."AccessLog"("gymId" ASC, "state" ASC, "at" ASC);

-- CreateIndex
CREATE INDEX "AccessLog_userId_idx" ON "public"."AccessLog"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_slug_key" ON "public"."Coupon"("slug" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "CouponRedemption_code_key" ON "public"."CouponRedemption"("code" ASC);

-- CreateIndex
CREATE INDEX "CouponRedemption_couponId_status_idx" ON "public"."CouponRedemption"("couponId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "CouponRedemption_userId_couponId_idx" ON "public"."CouponRedemption"("userId" ASC, "couponId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Group_teacherId_name_key" ON "public"."Group"("teacherId" ASC, "name" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Gym_slug_key" ON "public"."Gym"("slug" ASC);

-- CreateIndex
CREATE INDEX "PR_studentId_idx" ON "public"."PR"("studentId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "public"."PushSubscription"("endpoint" ASC);

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "public"."PushSubscription"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_gymId_key" ON "public"."User"("email" ASC, "gymId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_gymId_memberNumber_key" ON "public"."User"("gymId" ASC, "memberNumber" ASC);

-- CreateIndex
CREATE INDEX "Wod_teacherId_date_idx" ON "public"."Wod"("teacherId" ASC, "date" DESC);

-- AddForeignKey
ALTER TABLE "public"."AccessLog" ADD CONSTRAINT "AccessLog_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AccessLog" ADD CONSTRAINT "AccessLog_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "public"."Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AccessLog" ADD CONSTRAINT "AccessLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CouponRedemption" ADD CONSTRAINT "CouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "public"."Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Group" ADD CONSTRAINT "Group_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PR" ADD CONSTRAINT "PR_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TeacherStudent" ADD CONSTRAINT "TeacherStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TeacherStudent" ADD CONSTRAINT "TeacherStudent_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "public"."Gym"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Wod" ADD CONSTRAINT "Wod_targetGroupId_fkey" FOREIGN KEY ("targetGroupId") REFERENCES "public"."Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Wod" ADD CONSTRAINT "Wod_targetStudentId_fkey" FOREIGN KEY ("targetStudentId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Wod" ADD CONSTRAINT "Wod_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

