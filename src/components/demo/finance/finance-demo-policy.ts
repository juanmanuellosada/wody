// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore Node's native type-stripping test runner requires explicit extensions.
import { financeCatalogSaleActors } from "./catalog-sales-contract.ts";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore Node's native type-stripping test runner requires explicit extensions.
import { GYM_DEMO_ADMIN_ID, GYM_DEMO_GYM_ID, getGymDemoProfile, getGymDemoTeacherStudentLinks, resolveGymDemoActor } from "../scenarios/gym-demo-directory.ts";
import type { FinanceDemoState, GymFinanceDemoState, KnownFinanceDemoState } from "./finance-demo-types";

/**
 * The two policies are deliberately registered here, rather than assembled by
 * callers. GYM authority is an opaque directory token; BOX retains its legacy
 * roster-shaped actor API for source compatibility.
 */
type FinancePolicyId = "box" | "gym";
type FinancePolicy = Readonly<{ id: FinancePolicyId; namespace: string; version: number }>;

const policies = Object.freeze({
  box: Object.freeze({ id: "box" as const, namespace: "wody-box-finance-demo", version: 3 }),
  gym: Object.freeze({ id: "gym" as const, namespace: "wody-gym-finance-demo", version: 1 }),
});
const resolvedActors = new WeakSet<object>();

/**
 * Structurally mirrors the bridge's GymDemoProfileLink without importing the
 * bridge: this module is called from load and adapter paths that have no
 * bridge context and must receive links only as a parameter.
 */
export type GymFinanceTeacherStudentLink = Readonly<{ teacherId: string; studentId: string }>;

/**
 * The same predicate gym-demo-profile-core.ts uses for activeTeacherIds, and
 * finance-demo-storage.ts uses for persisted assignedTeachers: a link only
 * counts when its teacher is a currently active TEACHER or ADMIN in the
 * canonical directory. Applied independently of any upstream bridge
 * validation, since this module never imports the bridge and never trusts it.
 *
 * This is purely defensive and, as of both current call sites below, cannot be
 * observed through any reachable entry point: both scopedActiveStudentIds and
 * canRecordFinancePayment only ever consult a link where `link.teacherId ===
 * actor.id`, and `actor.id` always comes from an already-resolved, currently
 * active TEACHER/ADMIN (resolveGymDemoActor only mints tokens for non-deleted
 * FULL accounts, and callers reject anything else before reaching here). A
 * link naming an unknown or soft-deleted teacher is already excluded by that
 * equality check alone, before this predicate would ever matter. It exists so
 * the guarantee still holds if a future call site stops gating on the acting
 * actor's own id — e.g. one that inspects a link belonging to someone other
 * than the caller. No test in this codebase can distinguish this predicate
 * present from absent without a soft-deleted TEACHER/ADMIN fixture, which this
 * effort has declined to add (see finance-demo-storage.ts's own equivalent,
 * long-documented gap on canonicalTeacher.deletedAt).
 */
function isActiveGymTeacherOrAdmin(id: string): boolean {
  const profile = getGymDemoProfile(id);
  return profile !== null && (profile.role === "TEACHER" || profile.role === "ADMIN") && profile.deletedAt === null;
}

/**
 * Shared link resolution for both scoping (who a TEACHER sees) and
 * authorization (who a TEACHER may charge), so the two can never
 * independently drift apart. Omitted, falls back to the canonical directory
 * link set, byte-identical to before this parameter existed. A link naming
 * an unknown or soft-deleted teacher is dropped regardless of source.
 */
export function resolveHonoredGymTeacherStudentLinks(
  gymTeacherStudentLinks: readonly GymFinanceTeacherStudentLink[] | undefined,
): readonly GymFinanceTeacherStudentLink[] {
  const source = gymTeacherStudentLinks ?? getGymDemoTeacherStudentLinks();
  return source.filter((link) => isActiveGymTeacherOrAdmin(link.teacherId));
}

type ResolvedFinanceActor = Readonly<{
  policy: FinancePolicy;
  id: string;
  role: "ADMIN" | "TEACHER";
  canViewRevenue: boolean;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function resolvedActor(value: unknown): value is ResolvedFinanceActor {
  if (typeof value !== "object" || value === null) return false;
  try { return resolvedActors.has(value); } catch { return false; }
}

function registerResolvedActor(actor: Omit<ResolvedFinanceActor, "policy"> & { policy: FinancePolicy }): ResolvedFinanceActor {
  const frozen = Object.freeze(actor);
  resolvedActors.add(frozen);
  return frozen;
}

export type FinanceCommandActorResolution =
  | { kind: "malformed" }
  | { kind: "denied" }
  | { kind: "resolved"; actor: ResolvedFinanceActor; actorValue: unknown };

/** Reads only an own data descriptor for actor; no command getter or unrelated key is evaluated pre-authorization. */
export function resolveFinanceCommandActor(value: unknown): FinanceCommandActorResolution {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return { kind: "malformed" };
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, "actor");
    if (!descriptor) return { kind: "malformed" };
    if (!("value" in descriptor)) return { kind: "denied" };
    const actor = resolveFinanceDemoActor(descriptor.value);
    return actor ? { kind: "resolved", actor, actorValue: descriptor.value } : { kind: "denied" };
  } catch {
    return { kind: "denied" };
  }
}

