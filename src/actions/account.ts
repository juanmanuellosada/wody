"use server";

import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { hashToken, consumeToken } from "@/lib/email/tokens";
import { generateToken } from "@/lib/email/tokens";
import { sendEmail } from "@/lib/email/send";
import { PasswordResetEmail } from "@/lib/email/templates/PasswordResetEmail";
import React from "react";

type AccountResult = { success: true } | { success: false; error: string };

// ── Task 5.2 ─────────────────────────────────────────────────────────────────

export async function activateAccount({
  token,
  password,
  gymSlug,
}: {
  token: string;
  password: string;
  gymSlug: string;
}): Promise<AccountResult> {
  if (!token) return { success: false, error: "Link inválido." };
  if (!password || password.length < 6) {
    return { success: false, error: "La contraseña debe tener al menos 6 caracteres." };
  }

  const tokenHash = hashToken(token);
  const result = await consumeToken({ tokenHash, type: "INVITE", gymSlug });

  if (!result.ok) {
    switch (result.reason) {
      case "NOT_FOUND":
      case "WRONG_GYM":
        return { success: false, error: "Link inválido." };
      case "EXPIRED":
        return { success: false, error: "Este link expiró. Pedile a tu admin que reenvíe la invitación." };
      case "CONSUMED":
        return {
          success: false,
          error: "Este link ya fue usado. Si olvidaste tu contraseña, usá 'Olvidé mi contraseña' en el login.",
        };
    }
  }

  const hashedPassword = await hash(password, 10);

  await prisma.user.update({
    where: { id: result.user.id },
    data: { password: hashedPassword, emailVerifiedAt: new Date() },
  });

  return { success: true };
}

// ── Task 5.3 ─────────────────────────────────────────────────────────────────

export async function requestPasswordReset({
  gymSlug,
  email,
}: {
  gymSlug: string;
  email: string;
}): Promise<{ success: true }> {
  // Anti-enumeration: always return success to the caller.

  if (!gymSlug || !email) return { success: true };

  const gym = await prisma.gym.findUnique({
    where: { slug: gymSlug },
    select: { id: true, name: true, primaryColor: true, logo: true, kind: true },
  });
  if (!gym) return { success: true };

  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.user.findFirst({
    where: { email: normalizedEmail, gymId: gym.id, deletedAt: null },
    select: { id: true, name: true, email: true },
  });
  if (!user) return { success: true };

  // Rate limit: max 5 RESET requests per (email, gymId) in the last hour.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentCount = await prisma.emailLog.count({
    where: {
      to: normalizedEmail,
      type: "RESET",
      gymId: gym.id,
      sentAt: { gte: oneHourAgo },
    },
  });
  if (recentCount >= 5) return { success: true };

  // Invalidate any existing RESET tokens for this user.
  await prisma.verificationToken.updateMany({
    where: { userId: user.id, type: "RESET", consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.verificationToken.create({
    data: {
      userId: user.id,
      tokenHash: token.hash,
      type: "RESET",
      expiresAt,
      consumedAt: null,
    },
  });

  const resetUrl = `${process.env.APP_URL}/${gymSlug}/recuperar?token=${token.plain}`;

  await sendEmail({
    to: normalizedEmail,
    gymId: gym.id,
    type: "RESET",
    subject: `Restablecé tu contraseña en ${gym.name}`,
    react: React.createElement(PasswordResetEmail, {
      gym,
      recipientName: user.name,
      resetUrl,
      expiresAt,
    }),
  });

  return { success: true };
}

// ── Task 5.4 ─────────────────────────────────────────────────────────────────

export async function resetPassword({
  token,
  password,
  gymSlug,
}: {
  token: string;
  password: string;
  gymSlug: string;
}): Promise<AccountResult> {
  if (!password || password.length < 6) {
    return { success: false, error: "La contraseña debe tener al menos 6 caracteres." };
  }
  if (!token) return { success: false, error: "Link inválido o expirado, pedí uno nuevo." };

  const tokenHash = hashToken(token);
  const result = await consumeToken({ tokenHash, type: "RESET", gymSlug });

  if (!result.ok) {
    // For RESET, all failure reasons map to the same generic message.
    return { success: false, error: "Link inválido o expirado, pedí uno nuevo." };
  }

  const hashedPassword = await hash(password, 10);

  // Only update password — do NOT touch emailVerifiedAt (per spec).
  await prisma.user.update({
    where: { id: result.user.id },
    data: { password: hashedPassword },
  });

  return { success: true };
}
