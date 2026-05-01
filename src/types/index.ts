import type { Role, StudentType, GymKind } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      studentType: StudentType;
      canCreateOwnRoutines: boolean;
      gymId: string;
      gymSlug: string;
      gymKind: GymKind;
      isPlatformAdmin: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
    studentType: StudentType;
    canCreateOwnRoutines: boolean;
    gymId: string;
    gymSlug: string;
    gymKind: GymKind;
    isPlatformAdmin: boolean;
  }
}

// In NextAuth v5, JWT augmentation lives in @auth/core/types
declare module "@auth/core/types" {
  interface User {
    role: Role;
    studentType: StudentType;
    canCreateOwnRoutines: boolean;
    gymId: string;
    gymSlug: string;
    gymKind: GymKind;
    isPlatformAdmin: boolean;
  }
}

export type {};
