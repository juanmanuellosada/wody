import type { PaymentStudent } from "@/components/payments/RegisterPaymentDialogView";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore Node's native type-stripping test runner requires explicit extensions.
import { getFeeBlockStatus, projectFeeStudents, type FeeBlockStatus, type FeeProjection, type FeeStatusFilter, type FeeStudentType, type FeeStudent } from "./fees-contract.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { isFinanceDate, suggestNextFinancePaymentDate } from "./finance-demo-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { getValidatedGymFinanceDemoState } from "./finance-demo-storage.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { actorMatchesOwnedFinanceState, isGymFinanceActor, resolveFinanceDemoActor, resolveHonoredGymTeacherStudentLinks } from "./finance-demo-policy.ts";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore Node's native type-stripping test runner requires explicit extensions.
import { getGymDemoProfiles, resolveGymDemoActor } from "../scenarios/gym-demo-directory.ts";
import type { GymFinanceTeacherStudentLink } from "./finance-demo-policy";
import type { GymFinanceDemoState } from "./finance-demo-types";

type GymFeeRow = FeeProjection["rows"][number] & { blockStatus: FeeBlockStatus };

type ProjectionFailure =
  | { success: false; error: "No autorizado." }
  | { success: false; error: "El estado financiero no es válido." }
  | { success: false; error: "La fecha de referencia no es válida." };

export type GymFinanceFeesDataResult = ProjectionFailure | {
  success: true;
  rows: GymFeeRow[];
  counts: FeeProjection["counts"];
};

export type GymFinancePaymentStudentSelectionResult = ProjectionFailure | {
  success: true;
  students: PaymentStudent[];
};

/**
 * Display-level profile bridge overlay for the Cuotas row shape. Only these three bridge-editable
 * attributes are represented; every other FeeStudent field (id, email, accountKind, deletedAt,
 * memberNumber, role, nextPaymentDate, studentType, assignedTeachers) stays canonical-only and is
 * never touched by this overlay.
 */
export type GymFinanceFeesProfileOverride = {
  name: string;
  blocked: boolean;
  paymentExempt: boolean;
  paymentExemptReason: string | null;
};

const NOT_AUTHORIZED = "No autorizado." as const;
const INVALID_STATE = "El estado financiero no es válido." as const;
const INVALID_REFERENCE_DATE = "La fecha de referencia no es válida." as const;

/**
 * This deliberately resolves through the canonical token directory before the
 * shared finance resolver. An arbitrary object must not reach the latter's BOX
 * compatibility path, where structural claims are intentionally supported.
 */
function resolveGymStaffActor(token: unknown) {
  const canonical = resolveGymDemoActor(token);
  if (!canonical || (canonical.role !== "ADMIN" && canonical.role !== "TEACHER")) return null;
  const actor = resolveFinanceDemoActor(token);
  return actor && isGymFinanceActor(actor) ? actor : null;
}

/**
 * The canonical directory, not the mutable ledger roster, defines who is in a
 * staff member's GYM scope. The validator separately proves every ledger row
 * has the immutable directory metadata before this function is reached.
 * `bridgeLinks` shares resolveHonoredGymTeacherStudentLinks with
 * canRecordFinancePayment so scoping and payment authorization can never
 * independently drift apart; omitted, this falls back to the canonical
 * directory link set exactly as before this parameter existed.
 */
function scopedActiveStudentIds(
  actorId: string,
  role: "ADMIN" | "TEACHER",
  bridgeLinks: readonly GymFinanceTeacherStudentLink[] | undefined,
): Set<string> {
  const activeStudents = new Set(getGymDemoProfiles()
    .filter((profile) => profile.role === "STUDENT" && profile.deletedAt === null)
    .map((profile) => profile.id));
  if (role === "ADMIN") return activeStudents;

  return new Set(resolveHonoredGymTeacherStudentLinks(bridgeLinks)
    .filter((link) => link.teacherId === actorId && activeStudents.has(link.studentId))
    .map((link) => link.studentId));
}

/** Captures a fresh private ledger only after opaque staff authorization succeeds. */
function captureScopedGymState(
  state: unknown,
  token: unknown,
  bridgeLinks: readonly GymFinanceTeacherStudentLink[] | undefined,
): {
  state: GymFinanceDemoState;
  actorId: string;
  role: "ADMIN" | "TEACHER";
  studentIds: Set<string>;
} | ProjectionFailure {
  const actor = resolveGymStaffActor(token);
  if (!actor) return { success: false, error: NOT_AUTHORIZED };

  // The validator makes one detached, closed capture; foreign headers reject
  // before it traverses children, and no source graph is retained or cached.
  const captured = getValidatedGymFinanceDemoState(state);
  if (!captured || !actorMatchesOwnedFinanceState(actor, captured)) {
    return { success: false, error: INVALID_STATE };
  }
  return {
    state: captured,
    actorId: actor.id,
    role: actor.role,
    studentIds: scopedActiveStudentIds(actor.id, actor.role, bridgeLinks),
  };
}

