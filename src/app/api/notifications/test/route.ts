import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push";

// Solo para debug: un ADMIN puede dispararse un push a sí mismo o a otro
// usuario de su gym para confirmar que la infra anda. No se usa en el cron
// real — ese vive en /api/cron/notify-due-today.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const targetUserId = searchParams.get("userId") ?? session.user.id;

  const target = await prisma.user.findFirst({
    where: { id: targetUserId, deletedAt: null },
    select: { id: true, gymId: true, gym: { select: { name: true } } },
  });

  if (!target || target.gymId !== session.user.gymId) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const result = await sendPushToUser(
    target.id,
    target.gym.name,
    "Notificación de prueba. Si la estás viendo, las push andan."
  );

  return NextResponse.json({ ok: true, ...result });
}
