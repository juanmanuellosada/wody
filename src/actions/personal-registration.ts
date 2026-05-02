"use server";

import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { generateToken, hashToken, consumeToken } from "@/lib/email/tokens";
import { sendEmail } from "@/lib/email/send";
import { PersonalWelcomeEmail } from "@/lib/email/templates/PersonalWelcomeEmail";
import React from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type SubmitResult = { ok: true } | { ok: false; fieldErrors: Record<string, string> };

type ConfirmResult =
  | { ok: true }
  | { ok: false; reason: "invalid_token" | "expired" | "consumed" };

// ── submitPersonalRegistration ─────────────────────────────────────────────────

export async function submitPersonalRegistration({
  name,
  email,
  password,
  passwordConfirm,
  honeypot,
}: {
  name: string;
  email: string;
  password: string;
  passwordConfirm: string;
  honeypot?: string;
}): Promise<SubmitResult> {
  try {
    // Honeypot: silently succeed so bots get no signal.
    if (honeypot && honeypot.trim().length > 0) return { ok: true };

    console.log("[personal-registration] step: validating format");

    // Format validations — return specific errors so the legitimate user gets feedback.
    const fieldErrors: Record<string, string> = {};

    const trimmedName = name.trim();
    if (!trimmedName) {
      fieldErrors.name = "El nombre es obligatorio";
    } else if (trimmedName.length > 200) {
      fieldErrors.name = "El nombre es demasiado largo";
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      fieldErrors.email = "Email inválido";
    }

    if (password.length < 6) {
      fieldErrors.password = "La contraseña debe tener al menos 6 caracteres";
    }

    if (password !== passwordConfirm) {
      fieldErrors.passwordConfirm = "Las contraseñas no coinciden";
    }

    if (Object.keys(fieldErrors).length > 0) {
      return { ok: false, fieldErrors };
    }

    console.log("[personal-registration] step: looking up whitelist");

    // Check whitelist — single query, no side effects if not found.
    const entry = await prisma.personalAccessWhitelist.findUnique({
      where: { email: normalizedEmail },
    });

    // Anti-enumeration: if not in whitelist or already consumed, return ok silently.
    if (!entry || entry.consumedAt !== null) {
      console.log("[personal-registration] step: whitelist not found or consumed → silent ok");
      return { ok: true };
    }

    console.log("[personal-registration] step: whitelist found → starting transaction");

    // Email is authorized and not yet consumed — run the full creation flow.
    let tokenPlain: string;

    try {
      const token = generateToken();
      tokenPlain = token.plain;

      await prisma.$transaction(async (tx) => {
        // Find the single PERSONAL gym (must exist; run seed-personal.ts if missing).
        const personalGym = await tx.gym.findFirst({ where: { kind: "PERSONAL" } });
        if (!personalGym) {
          throw new Error(
            "No existe un gym con kind=PERSONAL. Corré prisma/seed-personal.ts antes de usar el modo personal."
          );
        }

        // Increment counter and grab the previous value as the member number.
        const updatedGym = await tx.gym.update({
          where: { id: personalGym.id },
          data: { nextMemberNumber: { increment: 1 } },
          select: { nextMemberNumber: true },
        });
        const memberNumber = updatedGym.nextMemberNumber - 1;

        // Hash password inside the transaction so we don't do it in the negative path.
        const passwordHash = await hash(password, 10);

        const user = await tx.user.create({
          data: {
            name: trimmedName,
            email: normalizedEmail,
            password: passwordHash,
            role: "STUDENT",
            studentType: "PERSONALIZED",
            canCreateOwnRoutines: true,
            gymId: personalGym.id,
            memberNumber,
            emailVerifiedAt: null,
            nextPaymentDate: new Date("9999-12-31"),
            blockedAt: null,
            deletedAt: null,
          },
        });

        // Mark whitelist entry as consumed atomically with the user creation.
        await tx.personalAccessWhitelist.update({
          where: { id: entry.id },
          data: { consumedAt: new Date() },
        });

        // Generate INVITE token (48 hours TTL).
        const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
        await tx.verificationToken.create({
          data: {
            userId: user.id,
            tokenHash: token.hash,
            type: "INVITE",
            expiresAt,
            consumedAt: null,
          },
        });
      });
    } catch (err) {
      // If the transaction fails (e.g., duplicate email), swallow and return ok
      // to preserve anti-enumeraton. Log for ops visibility.
      console.error("[personal-registration] transaction failed for email:", normalizedEmail, err);
      return { ok: true };
    }

    console.log("[personal-registration] step: transaction completed");

    // Enqueue the welcome email outside the transaction and without awaiting,
    // so the response returns before the email is sent (timing parity).
    try {
      console.log("[personal-registration] step: sending welcome email");

      const appUrl = process.env.APP_URL ?? "https://www.wody.com.ar";
      const confirmUrl = `${appUrl}/registro-personal/confirmar/${tokenPlain}`;
      const registerUrl = `${appUrl}/registro-personal`;

      void sendEmail({
        to: normalizedEmail,
        gymId: null,
        type: "PERSONAL_WELCOME",
        subject: "Confirmá tu cuenta de Wody Personal",
        react: React.createElement(PersonalWelcomeEmail, {
          recipientName: trimmedName,
          confirmUrl,
          registerUrl,
        }),
      }).catch((err) => {
        console.error("[personal-registration] email send failed:", err);
      });
    } catch (err) {
      console.error("[personal-registration] post-transaction setup failed:", err);
    }

    console.log("[personal-registration] step: returning ok");
    return { ok: true };
  } catch (err) {
    // Catch-all defensivo: cualquier cosa que se nos haya escapado.
    console.error("[personal-registration] uncaught error in submitPersonalRegistration:", err);
    return { ok: true }; // anti-enumeration
  }
}

// ── confirmPersonalAccount ─────────────────────────────────────────────────────

export async function confirmPersonalAccount({
  token,
}: {
  token: string;
}): Promise<ConfirmResult> {
  if (!token) return { ok: false, reason: "invalid_token" };

  const tokenHash = hashToken(token);

  // consumeToken validates type, expiry, gym slug, and atomically marks consumed.
  // The personal gym slug is "personal".
  const result = await consumeToken({ tokenHash, type: "INVITE", gymSlug: "personal" });

  if (!result.ok) {
    switch (result.reason) {
      case "NOT_FOUND":
      case "WRONG_GYM":
        return { ok: false, reason: "invalid_token" };
      case "EXPIRED":
        return { ok: false, reason: "expired" };
      case "CONSUMED":
        return { ok: false, reason: "consumed" };
    }
  }

  // Mark the user's email as verified.
  await prisma.user.update({
    where: { id: result.user.id },
    data: { emailVerifiedAt: new Date() },
  });

  return { ok: true };
}
