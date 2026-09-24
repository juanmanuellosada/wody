// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { GYM_DEMO_MUSLIB_STUDENT_ID, GYM_DEMO_PERSONALIZED_STUDENT_ID, getGymDemoActorToken, getGymDemoProfiles, getGymDemoTeacherStudentLinks, resolveGymDemoActor } from "../scenarios/gym-demo-directory.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { snapshotDemoStorageValue } from "../training/demo-storage-snapshot.ts";

/** Reserved persistence namespace. Storage/recovery deliberately belong to a later unit. */
export const GYM_DEMO_PROFILE_NAMESPACE = "wody-gym-profiles-demo";
// Bumped 1 -> 2: the initial narrative seed changed (blockedAt/paymentExempt for two students are no
// longer all-null/all-false). A profile state persisted under version 1 still carries the stale
// all-clear seed and must fail validation on load, falling back to the fresh fixture, rather than
// silently resurrecting the pre-fix regression through persisted state.
export const GYM_DEMO_PROFILE_VERSION = 2;

export type GymDemoProfileStudentType = "GENERAL" | "PERSONALIZED" | "MUSCULACION_LIBRE";
export type GymDemoProfileStudent = {
  /** Identity key only; all identity and authority remains in the canonical directory. */
  id: string;
  name: string;
  studentType: GymDemoProfileStudentType;
  canCreateOwnRoutines: boolean;
  blockedAt: string | null;
  paymentExempt: boolean;
  paymentExemptReason: string | null;
};
export type GymDemoProfileLink = { teacherId: string; studentId: string };
export type GymDemoProfileState = {
  namespace: typeof GYM_DEMO_PROFILE_NAMESPACE;
  version: typeof GYM_DEMO_PROFILE_VERSION;
  students: GymDemoProfileStudent[];
  links: GymDemoProfileLink[];
};

export type GymDemoProfileEffect = Readonly<{ type: "DETACH_ALL_GROUPS"; studentId: string }>;
export type GymDemoProfileResult = { success: true } | { success: false; error: string };
export type GymDemoProfileTransition = {
  state: GymDemoProfileState;
  result: GymDemoProfileResult;
  /** Declarative only: a future journal must persist this intent before cross-ledger pruning. */
  effects: readonly GymDemoProfileEffect[];
};
export type GymDemoProfileClock = () => string;

type CanonicalProfile = ReturnType<typeof getGymDemoProfiles>[number];
type OwnedRecord = Record<string, unknown>;

const NO_AUTHORIZATION = "No autorizado.";
const INVALID_STATE = "El estado de perfiles de demostración no es válido.";
const INVALID_COMMAND = "El comando de perfiles de demostración no es válido.";
const EMPTY_EFFECTS: readonly GymDemoProfileEffect[] = Object.freeze([]);
const EMPTY_RESULT = Object.freeze({ success: true } as const);

/* The directory is the immutable roster and token registry, never this state. */
const canonicalProfiles = getGymDemoProfiles().map((profile) => Object.freeze({ ...profile }));
const canonicalById = new Map<string, Readonly<CanonicalProfile>>(canonicalProfiles.map((profile) => [profile.id, profile]));
const activeStudentIds = new Set(canonicalProfiles.filter((profile) => profile.role === "STUDENT" && profile.deletedAt === null).map((profile) => profile.id));
const activeTeacherIds = new Set(canonicalProfiles.filter((profile) => (profile.role === "TEACHER" || profile.role === "ADMIN") && profile.deletedAt === null).map((profile) => profile.id));

function exactly(keys: readonly string[], expected: readonly string[]): boolean {
  return keys.length === expected.length && keys.every((key) => expected.includes(key));
}

function isPlainRecord(value: unknown): value is OwnedRecord {
  return typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype;
}

function ownKeys(value: OwnedRecord): string[] {
  return Reflect.ownKeys(value).filter((key): key is string => typeof key === "string");
}

function isStudentType(value: unknown): value is GymDemoProfileStudentType {
  return value === "GENERAL" || value === "PERSONALIZED" || value === "MUSCULACION_LIBRE";
}

