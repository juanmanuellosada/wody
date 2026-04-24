import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTodayArgentina, toInputDate } from "@/lib/dates";

// Polling endpoint para el kiosk: devuelve los AccessLog del gym en
// estado PENDING de los últimos 5 minutos + todos los resueltos del
// día indicado por ?date=YYYY-MM-DD (default: hoy en Argentina).
export async function GET(req: Request) {
  const session = await auth();
  if (
    !session?.user ||
    (session.user.role !== "ACCESS" && session.user.role !== "ADMIN")
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const gymId = session.user.gymId;
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get("date");
  const dayStr =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : toInputDate(getTodayArgentina());
  // Construimos el rango [00:00, 24:00) del día en Argentina (UTC-3), que
  // en UTC es [03:00 del día, 03:00 del siguiente).
  const dayStart = new Date(`${dayStr}T03:00:00.000Z`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const [pending, recent] = await Promise.all([
    prisma.accessLog.findMany({
      where: { gymId, state: "PENDING", at: { gte: fiveMinAgo } },
      orderBy: { at: "asc" },
      select: {
        id: true,
        at: true,
        user: {
          select: {
            id: true,
            name: true,
            role: true,
            memberNumber: true,
            nextPaymentDate: true,
            blockedAt: true,
          },
        },
      },
    }),
    prisma.accessLog.findMany({
      where: {
        gymId,
        state: { in: ["GRANTED", "DENIED"] },
        at: { gte: dayStart, lt: dayEnd },
      },
      orderBy: { at: "desc" },
      select: {
        id: true,
        at: true,
        state: true,
        decidedAt: true,
        user: {
          select: { id: true, name: true, memberNumber: true },
        },
      },
    }),
  ]);

  return NextResponse.json({ pending, recent, date: dayStr });
}
