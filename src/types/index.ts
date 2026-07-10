import type { Role, StudentType, GymKind } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      studentType: StudentType;
      canCreateOwnRoutines: boolean;
      /** Permite ver la recaudación y el historial de pagos en /caja. Solo semánticamente válido para ADMIN. */
      canViewRevenue: boolean;
      gymId: string | null;
      gymSlug: string | null;
      gymKind: GymKind | null;
      /** Whether the user's email was verified at login time (used for gym-switch gate). */
      isEmailVerified: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
    studentType: StudentType;
    canCreateOwnRoutines: boolean;
    canViewRevenue: boolean;
    gymId: string | null;
    gymSlug: string | null;
    gymKind: GymKind | null;
    /** Whether the user's email was verified at login time (used for gym-switch gate). */
    isEmailVerified?: boolean;
  }
}

// In NextAuth v5, JWT augmentation lives in @auth/core/types
declare module "@auth/core/types" {
  interface User {
    role: Role;
    studentType: StudentType;
    canCreateOwnRoutines: boolean;
    canViewRevenue: boolean;
    gymId: string | null;
    gymSlug: string | null;
    gymKind: GymKind | null;
    /** Whether the user's email was verified at login time (used for gym-switch gate). */
    isEmailVerified?: boolean;
  }
}

export type {};
