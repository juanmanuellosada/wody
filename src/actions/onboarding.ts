"use server";

import { prisma } from "@/lib/prisma";
import { signIn } from "@/lib/auth";
import { isTokenExpired } from "@/lib/signup-request";
import { isReservedSlug } from "@/lib/reserved-slugs";
import { uploadPublicImage } from "@/lib/blob";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";

const SLUG_REGEX = /^[a-z0-9-]+$/;

export type ValidateTokenResult =
  | { valid: true; request: { id: string; email: string; contactName: string; gymName: string; gymKindSuggested: string } }
  | { valid: false; reason: "not_found" | "expired" | "used" };

export async function validateOnboardingToken(token: string): Promise<ValidateTokenResult> {
  const req = await prisma.gymSignupRequest.findUnique({
    where: { onboardingToken: token },
    select: {
      id: true,
      email: true,
      contactName: true,
      gymName: true,
      gymKindSuggested: true,
      status: true,
      tokenExpiresAt: true,
    },
  });

  if (!req) {
    return { valid: false, reason: "not_found" };
  }

  if (req.status === "COMPLETED") {
    return { valid: false, reason: "used" };
  }

  // PENDING, REJECTED, or anything else — treat as not found (defensive)
  if (req.status !== "APPROVED" && req.status !== "EXPIRED") {
    return { valid: false, reason: "not_found" };
  }

  if (req.status === "EXPIRED" || isTokenExpired(req)) {
    return { valid: false, reason: "expired" };
  }

  return {
    valid: true,
    request: {
      id: req.id,
      email: req.email,
      contactName: req.contactName,
      gymName: req.gymName,
      gymKindSuggested: req.gymKindSuggested,
    },
  };
}

export type SubmitOnboardingInput = {
  slug: string;
  password: string;
  kind: "GYM" | "BOX";
  primaryColor?: string;
  logoFile?: File;
};

export type SubmitOnboardingResult =
  | { success: true; slug: string; signInFailed?: true }
  | { success: false; error: string; field?: "slug" | "password" };

export async function submitOnboarding(
  token: string,
  input: SubmitOnboardingInput
): Promise<SubmitOnboardingResult> {
  // TOCTOU defense: re-validate token
  const req = await prisma.gymSignupRequest.findUnique({
    where: { onboardingToken: token },
  });

  if (!req || req.status !== "APPROVED" || isTokenExpired(req)) {
    return { success: false, error: "El link de onboarding no es válido o expiró" };
  }

  const slug = input.slug.trim().toLowerCase();

  // Validate slug
  if (!slug) {
    return { success: false, error: "El slug no puede estar vacío", field: "slug" };
  }
  if (!SLUG_REGEX.test(slug)) {
    return {
      success: false,
      error: "El slug solo puede contener letras minúsculas, números y guiones",
      field: "slug",
    };
  }
  if (isReservedSlug(slug)) {
    return { success: false, error: `El slug "${slug}" está reservado`, field: "slug" };
  }

  const existingGym = await prisma.gym.findUnique({ where: { slug } });
  if (existingGym) {
    return { success: false, error: "Ese slug ya está en uso, elegí otro", field: "slug" };
  }

  // Validate password
  if (!input.password || input.password.length < 8) {
    return {
      success: false,
      error: "La contraseña debe tener al menos 8 caracteres",
      field: "password",
    };
  }

  // Upload logo if provided
  let logoUrl: string | null = null;
  if (input.logoFile) {
    try {
      const result = await uploadPublicImage(input.logoFile, "gyms");
      logoUrl = result.url;
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Error al subir el logo",
      };
    }
  }

  const passwordHash = await bcrypt.hash(input.password, 10);

  try {
    await prisma.$transaction(async (tx) => {
      const gym = await tx.gym.create({
        data: {
          name: req.gymName,
          slug,
          kind: input.kind,
          primaryColor: input.primaryColor ?? null,
          logo: logoUrl,
          trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          paymentExempt: false,
          autoBlockAfterDays: 45,
        },
      });

      await tx.user.create({
        data: {
          name: req.contactName,
          email: req.email,
          password: passwordHash,
          role: "ADMIN",
          gymId: gym.id,
          memberNumber: 1,
        },
      });

      await tx.gymSignupRequest.update({
        where: { id: req.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          gymId: gym.id,
        },
      });
    });
  } catch (err) {
    // Blob is orphaned if transaction fails — accepted by design (same as createGym)
    console.error("[onboarding] Transaction failed", {
      reqId: req.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al crear el gym. Intentá de nuevo.",
    };
  }

  // Auto-login: same pattern as src/actions/auth.ts
  try {
    await signIn("credentials", {
      email: req.email,
      password: input.password,
      gymSlug: slug,
      redirect: false,
    });
  } catch (err) {
    // NextAuth v5 throws NEXT_REDIRECT on redirect — re-throw it
    if (
      err instanceof Error &&
      (err.message === "NEXT_REDIRECT" || err.message.startsWith("NEXT_REDIRECT"))
    ) {
      throw err;
    }
    // AuthError or any other failure: gym was created, but session couldn't be set
    if (err instanceof AuthError) {
      console.warn("[onboarding] signIn failed after gym creation", {
        reqId: req.id,
        errorType: err.type,
      });
    } else {
      console.warn("[onboarding] signIn threw unexpected error after gym creation", {
        reqId: req.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return { success: true, slug, signInFailed: true };
  }

  return { success: true, slug };
}