function isProfileState(value: unknown): value is GymDemoProfileState {
  if (!isPlainRecord(value) || !exactly(ownKeys(value), ["namespace", "version", "students", "links"])) return false;
  if (value.namespace !== GYM_DEMO_PROFILE_NAMESPACE || value.version !== GYM_DEMO_PROFILE_VERSION || !Array.isArray(value.students) || !Array.isArray(value.links)) return false;

  const studentIds = new Set<string>();
  for (const student of value.students) {
    if (!isPlainRecord(student) || !exactly(ownKeys(student), ["id", "name", "studentType", "canCreateOwnRoutines", "blockedAt", "paymentExempt", "paymentExemptReason"])) return false;
    if (typeof student.id !== "string" || !activeOrArchivedStudent(student.id) || studentIds.has(student.id)) return false;
    if (typeof student.name !== "string" || !student.name.trim() || !isStudentType(student.studentType) || typeof student.canCreateOwnRoutines !== "boolean") return false;
    if (student.blockedAt !== null && typeof student.blockedAt !== "string") return false;
    if (typeof student.paymentExempt !== "boolean" || (student.paymentExemptReason !== null && typeof student.paymentExemptReason !== "string")) return false;
    studentIds.add(student.id);
  }
  if (studentIds.size !== canonicalProfiles.filter((profile) => profile.role === "STUDENT").length) return false;
  for (const profile of canonicalProfiles) if (profile.role === "STUDENT" && !studentIds.has(profile.id)) return false;

  const links = new Set<string>();
  for (const link of value.links) {
    if (!isPlainRecord(link) || !exactly(ownKeys(link), ["teacherId", "studentId"])) return false;
    if (typeof link.teacherId !== "string" || typeof link.studentId !== "string" || !activeTeacherIds.has(link.teacherId) || !activeStudentIds.has(link.studentId)) return false;
    const key = `${link.teacherId}\u0000${link.studentId}`;
    if (links.has(key)) return false;
    links.add(key);
  }
  return true;
}

function activeOrArchivedStudent(id: string): boolean {
  return canonicalById.get(id)?.role === "STUDENT";
}

/** Captures once into an owned descriptor graph before validating; no caller object is returned. */
export function getValidatedGymDemoProfileState(value: unknown): GymDemoProfileState | null {
  const captured = snapshotDemoStorageValue(value, new WeakSet<object>(), (keys, descriptors) => {
    if (keys.length !== 4 || keys.some((key) => typeof key !== "string") || !keys.includes("namespace") || !keys.includes("version") || !keys.includes("students") || !keys.includes("links")) return false;
    const namespace = descriptors.namespace;
    const version = descriptors.version;
    return Boolean(namespace && "value" in namespace && namespace.value === GYM_DEMO_PROFILE_NAMESPACE && version && "value" in version && version.value === GYM_DEMO_PROFILE_VERSION);
  });
  return captured.ok && isProfileState(captured.value) ? captured.value : null;
}

export function isValidGymDemoProfileState(value: unknown): value is GymDemoProfileState {
  return getValidatedGymDemoProfileState(value) !== null;
}

/**
 * Fresh mutable metadata and links derived solely from the canonical GYM directory.
 *
 * blockedAt/paymentExempt live in this bridge, not in finance, so this is the authority for the
 * demo's initial narrative state on those two fields. It must therefore seed the SAME initial
 * state the GYM finance fixture (gym-finance-demo-fixtures.ts) hardcodes as literals for the same
 * two students, or the finance-Cuotas overlay silently overwrites that narrative on first render,
 * before any user edit: gym-fixed-student-personalized (GYM_DEMO_PERSONALIZED_STUDENT_ID, "Irene
 * Soto") is blocked, and gym-fixed-student-muslib (GYM_DEMO_MUSLIB_STUDENT_ID, "Micaela Torres") is
 * payment-exempt with reason "Beca de demostración". The finance fixture's own reason literal is a
 * separate spelling that still must match this one by hand: the two fixtures live in isolated
 * modules by design (finance must not depend on the profile bridge, and this bridge must not depend
 * on finance), so a single shared constant would require a new shared module neither fixture
 * currently has, which is out of scope for this fix.
 */
