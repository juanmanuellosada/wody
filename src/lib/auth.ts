import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { getToken } from "@auth/core/jwt";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Role, StudentType, GymKind } from "@prisma/client";
import { getBlockStatus } from "@/lib/blocking";
import { sendSelfBillingDuePush } from "@/lib/push";
import { getTodayArgentina } from "@/lib/dates";

const DAY_MS = 24 * 60 * 60 * 1000;

// ADMIN de un gym con cuota por vencer (<=7 días) o vencida: dispara la push
// de recordatorio de facturación. No bloqueante, a prueba de errores.
async function notifyBillingDueIfNeeded(gymId: string) {
  try {
    const gym = await prisma.gym.findUnique({
      where: { id: gymId },
      select: { kind: true, paymentExempt: true, subscriptionNextPaymentDate: true },
    });
    if (!gym || gym.paymentExempt || gym.kind === "PERSONAL" || !gym.subscriptionNextPaymentDate) {
      return;
    }

    const daysLeft = Math.round(
      (gym.subscriptionNextPaymentDate.getTime() - getTodayArgentina().getTime()) / DAY_MS
    );
    if (daysLeft <= 7) {
      await sendSelfBillingDuePush(gymId, daysLeft);
    }
  } catch (err) {
    console.error("[auth] Failed to send billing due push on signIn", err);
  }
}

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
        __switchMode: { label: "Switch Mode", type: "text" },
      },
      async authorize(credentials, request) {
        // ── Switch-gym branch ──────────────────────────────────────────────
        // Triggered by the /api/auth/switch-gym route handler.
        // No password check: security is enforced by verifying the current
        // session cookie (same email, emailVerifiedAt present).
        if (credentials?.__switchMode === "1") {
          const targetSlug = typeof credentials.gymSlug === "string" ? credentials.gymSlug.trim() : null;
          if (!targetSlug) return null;

          // Decode the current session from the cookie in this very request.
          // getToken uses AUTH_SECRET and defaults salt to the cookie name.
          const secret = process.env.AUTH_SECRET;
          if (!secret) return null;

          const isSecure = request.url.startsWith("https:");
          const token = await getToken({ req: request, secret, secureCookie: isSecure }).catch(() => null);

          // Must have an active session with a valid email to identify the user.
          const tokenEmail = typeof token?.email === "string" ? token.email : null;
          if (!token || !tokenEmail) return null;

          // Resolve the destination user.
          const destUser = await prisma.user.findFirst({
            where: {
              email: tokenEmail,
              deletedAt: null,
              role: "STUDENT",
              gym: { slug: targetSlug },
            },
            include: { gym: { select: { id: true, slug: true, kind: true } } },
          });
          if (!destUser || !destUser.gym) return null;

          return {
            id: destUser.id,
            email: destUser.email,
            name: destUser.name,
            role: destUser.role as Role,
            studentType: destUser.studentType as StudentType,
            canCreateOwnRoutines: destUser.canCreateOwnRoutines,
            canViewRevenue: destUser.canViewRevenue,
            gymId: destUser.gym.id,
            gymSlug: destUser.gym.slug,
            gymKind: destUser.gym.kind as GymKind,
            isEmailVerified: destUser.emailVerifiedAt !== null,
          };
        }
        // ── End switch-gym branch ──────────────────────────────────────────

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
        // Filtramos email: { not: null } como defensa en profundidad contra lites
        // (aunque email=null nunca matchearía la query por email string de todas formas).
        const emailFilter = { email, deletedAt: null, NOT: { email: null } } as const;
        const candidates = await prisma.user.findMany({
          where: gymSlug
            ? { ...emailFilter, gym: { slug: gymSlug } }
            : emailFilter,
          include: { gym: { select: { id: true, slug: true, kind: true, blockedAt: true, autoBlockAfterDays: true } } },
        });

        // SUPERADMIN can also log in without a gymSlug, so if no candidates were
        // found via the gym filter, do a fallback lookup for SUPERADMIN users.
        const superAdminCandidates = candidates.length === 0
          ? await prisma.user.findMany({
              where: { email, deletedAt: null, role: "SUPERADMIN" },
              include: { gym: { select: { id: true, slug: true, kind: true, blockedAt: true, autoBlockAfterDays: true } } },
            })
          : [];

        const allCandidates = [...candidates, ...superAdminCandidates];

        if (allCandidates.length === 0) return null;

        // Pick the first user whose password matches. With a gymSlug there's at
        // most one candidate; without it, we scan across gyms (email+password
        // collisions between gyms are vanishingly unlikely in practice).
        for (const user of allCandidates) {
          if (user.password === null) {
            throw new PendingActivationError();
          }

          const passwordValid = await compare(password, user.password);
          if (!passwordValid) continue;

          // SUPERADMIN: no gym context — authenticate directly.
          if (user.role === "SUPERADMIN") {
            return {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role as Role,
              studentType: user.studentType as StudentType,
              canCreateOwnRoutines: user.canCreateOwnRoutines,
              canViewRevenue: user.canViewRevenue,
              gymId: null,
              gymSlug: null,
              gymKind: null,
              isEmailVerified: user.emailVerifiedAt !== null,
            };
          }

          if (!user.gym) {
            // Non-SUPERADMIN without a gym should not exist — skip defensively.
            continue;
          }

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
            canViewRevenue: user.canViewRevenue,
            gymId: user.gym.id,
            gymSlug: user.gym.slug,
            gymKind: user.gym.kind as GymKind,
            isEmailVerified: user.emailVerifiedAt !== null,
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
        (token as Record<string, unknown>).canViewRevenue = user.canViewRevenue;
        (token as Record<string, unknown>).gymId = user.gymId;
        (token as Record<string, unknown>).gymSlug = user.gymSlug;
        (token as Record<string, unknown>).gymKind = user.gymKind;
        (token as Record<string, unknown>).isEmailVerified = user.isEmailVerified ?? false;
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
        session.user.canViewRevenue = Boolean(
          (token as Record<string, unknown>).canViewRevenue
        );
        session.user.gymId = ((token as Record<string, unknown>).gymId as string | null) ?? null;
        session.user.gymSlug = ((token as Record<string, unknown>).gymSlug as string | null) ?? null;
        session.user.gymKind = ((token as Record<string, unknown>).gymKind as GymKind | null) ?? null;
        session.user.isEmailVerified = Boolean((token as Record<string, unknown>).isEmailVerified);
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      if (user.role === "ADMIN" && user.gymId) {
        after(() => notifyBillingDueIfNeeded(user.gymId as string));
      }
    },
  },
});
