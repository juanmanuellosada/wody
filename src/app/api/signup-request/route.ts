import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkSignupRateLimit, recordRateLimit } from "@/lib/rate-limit";
import { sendLeadReceivedEmail } from "@/lib/signup-emails";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const {
    email,
    contactName,
    gymName,
    gymKindSuggested,
    phone,
    expectedStudents,
    message,
  } = body as Record<string, unknown>;

  // Validate required fields
  if (typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
    return NextResponse.json({ error: "Email inválido" }, { status: 400 });
  }
  if (typeof contactName !== "string" || !contactName.trim()) {
    return NextResponse.json({ error: "Nombre de contacto requerido" }, { status: 400 });
  }
  if (typeof gymName !== "string" || !gymName.trim()) {
    return NextResponse.json({ error: "Nombre del gym requerido" }, { status: 400 });
  }
  if (gymKindSuggested !== "GYM" && gymKindSuggested !== "BOX") {
    return NextResponse.json({ error: "Tipo de gym inválido (GYM o BOX)" }, { status: 400 });
  }
  if (phone !== undefined && typeof phone !== "string") {
    return NextResponse.json({ error: "Teléfono inválido" }, { status: 400 });
  }
  if (expectedStudents !== undefined && (typeof expectedStudents !== "number" || !Number.isInteger(expectedStudents))) {
    return NextResponse.json({ error: "Cantidad de alumnos inválida" }, { status: 400 });
  }
  if (message !== undefined && typeof message !== "string") {
    return NextResponse.json({ error: "Mensaje inválido" }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const ip = getClientIp(req);

  try {
    // Rate limit check
    const allowed = await checkSignupRateLimit(ip, prisma);
    if (!allowed) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes, intentá más tarde" },
        { status: 429 }
      );
    }

    // Idempotency: silently succeed if an active request already exists
    const existing = await prisma.gymSignupRequest.findFirst({
      where: {
        email: normalizedEmail,
        status: { in: ["PENDING", "APPROVED"] },
      },
    });
    if (existing) {
      return NextResponse.json({ success: true });
    }

    // Create the signup request
    const signupRequest = await prisma.gymSignupRequest.create({
      data: {
        email: normalizedEmail,
        contactName: contactName.trim(),
        gymName: gymName.trim(),
        gymKindSuggested: gymKindSuggested as string,
        phone: typeof phone === "string" ? phone.trim() || null : null,
        expectedStudents: typeof expectedStudents === "number" ? expectedStudents : null,
        message: typeof message === "string" ? message.trim() || null : null,
        status: "PENDING",
      },
    });

    // Record rate limit and send email in parallel — neither failure blocks the response
    await Promise.allSettled([
      recordRateLimit(ip, prisma),
      sendLeadReceivedEmail(signupRequest).catch((err) => {
        console.warn("[signup-request] Failed to send lead-received email", {
          id: signupRequest.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[signup-request] Unexpected error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
