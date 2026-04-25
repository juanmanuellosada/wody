import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Role, StudentType } from "@prisma/client";
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
          include: { gym: true },
        });

        if (candidates.length === 0) return null;

        // Pick the first user whose password matches. With a gymSlug there's at
        // most one candidate; without it, we scan across gyms (email+password
        // collisions between gyms are vanishingly unlikely in practice).
        for (const user of candidates) {
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

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role as Role,
            studentType: user.studentType as StudentType,
            canCreateOwnRoutines: user.canCreateOwnRoutines,
            gymId: user.gym.id,
            gymSlug: user.gym.slug,
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
      }
      return session;
    },
  },
});