export function createGymDemoProfileFixture(): GymDemoProfileState {
  // Canonical UTC ISO per gym-demo-profile-journal.ts's isCanonicalUtcIso (new Date(v).toISOString() === v);
  // same day as GYM_FINANCE_DEMO_DEFAULT_ANCHOR ("2030-06-03"), noon UTC = morning in Argentina (UTC-3).
  const NARRATIVE_BLOCKED_AT = "2030-06-03T12:00:00.000Z";
  // Must match gym-finance-demo-fixtures.ts's own literal for GYM_DEMO_MUSLIB_STUDENT_ID's exempt reason.
  const NARRATIVE_EXEMPT_REASON = "Beca de demostración";
  const state: GymDemoProfileState = {
    namespace: GYM_DEMO_PROFILE_NAMESPACE,
    version: GYM_DEMO_PROFILE_VERSION,
    students: canonicalProfiles.filter((profile) => profile.role === "STUDENT").map((profile) => ({
      id: profile.id,
      name: profile.name,
      studentType: profile.studentType as GymDemoProfileStudentType,
      canCreateOwnRoutines: profile.canCreateOwnRoutines,
      blockedAt: profile.id === GYM_DEMO_PERSONALIZED_STUDENT_ID ? NARRATIVE_BLOCKED_AT : null,
      paymentExempt: profile.id === GYM_DEMO_MUSLIB_STUDENT_ID,
      paymentExemptReason: profile.id === GYM_DEMO_MUSLIB_STUDENT_ID ? NARRATIVE_EXEMPT_REASON : null,
    })),
    links: getGymDemoTeacherStudentLinks().map((link) => ({ ...link })),
  };
  const validated = getValidatedGymDemoProfileState(state);
  if (!validated) throw new TypeError("Invalid canonical GYM profile fixture.");
  return validated;
}

/** A detached projection for future providers; it cannot expose or mint actor authority. */
export function projectGymDemoProfiles(state: unknown): GymDemoProfileState | null {
  const captured = getValidatedGymDemoProfileState(state);
  return captured ? {
    namespace: captured.namespace,
    version: captured.version,
    students: captured.students.map((student) => ({ ...student })),
    links: captured.links.map((link) => ({ ...link })),
  } : null;
}

function failure(state: unknown, error: string): GymDemoProfileTransition {
  return { state: state as GymDemoProfileState, result: { success: false, error }, effects: EMPTY_EFFECTS };
}

function success(state: GymDemoProfileState, effects: readonly GymDemoProfileEffect[] = EMPTY_EFFECTS): GymDemoProfileTransition {
  return { state, result: EMPTY_RESULT, effects };
}

function prepare(state: unknown, actorToken: unknown, roles: readonly string[]): { actor: { id: string; role: "ADMIN" | "TEACHER" | "STUDENT" }; state: GymDemoProfileState } | GymDemoProfileTransition {
  const actor = resolveGymDemoActor(actorToken);
  if (!actor || !roles.includes(actor.role)) return failure(state, NO_AUTHORIZATION);
  const captured = getValidatedGymDemoProfileState(state);
  if (!captured) return failure(state, INVALID_STATE);
  return { actor, state: captured };
}

function isTransition(value: unknown): value is GymDemoProfileTransition {
  return isPlainRecord(value) && "state" in value && "result" in value && "effects" in value;
}

/** Captures a closed command once. The snapshot helper's two reflective reads are coherent-map checked. */
function command(value: unknown, expected: readonly string[]): OwnedRecord | null {
  const captured = snapshotDemoStorageValue(value);
  if (!captured.ok || !isPlainRecord(captured.value) || !exactly(ownKeys(captured.value), expected)) return null;
  return captured.value;
}

function currentStudent(state: GymDemoProfileState, id: unknown): GymDemoProfileStudent | null {
  return typeof id === "string" && activeStudentIds.has(id) ? state.students.find((student) => student.id === id) ?? null : null;
}

function teacherOwns(state: GymDemoProfileState, teacherId: string, studentId: string): boolean {
  return state.links.some((link) => link.teacherId === teacherId && link.studentId === studentId);
}

function requireTeacherScope(actor: { id: string; role: string }, state: GymDemoProfileState, studentId: string): string | null {
  return actor.role === "TEACHER" && !teacherOwns(state, actor.id, studentId) ? "Este alumno no está asignado a vos." : null;
}

