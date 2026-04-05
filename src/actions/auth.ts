"use server";

import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";

export type LoginResult =
  | { success: true }
  | { success: false; error: string };

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

  if (!email?.trim() || !password?.trim() || !gymSlug?.trim()) {
    return { success: false, error: "Completá todos los campos." };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      gymSlug,
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
        case "CredentialsSignin":
          return {
            success: false,
            error: "Email o contraseña incorrectos.",
          };
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
