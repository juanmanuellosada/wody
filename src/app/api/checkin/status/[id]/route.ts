import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Polling endpoint para el celular del alumno: ¿cómo quedó el AccessLog
// que creé cuando escaneé? Solo el propio dueño del log puede consultarlo.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const log = await prisma.accessLog.findUnique({
    where: { id },
    select: { userId: true, state: true, at: true },
  });
  if (!log || log.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ageMs = Date.now() - log.at.getTime();
  const expired = log.state === "PENDING" && ageMs > 5 * 60 * 1000;

  return NextResponse.json({
    state: expired ? "EXPIRED" : log.state,
  });
}