/** Production updateStudent name-only parity: ADMIN or currently linked TEACHER, active student, trimmed nonempty name. */
export function editGymDemoStudent(state: unknown, actorToken: unknown, input: unknown): GymDemoProfileTransition {
  const prepared = prepare(state, actorToken, ["ADMIN", "TEACHER"]);
  if (isTransition(prepared)) return prepared;
  const inputValue = command(input, ["studentId", "name"]);
  if (!inputValue) return failure(state, INVALID_COMMAND);
  const student = currentStudent(prepared.state, inputValue.studentId);
  if (!student) return failure(state, "Alumno no encontrado.");
  const scopeError = requireTeacherScope(prepared.actor, prepared.state, student.id);
  if (scopeError) return failure(state, scopeError);
  if (typeof inputValue.name !== "string" || !inputValue.name.trim()) return failure(state, "El nombre no puede estar vacío.");
  student.name = inputValue.name.trim();
  return success(prepared.state);
}

/** This slice models only STUDENT blocking metadata; it does not revoke a token or imply payment policy. */
export function setGymDemoStudentBlocked(state: unknown, actorToken: unknown, input: unknown, clock?: GymDemoProfileClock): GymDemoProfileTransition {
  const prepared = prepare(state, actorToken, ["ADMIN"]);
  if (isTransition(prepared)) return prepared;
  const inputValue = command(input, ["studentId", "blocked"]);
  if (!inputValue) return failure(state, INVALID_COMMAND);
  const student = currentStudent(prepared.state, inputValue.studentId);
  if (!student) return failure(state, "Alumno no encontrado.");
  if (typeof inputValue.blocked !== "boolean") return failure(state, INVALID_COMMAND);
  if (!inputValue.blocked) {
    student.blockedAt = null;
    return success(prepared.state);
  }
  let blockedAt: unknown;
  try { blockedAt = clock?.(); } catch { return failure(state, INVALID_COMMAND); }
  if (typeof blockedAt !== "string" || !blockedAt.trim()) return failure(state, INVALID_COMMAND);
  student.blockedAt = blockedAt;
  return success(prepared.state);
}

/** Production setStudentPaymentExempt preserves a normalized reason even when exemption is being disabled. */
export function setGymDemoStudentPaymentExempt(state: unknown, actorToken: unknown, input: unknown): GymDemoProfileTransition {
  const prepared = prepare(state, actorToken, ["ADMIN"]);
  if (isTransition(prepared)) return prepared;
  const inputValue = command(input, ["studentId", "exempt", "reason"]);
  if (!inputValue) return failure(state, INVALID_COMMAND);
  const student = currentStudent(prepared.state, inputValue.studentId);
  if (!student) return failure(state, "Alumno no encontrado.");
  if (typeof inputValue.exempt !== "boolean" || (inputValue.reason !== null && typeof inputValue.reason !== "string")) return failure(state, INVALID_COMMAND);
  student.paymentExempt = inputValue.exempt;
  student.paymentExemptReason = typeof inputValue.reason === "string" && inputValue.reason.trim() ? inputValue.reason.trim() : null;
  return success(prepared.state);
}

/**
 * Production setStudentType permits an authenticated TEACHER without a TeacherStudent ownership check.
 * GENERAL emits an unapplied group-detach intent; MUSCULACION_LIBRE keeps groups and clears own routines.
 */
export function setGymDemoStudentType(state: unknown, actorToken: unknown, input: unknown): GymDemoProfileTransition {
  const prepared = prepare(state, actorToken, ["ADMIN", "TEACHER"]);
  if (isTransition(prepared)) return prepared;
  const inputValue = command(input, ["studentId", "studentType"]);
  if (!inputValue) return failure(state, INVALID_COMMAND);
  const student = currentStudent(prepared.state, inputValue.studentId);
  if (!student) return failure(state, "Alumno no encontrado.");
  if (!isStudentType(inputValue.studentType)) return failure(state, INVALID_COMMAND);
  const canonical = canonicalById.get(student.id)!;
  if (canonical.accountKind === "LITE") return failure(state, "El tipo de alumno no aplica a alumnos lite. Convertilo a cuenta completa primero.");
  student.studentType = inputValue.studentType;
  if (inputValue.studentType === "GENERAL") {
    student.canCreateOwnRoutines = false;
    return success(prepared.state, Object.freeze([{ type: "DETACH_ALL_GROUPS", studentId: student.id }]));
  }
  if (inputValue.studentType === "MUSCULACION_LIBRE") student.canCreateOwnRoutines = false;
  return success(prepared.state);
}

