import type { Role, StudentType } from "@prisma/client";
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
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
    studentType: StudentType;
    canCreateOwnRoutines: boolean;
    gymId: string;
    gymSlug: string;
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
  }
}

export type {};
