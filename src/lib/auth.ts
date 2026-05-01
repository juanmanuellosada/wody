import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Role, StudentType, GymKind } from "@prisma/client";
import { getBlockStatus } from "@/lib/blocking";

// Apply type augmentations
import "@/types/index";

// Serialized into the login error so the server action can render a
// user-facing message. Format: "blocked:manual:BOX" | "blocked:overdue:7:GYM".
class UserBlockedError extends CredentialsSignin {
  code: string;
  constructor(code: string) {
    super();
    this.code = code;
  }
}

// User was invited but hasn't set a password yet (PENDING_ACTIVATION flow).
class PendingActivationError extends CredentialsSignin {
  code = "PENDING_ACTIVATION";
}

// Personal mode user hasn't confirmed their email yet.
class PersonalUnverifiedError extends CredentialsSignin {
  code = "personal_unverified";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  // 90 días: queremos que la PWA mantenga la sesión aunque el usuario
  // pase tiempo sin abrirla. Default de NextAuth es 30.
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 90 },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        gymSlug: { label: "Gym Slug", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;
        const gymSlug =
          typeof credentials.gymSlug === "string" && credentials.gymSlug.trim()
            ? credentials.gymSlug
            : null;

        // Candidate users: filtered by gymSlug when provided, otherwise any gym.
        const candidates = await prisma.user.findMany({
          where: gymSlug
            ? { email, deletedAt: null, gym: { slug: gymSlug } }
            : { email, deletedAt: null },
          include: { gym: { select: { id: true, slug: true, kind: true, blockedAt: true, autoBlockAfterDays: true } } },
        });

        if (candidates.length === 0) return null;

        // Pick the first user whose password matches. With a gymSlug there's at
        // most one candidate; without it, we scan across gyms (email+password
        // collisions between gyms are vanishingly unlikely in practice).
        for (const user of candidates) {
          if (user.password === null) {
            throw new PendingActivationError();
          }

          const passwordValid = await compare(password, user.password);
          if (!passwordValid) continue;

          if (user.gym.blockedAt) {
            throw new UserBlockedError("gym_blocked");
          }

          const status = getBlockStatus(
            {
              role: user.role,
              blockedAt: user.blockedAt,
              nextPaymentDate: user.nextPaymentDate,
            },
            user.gym.autoBlockAfterDays
          );
          if (status.blocked) {
            const gymKind = user.gym.kind;
            throw new UserBlockedError(
              status.kind === "overdue"
                ? `blocked:overdue:${status.days}:${gymKind}`
                : `blocked:manual:${gymKind}`
            );
          }

          // Personal mode: block login if email hasn't been confirmed yet.
          // Traditional gym users may have emailVerifiedAt = null (invited flow) — not blocked here.
          if (user.gym.kind === "PERSONAL" && user.emailVerifiedAt === null) {
            throw new PersonalUnverifiedError();
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role as Role,
            studentType: user.studentType as StudentType,
            canCreateOwnRoutines: user.canCreateOwnRoutines,
            gymId: user.gym.id,
            gymSlug: user.gym.slug,
            gymKind: user.gym.kind as GymKind,
            isPlatformAdmin: user.isPlatformAdmin,
          };
        }

        return null;
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id as string;
        (token as Record<string, unknown>).role = user.role as Role;
        (token as Record<string, unknown>).studentType = user.studentType as StudentType;
        (token as Record<string, unknown>).canCreateOwnRoutines = user.canCreateOwnRoutines;
        (token as Record<string, unknown>).gymId = user.gymId;
        (token as Record<string, unknown>).gymSlug = user.gymSlug;
        (token as Record<string, unknown>).gymKind = user.gymKind;
        (token as Record<string, unknown>).isPlatformAdmin = user.isPlatformAdmin;
      }
      return token;
    },
    session({ session, token }) {
      if (token) {
        session.user.id = token.sub as string;
        session.user.role = (token as Record<string, unknown>).role as Role;
        session.user.studentType = (token as Record<string, unknown>).studentType as StudentType;
        session.user.canCreateOwnRoutines = Boolean(
          (token as Record<string, unknown>).canCreateOwnRoutines
        );
        session.user.gymId = (token as Record<string, unknown>).gymId as string;
        session.user.gymSlug = (token as Record<string, unknown>).gymSlug as string;
        session.user.gymKind = (token as Record<string, unknown>).gymKind as GymKind;
        session.user.isPlatformAdmin = Boolean(
          (token as Record<string, unknown>).isPlatformAdmin
        );
      }
      return session;
    },
  },
});
