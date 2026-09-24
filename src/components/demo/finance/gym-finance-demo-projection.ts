import type { PaymentStudent } from "@/components/payments/RegisterPaymentDialogView";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore Node's native type-stripping test runner requires explicit extensions.
import { getFeeBlockStatus, projectFeeStudents, type FeeBlockStatus, type FeeProjection, type FeeStatusFilter, type FeeStudentType } from "./fees-contract.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { isFinanceDate, suggestNextFinancePaymentDate } from "./finance-demo-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { getValidatedGymFinanceDemoState } from "./finance-demo-storage.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { actorMatchesOwnedFinanceState, isGymFinanceActor, resolveFinanceDemoActor } from "./finance-demo-policy.ts";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore Node's native type-stripping test runner requires explicit extensions.
import { getGymDemoProfiles, getGymDemoTeacherStudentLinks, resolveGymDemoActor } from "../scenarios/gym-demo-directory.ts";
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
 */
function scopedActiveStudentIds(actorId: string, role: "ADMIN" | "TEACHER"): Set<string> {
  const activeStudents = new Set(getGymDemoProfiles()
    .filter((profile) => profile.role === "STUDENT" && profile.deletedAt === null)
    .map((profile) => profile.id));
  if (role === "ADMIN") return activeStudents;

  return new Set(getGymDemoTeacherStudentLinks()
    .filter((link) => link.teacherId === actorId && activeStudents.has(link.studentId))
    .map((link) => link.studentId));
}

/** Captures a fresh private ledger only after opaque staff authorization succeeds. */
function captureScopedGymState(state: unknown, token: unknown): {
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
    studentIds: scopedActiveStudentIds(actor.id, actor.role),
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
): GymFinanceFeesDataResult {
  const captured = captureScopedGymState(rawState, gymActorToken);
  if ("success" in captured) return captured;
  if (!isFinanceDate(referenceDate)) return { success: false, error: INVALID_REFERENCE_DATE };

  const projection = projectFeeStudents(feeRows(captured.state, captured.studentIds), referenceDate, activeFilter, activeType);
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
): GymFinancePaymentStudentSelectionResult {
  const captured = captureScopedGymState(rawState, gymActorToken);
  if ("success" in captured) return captured;

  const students = feeRows(captured.state, captured.studentIds).map((student) => {
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
