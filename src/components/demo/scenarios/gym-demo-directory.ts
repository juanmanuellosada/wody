/**
 * Canonical, dependency-free GYM identity directory.
 *
 * This is composition data, not a persisted ledger: it deliberately has no
 * selected actor, storage, finance, access, booking, WOD, RM, or fixed-routine
 * records. Future route/provider code must bind one of its opaque tokens rather
 * than promote a display profile or caller-supplied role payload to authority.
 */
export const GYM_DEMO_GYM_ID = "gym-fixed-gym";

/** IDs retained from the prepared fixed-routine fixture to avoid a later migration. */
export const GYM_DEMO_ADMIN_ID = "gym-fixed-admin";
export const GYM_DEMO_PRIMARY_TEACHER_ID = "gym-fixed-teacher-linked";
export const GYM_DEMO_SECONDARY_TEACHER_ID = "gym-fixed-teacher-unlinked";
export const GYM_DEMO_GENERAL_STUDENT_ID = "gym-fixed-student-general";
export const GYM_DEMO_PERSONALIZED_STUDENT_ID = "gym-fixed-student-personalized";
export const GYM_DEMO_UNLINKED_PERSONALIZED_STUDENT_ID = "gym-fixed-student-personalized-unlinked";
export const GYM_DEMO_MUSLIB_STUDENT_ID = "gym-fixed-student-muslib";
export const GYM_DEMO_HISTORICAL_MUSLIB_LITE_STUDENT_ID = "gym-fixed-student-muslib-lite";
export const GYM_DEMO_ARCHIVED_STUDENT_ID = "gym-fixed-student-muslib-archived";

/**
 * Future finance policy can name this stable directory ID explicitly. No
 * financial privilege is persisted on a profile.
 */
export const GYM_DEMO_FINANCE_ADMIN_IDS = Object.freeze([GYM_DEMO_ADMIN_ID]);

export type GymDemoRole = "ADMIN" | "TEACHER" | "STUDENT";
export type GymDemoStudentType = "GENERAL" | "PERSONALIZED" | "MUSCULACION_LIBRE";
export type GymDemoAccountKind = "FULL" | "LITE";

/** Detached display data only. Email and every domain-ledger field are intentionally absent. */
export type GymDemoProfile = {
  id: string;
  gymId: string;
  memberNumber: number;
  name: string;
  role: GymDemoRole;
  studentType: GymDemoStudentType | null;
  accountKind: GymDemoAccountKind;
  canCreateOwnRoutines: boolean;
  deletedAt: string | null;
};

export type GymDemoTeacherStudentLink = {
  teacherId: string;
  studentId: string;
};

/** Minimal trusted identity for a future closed kernel; it is never a display profile. */
export type GymDemoCanonicalActor = Readonly<Pick<
  GymDemoProfile,
  "id" | "gymId" | "role" | "studentType" | "accountKind" | "canCreateOwnRoutines"
>>;

const canonicalProfiles = Object.freeze([
  Object.freeze({ id: GYM_DEMO_ADMIN_ID, gymId: GYM_DEMO_GYM_ID, memberNumber: 1, name: "Lucía Romero", role: "ADMIN", studentType: null, accountKind: "FULL", canCreateOwnRoutines: false, deletedAt: null }),
  Object.freeze({ id: GYM_DEMO_PRIMARY_TEACHER_ID, gymId: GYM_DEMO_GYM_ID, memberNumber: 2, name: "Tomás Ríos", role: "TEACHER", studentType: null, accountKind: "FULL", canCreateOwnRoutines: false, deletedAt: null }),
  Object.freeze({ id: GYM_DEMO_SECONDARY_TEACHER_ID, gymId: GYM_DEMO_GYM_ID, memberNumber: 3, name: "Nora Vidal", role: "TEACHER", studentType: null, accountKind: "FULL", canCreateOwnRoutines: false, deletedAt: null }),
  Object.freeze({ id: GYM_DEMO_GENERAL_STUDENT_ID, gymId: GYM_DEMO_GYM_ID, memberNumber: 4, name: "Paula Méndez", role: "STUDENT", studentType: "GENERAL", accountKind: "FULL", canCreateOwnRoutines: false, deletedAt: null }),
  Object.freeze({ id: GYM_DEMO_PERSONALIZED_STUDENT_ID, gymId: GYM_DEMO_GYM_ID, memberNumber: 5, name: "Irene Soto", role: "STUDENT", studentType: "PERSONALIZED", accountKind: "FULL", canCreateOwnRoutines: false, deletedAt: null }),
  Object.freeze({ id: GYM_DEMO_UNLINKED_PERSONALIZED_STUDENT_ID, gymId: GYM_DEMO_GYM_ID, memberNumber: 6, name: "Valeria Paz", role: "STUDENT", studentType: "PERSONALIZED", accountKind: "FULL", canCreateOwnRoutines: false, deletedAt: null }),
  Object.freeze({ id: GYM_DEMO_MUSLIB_STUDENT_ID, gymId: GYM_DEMO_GYM_ID, memberNumber: 7, name: "Micaela Torres", role: "STUDENT", studentType: "MUSCULACION_LIBRE", accountKind: "FULL", canCreateOwnRoutines: false, deletedAt: null }),
  // Historical compatibility only: group assignment mirrors the prepared fixed-routine LITE asymmetry; it is not a normal creation flow.
  Object.freeze({ id: GYM_DEMO_HISTORICAL_MUSLIB_LITE_STUDENT_ID, gymId: GYM_DEMO_GYM_ID, memberNumber: 8, name: "León Acosta", role: "STUDENT", studentType: "MUSCULACION_LIBRE", accountKind: "LITE", canCreateOwnRoutines: false, deletedAt: null }),
  Object.freeze({ id: GYM_DEMO_ARCHIVED_STUDENT_ID, gymId: GYM_DEMO_GYM_ID, memberNumber: 9, name: "Ariel Luna", role: "STUDENT", studentType: "MUSCULACION_LIBRE", accountKind: "FULL", canCreateOwnRoutines: false, deletedAt: "2025-04-01T00:00:00.000Z" }),
] satisfies readonly GymDemoProfile[]);

