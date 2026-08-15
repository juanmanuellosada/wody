import { NextRequest, NextResponse } from "next/server";
import { sendActivityReminders } from "@/lib/activity-reminders";

// Recordatorios de turno: envía por push las ActivityBooking confirmadas cuya
// sesión arranca dentro de la ventana de aviso del gym (Gym.reminderLeadHours).
// Idempotente vía ActivityBooking.reminderSentAt — ver src/lib/activity-reminders.ts.
//
// Agnóstico del disparador: seguro de invocar con cualquier frecuencia (el
// sello es lo único que decide si ya se avisó). Registrado como cron diario
// en vercel.json — piso seguro en el plan Hobby de Vercel, donde los cron
// jobs solo pueden correr una vez por día. Si el disparador cambia (scheduler
// externo cada 30 min, o cron horario al pasar a Pro), este endpoint no
// necesita tocarse — ver design.md D8.

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error("[activity-reminders] CRON_SECRET env var is not set — refusing to run");
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization");
  const vercelCron = req.headers.get("x-vercel-cron");
  const isAuthorized = authHeader === `Bearer ${expected}` || vercelCron === "1";
  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendActivityReminders();
  return NextResponse.json({ ok: true, ...result });
}
