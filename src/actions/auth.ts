"use server";

import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";

export type LoginResult =
  | { success: true }
  | { success: false; error: string };

function renderBlockedMessage(code: string): string | null {
  // "blocked:manual:BOX" | "blocked:overdue:<days>:BOX|GYM"
  if (!code.startsWith("blocked:")) return null;
  const parts = code.split(":");
  if (parts[1] === "overdue") {
    const days = Number(parts[2]);
    const word = parts[3] === "GYM" ? "gym" : "box";
    const dayWord = days === 1 ? "día" : "días";
    return `Tu cuota está vencida hace ${days} ${dayWord}. Contactá con tu ${word}.`;
  }
  if (parts[1] === "manual") {
    const word = parts[2] === "GYM" ? "gym" : "box";
    return `Tu cuenta está bloqueada. Contactá con tu ${word}.`;
  }
  return null;
}

/**
 * Server Action: authenticate with email + password + gymSlug.
 * Returns a typed error on failure.
 * On success, returns { success: true } so the client can fetch
 * the session, determine the role and gymSlug, and redirect accordingly.
 */
export async function login(formData: FormData): Promise<LoginResult> {
  const email = formData.get("email") as string | null;
  const password = formData.get("password") as string | null;
  const gymSlug = formData.get("gymSlug") as string | null;

  if (!email?.trim() || !password?.trim()) {
    return { success: false, error: "Completá email y contraseña." };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      ...(gymSlug?.trim() ? { gymSlug } : {}),
      redirect: false,
    });

    return { success: true };
  } catch (error) {
    // NextAuth v5 may throw NEXT_REDIRECT — don't catch it
    if (
      error instanceof Error &&
      (error.message === "NEXT_REDIRECT" ||
        error.message.startsWith("NEXT_REDIRECT"))
    ) {
      throw error;
    }

    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin": {
          const code = (error as unknown as { code?: string }).code ?? "";
          const blockedMsg = renderBlockedMessage(code);
          return {
            success: false,
            error: blockedMsg ?? "Email o contraseña incorrectos.",
          };
        }
        case "CallbackRouteError":
          return {
            success: false,
            error: "Email o contraseña incorrectos.",
          };
        default:
          return {
            success: false,
            error: "Error al iniciar sesión. Intentá de nuevo.",
          };
      }
    }

    return {
      success: false,
      error: "Error inesperado. Intentá de nuevo.",
    };
  }
}