function feeRows(state: GymFinanceDemoState, studentIds: ReadonlySet<string>) {
  // Scope before constructing student DTOs or running date/status calculations.
  return state.students
    .filter((student) => studentIds.has(student.id))
    .map((student) => ({
      ...student,
      assignedTeachers: student.assignedTeachers.map((teacher) => ({ ...teacher })),
    }));
}

/**
 * Applies the profile bridge overlay BEFORE projectFeeStudents runs, so status counts, the active
 * filter and every rendered row agree with each other (an exempt override must be counted/filtered
 * as exempt, not just painted that way). Omitted or empty, this is a no-op and the result is
 * byte-identical to the un-overlaid rows. A student absent from the map is returned unchanged.
 */
function applyGymFinanceFeesProfileOverlay(
  students: FeeStudent[],
  profileOverrides: ReadonlyMap<string, GymFinanceFeesProfileOverride> | undefined,
): FeeStudent[] {
  if (!profileOverrides || profileOverrides.size === 0) return students;
  return students.map((student) => {
    const override = profileOverrides.get(student.id);
    if (!override) return student;
    return {
      ...student,
      name: override.name,
      blocked: override.blocked,
      paymentExempt: override.paymentExempt,
      paymentExemptReason: override.paymentExemptReason,
    };
  });
}

/**
 * Safe, unmounted Cuotas projection for canonical GYM staff only.
 * `referenceDate` is an already-trusted Argentina caller date (YYYY-MM-DD),
 * matching the mounted BOX adapter's provider-supplied day rather than reading
 * a new clock in this pure module.
 */
export function projectGymFinanceFeesData(
  rawState: unknown,
  gymActorToken: unknown,
  referenceDate: unknown,
  activeFilter: FeeStatusFilter = "all",
  activeType: FeeStudentType | "" = "",
  profileOverrides?: ReadonlyMap<string, GymFinanceFeesProfileOverride>,
  bridgeLinks?: readonly GymFinanceTeacherStudentLink[],
): GymFinanceFeesDataResult {
  const captured = captureScopedGymState(rawState, gymActorToken, bridgeLinks);
  if ("success" in captured) return captured;
  if (!isFinanceDate(referenceDate)) return { success: false, error: INVALID_REFERENCE_DATE };

  const overlaidRows = applyGymFinanceFeesProfileOverlay(feeRows(captured.state, captured.studentIds), profileOverrides);
  const projection = projectFeeStudents(overlaidRows, referenceDate, activeFilter, activeType);
  return {
    success: true,
    counts: { ...projection.counts },
    rows: projection.rows.map((row) => ({
      ...row,
      assignedTeachers: row.assignedTeachers.map((teacher) => ({ ...teacher })),
      blockStatus: getFeeBlockStatus(row, referenceDate, 45),
    })),
  };
}

/** Later ledger entries win equal paid dates without sorting or mutating stored history. */
function latestScopedPayment(state: GymFinanceDemoState, studentId: string) {
  let latest: GymFinanceDemoState["payments"][number] | null = null;
  for (const payment of state.payments) {
    if (payment.studentId !== studentId) continue;
    if (!latest || payment.paidAt >= latest.paidAt) latest = payment;
  }
  return latest;
}

/**
 * Safe payment-dialog student selection. It exposes payment history only for
 * students selected by the canonical staff scope; archived rows remain valid
 * ledger history but never enter the new-payment picker.
 */
export function projectGymFinancePaymentStudentSelection(
  rawState: unknown,
  gymActorToken: unknown,
  profileOverrides?: ReadonlyMap<string, GymFinanceFeesProfileOverride>,
  bridgeLinks?: readonly GymFinanceTeacherStudentLink[],
): GymFinancePaymentStudentSelectionResult {
  const captured = captureScopedGymState(rawState, gymActorToken, bridgeLinks);
  if ("success" in captured) return captured;

  // Same display-only overlay as the Cuotas list, so both surfaces of the same screen agree.
  // `id` is never overridden, so `latestScopedPayment` (keyed on canonical id) is unaffected.
  const overlaidRows = applyGymFinanceFeesProfileOverlay(feeRows(captured.state, captured.studentIds), profileOverrides);
  const students = overlaidRows.map((student) => {
    const latest = latestScopedPayment(captured.state, student.id);
    return {
      id: student.id,
      name: student.name,
      suggestedNextDate: suggestNextFinancePaymentDate(student.nextPaymentDate),
      lastAmount: latest ? latest.amountCents / 100 : null,
      paymentExempt: student.paymentExempt,
      paymentExemptReason: student.paymentExemptReason,
    };
  });
  return { success: true, students };
}
