import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Polling endpoint para el kiosk: devuelve los AccessLog del gym en
// estado PENDING de los últimos 5 minutos + los últimos 20 resueltos
// para el feed de recientes.
export async function GET() {
  const session = await auth();
  if (
    !session?.user ||
    (session.user.role !== "ACCESS" && session.user.role !== "ADMIN")
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const gymId = session.user.gymId;
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

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
      where: { gymId, state: { in: ["GRANTED", "DENIED"] } },
      orderBy: { at: "desc" },
      take: 20,
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

  return NextResponse.json({ pending, recent });
}