/** BOX keeps the previous public actor shape and optional-claim checks exactly. */
function resolveBoxActor(value: unknown): ResolvedFinanceActor | null {
  if (!isRecord(value) || !isId(value.id) || typeof value.role !== "string") return null;
  const actor = Object.values(financeCatalogSaleActors).find((candidate) => candidate.id === value.id);
  if (!actor || (actor.role !== "ADMIN" && actor.role !== "TEACHER") || value.role !== actor.role) return null;
  if ("canViewRevenue" in value && value.canViewRevenue !== actor.canViewRevenue) return null;
  if ("gymKind" in value && value.gymKind !== "BOX") return null;
  return registerResolvedActor({ policy: policies.box, id: actor.id, role: actor.role, canViewRevenue: actor.canViewRevenue });
}

/** Resolves an opaque GYM token before inspecting any untrusted state or command fields. */
export function resolveFinanceDemoActor(value: unknown): ResolvedFinanceActor | null {
  const gymActor = resolveGymDemoActor(value);
  if (gymActor) {
    if (gymActor.gymId !== GYM_DEMO_GYM_ID || (gymActor.role !== "ADMIN" && gymActor.role !== "TEACHER")) return null;
    return registerResolvedActor({
      policy: policies.gym,
      id: gymActor.id,
      role: gymActor.role,
      canViewRevenue: gymActor.id === GYM_DEMO_ADMIN_ID,
    });
  }
  try {
    return resolveBoxActor(value);
  } catch {
    return null;
  }
}

/** Policy identity is internal and always checked against the authorized actor's registered policy. */
export function isGymFinanceActor(actor: ResolvedFinanceActor | null): boolean {
  return resolvedActor(actor) && actor.policy === policies.gym;
}

/** Matches a detached graph already captured by the GYM validator. */
export function actorMatchesOwnedFinanceState(actor: ResolvedFinanceActor | null, state: unknown): state is KnownFinanceDemoState {
  if (!resolvedActor(actor) || !isRecord(state)) return false;
  return state.namespace === actor.policy.namespace && state.version === actor.policy.version;
}

/** Header-only match: no recursive capture or source property get occurs before tenant selection. */
export function actorMatchesFinanceState(actor: ResolvedFinanceActor | null, state: unknown): state is KnownFinanceDemoState {
  if (!resolvedActor(actor) || typeof state !== "object" || state === null || Array.isArray(state)) return false;
  try {
    const namespace = Object.getOwnPropertyDescriptor(state, "namespace");
    const version = Object.getOwnPropertyDescriptor(state, "version");
    return Boolean(namespace && version && "value" in namespace && "value" in version
      && namespace.value === actor.policy.namespace && version.value === actor.policy.version);
  } catch {
    return false;
  }
}

export function isBoxFinanceState(state: KnownFinanceDemoState): state is FinanceDemoState {
  return state.namespace === policies.box.namespace && state.version === policies.box.version;
}

export function isGymFinanceState(state: KnownFinanceDemoState): state is GymFinanceDemoState {
  return state.namespace === policies.gym.namespace && state.version === policies.gym.version;
}

export function canReadFinanceCatalog(actor: ResolvedFinanceActor): boolean {
  return resolvedActor(actor) && (actor.role === "ADMIN" || actor.role === "TEACHER");
}

export function canManageFinanceCatalog(actor: ResolvedFinanceActor): boolean {
  return resolvedActor(actor) && actor.role === "ADMIN" && actor.canViewRevenue;
}

export function canManageFinanceExpenses(actor: ResolvedFinanceActor): boolean {
  return canManageFinanceCatalog(actor);
}

export function canReadFinanceRevenue(actor: ResolvedFinanceActor): boolean {
  return resolvedActor(actor) && actor.role === "ADMIN" && actor.canViewRevenue;
}

export function canCorrectFinanceHistory(actor: ResolvedFinanceActor): boolean {
  return resolvedActor(actor) && actor.role === "ADMIN";
}

export function canRecordFinancePayment(
  actor: ResolvedFinanceActor,
  studentId: string,
  assignedTeacherIds: readonly string[],
  gymTeacherStudentLinks?: readonly GymFinanceTeacherStudentLink[],
): boolean {
  if (!resolvedActor(actor)) return false;
  if (actor.role === "ADMIN") return true;
  if (actor.policy.id === "gym") {
    return resolveHonoredGymTeacherStudentLinks(gymTeacherStudentLinks)
      .some((link) => link.teacherId === actor.id && link.studentId === studentId);
  }
  return assignedTeacherIds.includes(actor.id);
}

export function isKnownFinanceRecorder(state: KnownFinanceDemoState, id: unknown): boolean {
  if (!isId(id)) return false;
  if (isBoxFinanceState(state)) return Object.values(financeCatalogSaleActors).some((actor) => actor.id === id);
  return getGymDemoProfile(id)?.role === "ADMIN" || getGymDemoProfile(id)?.role === "TEACHER";
}

export function financeRecorderName(state: KnownFinanceDemoState, id: string): string | null {
  if (isGymFinanceState(state)) return getGymDemoProfile(id)?.name ?? null;
  const actor = Object.values(financeCatalogSaleActors).find((candidate) => candidate.id === id);
  if (actor?.id === financeCatalogSaleActors.unprivilegedAdmin.id) return "Administrador sin acceso a recaudación";
  if (actor?.id === financeCatalogSaleActors.admin.id) return "Administración demo";
  if (actor?.id === financeCatalogSaleActors.teacher.id) return "Carlos Entrenador";
  return null;
}
