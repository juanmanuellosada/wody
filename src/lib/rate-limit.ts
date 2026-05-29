import type { PrismaClient } from "@prisma/client";

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const CLEANUP_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Returns true if the IP is allowed, false if it should be blocked. */
export async function checkSignupRateLimit(ip: string, prisma: PrismaClient): Promise<boolean> {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const count = await prisma.signupRequestRateLimit.count({
    where: { ip, createdAt: { gt: since } },
  });
  return count < RATE_LIMIT_MAX;
}

export async function recordRateLimit(ip: string, prisma: PrismaClient): Promise<void> {
  await prisma.signupRequestRateLimit.create({ data: { ip } });
}

export async function cleanupOldRateLimits(prisma: PrismaClient): Promise<number> {
  const cutoff = new Date(Date.now() - CLEANUP_TTL_MS);
  const { count } = await prisma.signupRequestRateLimit.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return count;
}
