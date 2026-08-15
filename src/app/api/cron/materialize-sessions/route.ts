import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { materializeGymSessions } from "@/lib/activity-schedule";

// Vercel Cron: 05:00 UTC (02:00 ART) daily — see vercel.json.
// Para cada gym con bookingEnabled=true, materializa las ActivitySession de los
// próximos SESSION_HORIZON_WEEKS y deriva los ActivityBooking de las inscripciones
// activas. Idempotente — ver src/lib/activity-schedule.ts.

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error("[materialize-sessions] CRON_SECRET env var is not set — refusing to run");
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization");
  const vercelCron = req.headers.get("x-vercel-cron");
  const isAuthorized = authHeader === `Bearer ${expected}` || vercelCron === "1";
  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const gyms = await prisma.gym.findMany({
    where: { bookingEnabled: true },
    select: { id: true, slug: true },
  });

  let totalSessionsCreated = 0;
  let totalBookingsCreated = 0;
  const results: { gymId: string; slug: string; sessionsCreated: number; bookingsCreated: number }[] = [];

  for (const gym of gyms) {
    try {
      const { sessionsCreated, bookingsCreated } = await materializeGymSessions(gym.id);
      totalSessionsCreated += sessionsCreated;
      totalBookingsCreated += bookingsCreated;
      results.push({ gymId: gym.id, slug: gym.slug, sessionsCreated, bookingsCreated });
    } catch (err) {
      console.warn("[materialize-sessions] Failed to materialize gym", {
        gymId: gym.id,
        slug: gym.slug,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    gymsProcessed: gyms.length,
    totalSessionsCreated,
    totalBookingsCreated,
    results,
  });
}