/** Production setCanCreateOwnRoutines: ADMIN, FULL/PERSONALIZED only, and a teacher is required to disable it. */
export function setGymDemoStudentOwnRoutines(state: unknown, actorToken: unknown, input: unknown): GymDemoProfileTransition {
  const prepared = prepare(state, actorToken, ["ADMIN"]);
  if (isTransition(prepared)) return prepared;
  const inputValue = command(input, ["studentId", "canCreateOwnRoutines"]);
  if (!inputValue) return failure(state, INVALID_COMMAND);
  const student = currentStudent(prepared.state, inputValue.studentId);
  if (!student) return failure(state, "Alumno no encontrado.");
  if (typeof inputValue.canCreateOwnRoutines !== "boolean") return failure(state, INVALID_COMMAND);
  const canonical = canonicalById.get(student.id)!;
  if (canonical.accountKind === "LITE") return failure(state, "La opción de rutinas propias no aplica a alumnos lite. Convertilo a cuenta completa primero.");
  if (student.studentType !== "PERSONALIZED") return failure(state, "Solo alumnos personalizados pueden autogestionar rutinas.");
  if (!inputValue.canCreateOwnRoutines && !prepared.state.links.some((link) => link.studentId === student.id)) return failure(state, "El alumno no tiene profe asignado: no podés desactivarlo.");
  student.canCreateOwnRoutines = inputValue.canCreateOwnRoutines;
  return success(prepared.state);
}

/** Production assignStudent semantics; the target teacher may be the active canonical ADMIN. */
export function assignGymDemoStudentTeacher(state: unknown, actorToken: unknown, input: unknown): GymDemoProfileTransition {
  const prepared = prepare(state, actorToken, ["ADMIN"]);
  if (isTransition(prepared)) return prepared;
  const inputValue = command(input, ["teacherId", "studentId"]);
  if (!inputValue) return failure(state, INVALID_COMMAND);
  const student = currentStudent(prepared.state, inputValue.studentId);
  if (typeof inputValue.teacherId !== "string" || !activeTeacherIds.has(inputValue.teacherId)) return failure(state, "El profe no existe o no tiene el rol correcto.");
  if (!student) return failure(state, "El alumno no existe o no tiene el rol correcto.");
  if (teacherOwns(prepared.state, inputValue.teacherId, student.id)) return failure(state, "Ese alumno ya está asignado a ese profe.");
  prepared.state.links.push({ teacherId: inputValue.teacherId, studentId: student.id });
  return success(prepared.state);
}

/** Production unassignStudent's observable inconsistency is intentional: the last FULL link enables own routines for every type. */
export function unassignGymDemoStudentTeacher(state: unknown, actorToken: unknown, input: unknown): GymDemoProfileTransition {
  const prepared = prepare(state, actorToken, ["ADMIN"]);
  if (isTransition(prepared)) return prepared;
  const inputValue = command(input, ["teacherId", "studentId"]);
  if (!inputValue) return failure(state, INVALID_COMMAND);
  const student = currentStudent(prepared.state, inputValue.studentId);
  if (typeof inputValue.teacherId !== "string" || !student) return failure(state, "La asignación no existe.");
  const index = prepared.state.links.findIndex((link) => link.teacherId === inputValue.teacherId && link.studentId === student.id);
  if (index < 0) return failure(state, "La asignación no existe.");
  prepared.state.links.splice(index, 1);
  if (!prepared.state.links.some((link) => link.studentId === student.id) && canonicalById.get(student.id)!.accountKind !== "LITE") student.canCreateOwnRoutines = true;
  return success(prepared.state);
}

/** Exposed only for fixtures/tests; it cannot mint opaque actor capability. */
export function getGymDemoProfileActorToken(actorId: unknown): object | null {
  return getGymDemoActorToken(actorId);
}