const canonicalLinks = Object.freeze([
  Object.freeze({ teacherId: GYM_DEMO_PRIMARY_TEACHER_ID, studentId: GYM_DEMO_GENERAL_STUDENT_ID }),
  Object.freeze({ teacherId: GYM_DEMO_PRIMARY_TEACHER_ID, studentId: GYM_DEMO_PERSONALIZED_STUDENT_ID }),
  Object.freeze({ teacherId: GYM_DEMO_PRIMARY_TEACHER_ID, studentId: GYM_DEMO_MUSLIB_STUDENT_ID }),
  Object.freeze({ teacherId: GYM_DEMO_PRIMARY_TEACHER_ID, studentId: GYM_DEMO_HISTORICAL_MUSLIB_LITE_STUDENT_ID }),
] satisfies readonly GymDemoTeacherStudentLink[]);

const profileById = new Map<string, Readonly<GymDemoProfile>>(
  canonicalProfiles.map((profile) => [profile.id, profile]),
);

/*
 * These registries are intentionally private. A token is an empty null-prototype
 * object whose identity, not its shape, authorizes a canonical actor.
 */
const tokenByActiveFullId = new Map<string, object>();
const profileByToken = new WeakMap<object, Readonly<GymDemoProfile>>();
for (const profile of canonicalProfiles) {
  if (profile.deletedAt !== null || profile.accountKind !== "FULL") continue;
  const token = Object.freeze(Object.create(null));
  tokenByActiveFullId.set(profile.id, token);
  profileByToken.set(token, profile);
}

/** Returns a fresh display snapshot; mutation cannot affect the canonical directory. */
export function getGymDemoProfiles(): GymDemoProfile[] {
  return canonicalProfiles.map((profile): GymDemoProfile => ({ ...profile }));
}

/** Exact primitive-string lookup only; arbitrary objects are not coerced or inspected. */
export function getGymDemoProfile(actorId: unknown): GymDemoProfile | null {
  if (typeof actorId !== "string") return null;
  const profile = profileById.get(actorId);
  return profile ? { ...profile } : null;
}

/** Returns fresh relationship rows; no returned row is part of authorization state. */
export function getGymDemoTeacherStudentLinks(): GymDemoTeacherStudentLink[] {
  return canonicalLinks.map((link): GymDemoTeacherStudentLink => ({ ...link }));
}

/**
 * Trusted fixture-composition API, not a real authentication or login boundary:
 * any known active FULL actor ID obtains its stable opaque demo token.
 * Production authorization must never rely on this lookup. Other IDs return null.
 */
export function getGymDemoActorToken(actorId: unknown): object | null {
  if (typeof actorId !== "string") return null;
  return tokenByActiveFullId.get(actorId) ?? null;
}

/**
 * Resolves only a private token identity. It deliberately does no reflection,
 * coercion, serialization, property access, or prototype inspection on an
 * unknown value, so poison and revoked proxies are denied without invoking traps.
 */
export function resolveGymDemoActor(token: unknown): GymDemoCanonicalActor | null {
  if (typeof token !== "object" || token === null) return null;
  let profile: Readonly<GymDemoProfile> | undefined;
  try {
    profile = profileByToken.get(token);
  } catch {
    return null;
  }
  if (!profile) return null;
  return Object.freeze({
    id: profile.id,
    gymId: profile.gymId,
    role: profile.role,
    studentType: profile.studentType,
    accountKind: profile.accountKind,
    canCreateOwnRoutines: profile.canCreateOwnRoutines,
  });
}

/*
 * Future fixed-routine bridge (not implemented here): retained actor IDs map to
 * this directory, but group eligibility and fixed-batch eligibility differ.
 * Group membership permits active PERSONALIZED or MUSCULACION_LIBRE students;
 * only PERSONALIZED requires a TeacherStudent link (src/actions/group.ts).
 * The fixed-routine batch selects only active MUSCULACION_LIBRE members and
 * does not filter accountKind (src/actions/fixed-routine.ts), so it includes
 * the historical MUSLIB-LITE row. Do not carry the prepared GENERAL membership
 * into new group assignments or invent archived-member cleanup semantics.
 */
