import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import {
  getGymDemoActorToken,
  getGymDemoProfiles,
  getGymDemoTeacherStudentLinks,
  GYM_DEMO_ADMIN_ID,
  GYM_DEMO_PRIMARY_TEACHER_ID,
  GYM_DEMO_SECONDARY_TEACHER_ID,
} from "../scenarios/gym-demo-directory.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createGymFinanceDemoFixture } from "./gym-finance-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { registerFinancePayment } from "./finance-demo-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import {
  projectGymFinanceFeesData,
  projectGymFinancePaymentStudentSelection,
} from "./gym-finance-demo-projection.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { canRecordFinancePayment, resolveFinanceDemoActor } from "./finance-demo-policy.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createGymDemoProfileFixture } from "../gym/gym-demo-profile-core.ts";

const anchor = "2030-06-03";
const admin = getGymDemoActorToken(GYM_DEMO_ADMIN_ID);
const tomas = getGymDemoActorToken(GYM_DEMO_PRIMARY_TEACHER_ID);
const nora = getGymDemoActorToken(GYM_DEMO_SECONDARY_TEACHER_ID);
const NO_AUTHORIZATION = { success: false, error: "No autorizado." };
const INVALID_STATE = { success: false, error: "El estado financiero no es válido." };

function fixture() {
  return createGymFinanceDemoFixture(anchor);
}

function payment(state, id, studentId, amountInput, paidAt, nextPaymentDate, confirmedDuplicate = false) {
  return registerFinancePayment(state, {
    id,
    commandId: `${id}-command`,
    actor: admin,
    studentId,
    amountInput,
    paidAt,
    nextPaymentDate,
    paymentMethod: "EFECTIVO",
    confirmedDuplicate,
  }, anchor);
}

function ids(result) {
  assert.equal(result.success, true);
  return result.rows.map((row) => row.id);
}

test("canonical GYM tokens project exact directory scopes for admin and both teachers", () => {
  const state = fixture();
  assert.deepEqual(ids(projectGymFinanceFeesData(state, admin, anchor)), [
    "gym-fixed-student-general",
    "gym-fixed-student-personalized",
    "gym-fixed-student-personalized-unlinked",
    "gym-fixed-student-muslib",
    "gym-fixed-student-muslib-lite",
  ]);
  assert.deepEqual(ids(projectGymFinanceFeesData(state, tomas, anchor)), [
    "gym-fixed-student-general",
    "gym-fixed-student-personalized",
    "gym-fixed-student-muslib",
    "gym-fixed-student-muslib-lite",
  ]);
  assert.deepEqual(ids(projectGymFinanceFeesData(state, nora, anchor)), []);

  const paymentStudents = projectGymFinancePaymentStudentSelection(state, tomas);
  assert.equal(paymentStudents.success, true);
  assert.deepEqual(paymentStudents.students.map((student) => student.id), [
    "gym-fixed-student-general",
    "gym-fixed-student-personalized",
    "gym-fixed-student-muslib",
    "gym-fixed-student-muslib-lite",
  ]);
});

test("unknown, copied, proxied, BOX-shaped, student, and LITE identities are denied before state or input reads", () => {
  const copied = {};
  const proxied = new Proxy({}, { get() { throw new Error("token getter"); } });
  const hostileDate = Object.defineProperty({}, "valueOf", { get() { throw new Error("date getter"); } });
  const invalidTokens = [
    null,
    copied,
    proxied,
    { id: "finance-admin", role: "ADMIN", gymKind: "BOX" },
    { id: GYM_DEMO_ADMIN_ID, role: "ADMIN" },
    getGymDemoActorToken("gym-fixed-student-general"),
    getGymDemoActorToken("gym-fixed-student-muslib-lite"),
  ];
  for (const token of invalidTokens) {
    let stateReads = 0;
    const state = new Proxy({}, {
      get() { stateReads += 1; throw new Error("state getter"); },
      ownKeys() { stateReads += 1; throw new Error("state keys"); },
      getOwnPropertyDescriptor() { stateReads += 1; throw new Error("state descriptor"); },
    });
    assert.deepEqual(projectGymFinanceFeesData(state, token, hostileDate), NO_AUTHORIZATION);
    assert.deepEqual(projectGymFinancePaymentStudentSelection(state, token), NO_AUTHORIZATION);
    assert.equal(stateReads, 0);
  }
});

test("foreign namespace is rejected before children, while the validator takes exactly one two-key root capture", () => {
  const base = fixture();
  let childReads = 0;
  const foreign = {
    ...base,
    namespace: "wody-box-finance-demo",
    students: new Proxy(base.students, {
      get() { childReads += 1; throw new Error("foreign child"); },
      ownKeys() { childReads += 1; throw new Error("foreign child keys"); },
    }),
  };
  assert.deepEqual(projectGymFinanceFeesData(foreign, admin, anchor), INVALID_STATE);
  assert.deepEqual(projectGymFinancePaymentStudentSelection(foreign, admin), INVALID_STATE);
  assert.equal(childReads, 0);

  let rootKeys = 0;
  let sourceGets = 0;
  let toJSONGets = 0;
  const hostile = new Proxy(base, {
    get(target, key, receiver) {
      sourceGets += 1;
      if (key === "toJSON") toJSONGets += 1;
      return Reflect.get(target, key, receiver);
    },
    ownKeys(target) {
      rootKeys += 1;
      if (rootKeys > 2) throw new Error("third root capture");
      return Reflect.ownKeys(target);
    },
  });
  const result = projectGymFinanceFeesData(hostile, admin, anchor);
  assert.equal(result.success, true);
  assert.equal(rootKeys, 2);
  assert.equal(sourceGets, 0);
  assert.equal(toJSONGets, 0);
});

test("invalid ledgers fail explicitly, while valid empty history and an empty teacher scope succeed", () => {
  const invalid = { ...fixture(), payments: [{ id: "bad" }] };
  assert.deepEqual(projectGymFinanceFeesData(invalid, admin, anchor), INVALID_STATE);
  assert.deepEqual(projectGymFinancePaymentStudentSelection(invalid, admin), INVALID_STATE);

  const empty = projectGymFinancePaymentStudentSelection(fixture(), admin);
  assert.equal(empty.success, true);
  assert.ok(empty.students.every((student) => student.lastAmount === null));
  const teacherEmpty = projectGymFinancePaymentStudentSelection(fixture(), nora);
  assert.deepEqual(teacherEmpty, { success: true, students: [] });
});

test("payment selection uses reducer history, cents display conversion, latest-date and later tie precedence", () => {
  let state = fixture();
  let recorded = payment(state, "payment-one", "gym-fixed-student-general", "1200", "2030-06-02", "2030-07-02");
  assert.equal(recorded.result.success, true);
  state = recorded.state;
  recorded = payment(state, "payment-two", "gym-fixed-student-general", "1234.56", "2030-06-03", "2030-07-03");
  assert.equal(recorded.result.success, true);
  state = recorded.state;
  recorded = payment(state, "payment-three", "gym-fixed-student-general", "88", "2030-06-03", "2030-07-03", true);
  assert.equal(recorded.result.success, true);
  state = recorded.state;

  const projection = projectGymFinancePaymentStudentSelection(state, admin);
  assert.equal(projection.success, true);
  const paula = projection.students.find((student) => student.id === "gym-fixed-student-general");
  assert.deepEqual(paula, {
    id: "gym-fixed-student-general",
    name: "Paula Méndez",
    suggestedNextDate: "2030-08-03",
    lastAmount: 88,
    paymentExempt: false,
    paymentExemptReason: null,
  });
  assert.deepEqual(state.payments.map((entry) => entry.id), ["payment-one", "payment-two", "payment-three"]);
});

test("the shared Cuotas date contract and renewal helper retain UTC boundaries and month clamping", () => {
  const boundary = projectGymFinanceFeesData(fixture(), admin, anchor);
  assert.equal(boundary.success, true);
  assert.deepEqual(boundary.rows.find((row) => row.id === "gym-fixed-student-general")?.status, { kind: "overdue", days: 12 });
  assert.deepEqual(boundary.rows.find((row) => row.id === "gym-fixed-student-personalized")?.status, { kind: "due-soon", days: 3 });

  const state = fixture();
  state.students[0].nextPaymentDate = "2030-01-31";
  const selection = projectGymFinancePaymentStudentSelection(state, admin);
  assert.equal(selection.success, true);
  assert.equal(selection.students[0].suggestedNextDate, "2030-02-28");
});

test("archived history remains valid but archived students are hidden; LITE and payment flags retain their view DTO values", () => {
  const state = fixture();
  state.payments.push({
    id: "archived-history",
    commandId: "archived-history-command",
    studentId: "gym-fixed-student-muslib-archived",
    amountCents: 9_999,
    paidAt: anchor,
    nextPaymentDate: "2030-07-03",
    paymentMethod: "EFECTIVO",
    recordedById: GYM_DEMO_ADMIN_ID,
  });
  const fees = projectGymFinanceFeesData(state, tomas, anchor);
  const picker = projectGymFinancePaymentStudentSelection(state, admin);
  assert.equal(fees.success, true);
  assert.equal(picker.success, true);
  assert.equal(fees.rows.some((row) => row.id === "gym-fixed-student-muslib-archived"), false);
  assert.equal(picker.students.some((student) => student.id === "gym-fixed-student-muslib-archived"), false);
  const lite = fees.rows.find((row) => row.id === "gym-fixed-student-muslib-lite");
  assert.deepEqual({ email: lite?.email, accountKind: lite?.accountKind }, { email: null, accountKind: "LITE" });
  const exempt = picker.students.find((student) => student.id === "gym-fixed-student-muslib");
  assert.deepEqual({ exempt: exempt?.paymentExempt, reason: exempt?.paymentExemptReason }, { exempt: true, reason: "Beca de demostración" });
  const blocked = fees.rows.find((row) => row.id === "gym-fixed-student-personalized");
  assert.deepEqual(blocked?.blockStatus, { blocked: true, kind: "manual" });
});

test("DTOs are detached, fresh per call, and invalid foreign student IDs are rejected instead of silently repaired", () => {
  const state = fixture();
  const first = projectGymFinanceFeesData(state, admin, anchor);
  assert.equal(first.success, true);
  first.rows[0].name = "Mutated";
  first.rows[0].assignedTeachers.push({ id: "other", name: "Other" });
  assert.notEqual(state.students[0].name, "Mutated");
  assert.equal(state.students[0].assignedTeachers.some((teacher) => teacher.id === "other"), false);
  const second = projectGymFinanceFeesData(state, admin, anchor);
  assert.equal(second.success, true);
  assert.equal(second.rows[0].name, "Paula Méndez");
  assert.equal(second.rows[0].assignedTeachers.some((teacher) => teacher.id === "other"), false);

  const changed = fixture();
  changed.students[0].nextPaymentDate = "2030-06-20";
  const changedProjection = projectGymFinanceFeesData(changed, admin, anchor);
  assert.equal(changedProjection.success, true);
  assert.deepEqual(changedProjection.rows[0].status, { kind: "ok", days: 17 });

  const foreignStudent = fixture();
  foreignStudent.students[0].id = "foreign-student";
  assert.deepEqual(projectGymFinanceFeesData(foreignStudent, admin, anchor), INVALID_STATE);
  const foreignPayment = fixture();
  foreignPayment.payments.push({
    id: "foreign-payment",
    commandId: "foreign-payment-command",
    studentId: "foreign-student",
    amountCents: 100,
    paidAt: anchor,
    nextPaymentDate: "2030-07-03",
    paymentMethod: "EFECTIVO",
    recordedById: GYM_DEMO_ADMIN_ID,
  });
  assert.deepEqual(projectGymFinancePaymentStudentSelection(foreignPayment, admin), INVALID_STATE);
});

function row(result, id) {
  assert.equal(result.success, true);
  return result.rows.find((candidate) => candidate.id === id);
}

test("no profile override argument leaves the projection byte-identical to before", () => {
  const state = fixture();
  const noArg = projectGymFinanceFeesData(state, admin, anchor, "all", "");
  const undefinedArg = projectGymFinanceFeesData(state, admin, anchor, "all", "", undefined);
  const emptyMap = projectGymFinanceFeesData(state, admin, anchor, "all", "", new Map());
  assert.deepEqual(undefinedArg, noArg);
  assert.deepEqual(emptyMap, noArg);
});

test("a bridge name override renders on the row while every canonical-only field stays sourced from finance/directory", () => {
  const state = fixture();
  const overrides = new Map([["gym-fixed-student-general", {
    name: "Paula Editada",
    blocked: false,
    paymentExempt: false,
    paymentExemptReason: null,
  }]]);
  const overridden = projectGymFinanceFeesData(state, admin, anchor, "all", "", overrides);
  const baseline = projectGymFinanceFeesData(state, admin, anchor);
  const overriddenRow = row(overridden, "gym-fixed-student-general");
  const baselineRow = row(baseline, "gym-fixed-student-general");
  assert.equal(overriddenRow.name, "Paula Editada");
  assert.notEqual(overriddenRow.name, baselineRow.name);
  for (const key of ["id", "email", "accountKind", "deletedAt", "studentType", "nextPaymentDate", "canCreateOwnRoutines"]) {
    assert.deepEqual(overriddenRow[key], baselineRow[key], `canonical field ${key} must be unaffected by a name-only override`);
  }
  assert.deepEqual(overriddenRow.assignedTeachers, baselineRow.assignedTeachers);
});

test("a bridge blocked override drives blockStatus in both directions without moving status counts or the status filter", () => {
  const state = fixture();
  // gym-fixed-student-general is naturally NOT blocked (12 days overdue, well under the 45-day auto-block).
  const forcedBlocked = projectGymFinanceFeesData(state, admin, anchor, "all", "", new Map([["gym-fixed-student-general", {
    name: "Paula Méndez", blocked: true, paymentExempt: false, paymentExemptReason: null,
  }]]));
  assert.deepEqual(row(forcedBlocked, "gym-fixed-student-general").blockStatus, { blocked: true, kind: "manual" });
  assert.deepEqual(row(forcedBlocked, "gym-fixed-student-general").status, { kind: "overdue", days: 12 });
  assert.equal(forcedBlocked.counts.overdue, 1); // unchanged: blocked does not affect status counts/filter

  // gym-fixed-student-personalized is naturally blocked=true in the fixture.
  const forcedUnblocked = projectGymFinanceFeesData(state, admin, anchor, "all", "", new Map([["gym-fixed-student-personalized", {
    name: "Bruno Ferreyra", blocked: false, paymentExempt: false, paymentExemptReason: null,
  }]]));
  assert.deepEqual(row(forcedUnblocked, "gym-fixed-student-personalized").blockStatus, { blocked: false });

  // Filtering by "overdue" must still include the forced-blocked student: block state is presentational only.
  const overdueFiltered = projectGymFinanceFeesData(state, admin, anchor, "overdue", "", new Map([["gym-fixed-student-general", {
    name: "Paula Méndez", blocked: true, paymentExempt: false, paymentExemptReason: null,
  }]]));
  assert.ok(overdueFiltered.rows.some((candidate) => candidate.id === "gym-fixed-student-general"));
});

test("a bridge paymentExempt override keeps counts, the exempt/overdue filters and the row presentation all in agreement", () => {
  const state = fixture();
  // gym-fixed-student-general is naturally overdue (12 days) and not exempt.
  const exemptOverride = new Map([["gym-fixed-student-general", {
    name: "Paula Méndez", blocked: false, paymentExempt: true, paymentExemptReason: "Convenio de demostración",
  }]]);
  const allWithExempt = projectGymFinanceFeesData(state, admin, anchor, "all", "", exemptOverride);
  assert.equal(allWithExempt.counts.exempt, 2); // gym-fixed-student-muslib is already exempt in the fixture
  assert.equal(allWithExempt.counts.overdue, 0);
  assert.equal(allWithExempt.counts.all, 5);
  const overriddenRow = row(allWithExempt, "gym-fixed-student-general");
  assert.equal(overriddenRow.paymentExempt, true);
  assert.equal(overriddenRow.paymentExemptReason, "Convenio de demostración");
  assert.equal(overriddenRow.status, null);

  const exemptFiltered = projectGymFinanceFeesData(state, admin, anchor, "exempt", "", exemptOverride);
  assert.deepEqual(exemptFiltered.rows.map((candidate) => candidate.id), ["gym-fixed-student-general", "gym-fixed-student-muslib"]);
  const overdueFiltered = projectGymFinanceFeesData(state, admin, anchor, "overdue", "", exemptOverride);
  assert.equal(overdueFiltered.rows.some((candidate) => candidate.id === "gym-fixed-student-general"), false);

  // gym-fixed-student-muslib is naturally exempt; flipping it off must move it back into "overdue" (-30 days).
  const unexemptOverride = new Map([["gym-fixed-student-muslib", {
    name: "Camila Ríos", blocked: false, paymentExempt: false, paymentExemptReason: null,
  }]]);
  const allWithUnexempt = projectGymFinanceFeesData(state, admin, anchor, "all", "", unexemptOverride);
  assert.equal(allWithUnexempt.counts.exempt, 0);
  assert.equal(allWithUnexempt.counts.overdue, 2);
  const unexemptRow = row(allWithUnexempt, "gym-fixed-student-muslib");
  assert.deepEqual(unexemptRow.status, { kind: "overdue", days: 30 });
  assert.equal(unexemptRow.paymentExemptReason, null);
});

test("a student absent from the profile override map keeps every finance-derived value untouched", () => {
  const state = fixture();
  const overrides = new Map([["gym-fixed-student-general", {
    name: "Paula Editada", blocked: true, paymentExempt: true, paymentExemptReason: "Ajena a este alumno",
  }]]);
  const overridden = projectGymFinanceFeesData(state, admin, anchor, "all", "", overrides);
  const baseline = projectGymFinanceFeesData(state, admin, anchor);
  for (const id of ["gym-fixed-student-personalized", "gym-fixed-student-personalized-unlinked", "gym-fixed-student-muslib", "gym-fixed-student-muslib-lite"]) {
    assert.deepEqual(row(overridden, id), row(baseline, id), `student ${id} is absent from the override map and must be untouched`);
  }
});

function pickerStudent(result, id) {
  assert.equal(result.success, true);
  return result.students.find((candidate) => candidate.id === id);
}

test("no profile override argument leaves the payment picker byte-identical to before", () => {
  const state = fixture();
  const noArg = projectGymFinancePaymentStudentSelection(state, admin);
  const undefinedArg = projectGymFinancePaymentStudentSelection(state, admin, undefined);
  const emptyMap = projectGymFinancePaymentStudentSelection(state, admin, new Map());
  assert.deepEqual(undefinedArg, noArg);
  assert.deepEqual(emptyMap, noArg);
});

test("the same profile override map makes the Cuotas row and the payment picker agree for the same student", () => {
  const state = fixture();
  const overrides = new Map([["gym-fixed-student-general", {
    name: "Paula Editada", blocked: true, paymentExempt: true, paymentExemptReason: "Convenio de demostración",
  }]]);
  const fees = projectGymFinanceFeesData(state, admin, anchor, "all", "", overrides);
  const picker = projectGymFinancePaymentStudentSelection(state, admin, overrides);
  const feesRow = row(fees, "gym-fixed-student-general");
  const pickerRow = pickerStudent(picker, "gym-fixed-student-general");
  assert.equal(feesRow.name, "Paula Editada");
  assert.equal(pickerRow.name, "Paula Editada");
  assert.equal(feesRow.name, pickerRow.name);
  assert.equal(feesRow.paymentExempt, true);
  assert.equal(pickerRow.paymentExempt, true);
  assert.equal(feesRow.paymentExemptReason, pickerRow.paymentExemptReason);
});

test("the payment picker overlay leaves canonical id/suggestedNextDate/lastAmount untouched and only the override map moves it", () => {
  let state = fixture();
  const recorded = payment(state, "payment-picker", "gym-fixed-student-general", "500", "2030-06-02", "2030-07-02");
  assert.equal(recorded.result.success, true);
  state = recorded.state;

  const baselinePicker = pickerStudent(projectGymFinancePaymentStudentSelection(state, admin), "gym-fixed-student-general");
  const overrides = new Map([["gym-fixed-student-general", {
    name: "Paula Editada", blocked: false, paymentExempt: true, paymentExemptReason: "Beca puente",
  }]]);
  const overriddenPicker = pickerStudent(projectGymFinancePaymentStudentSelection(state, admin, overrides), "gym-fixed-student-general");
  assert.equal(overriddenPicker.id, baselinePicker.id);
  assert.equal(overriddenPicker.suggestedNextDate, baselinePicker.suggestedNextDate);
  assert.equal(overriddenPicker.lastAmount, baselinePicker.lastAmount);
  assert.notEqual(overriddenPicker.name, baselinePicker.name);
  assert.notEqual(overriddenPicker.paymentExempt, baselinePicker.paymentExempt);

  // A student absent from the map keeps every finance-derived picker value.
  const untouched = pickerStudent(projectGymFinancePaymentStudentSelection(state, admin, overrides), "gym-fixed-student-personalized");
  const untouchedBaseline = pickerStudent(projectGymFinancePaymentStudentSelection(state, admin), "gym-fixed-student-personalized");
  assert.deepEqual(untouched, untouchedBaseline);
});

/**
 * Mirrors DemoGymFeesAdapter.tsx's profileOverrides construction EXACTLY: every student from the
 * real, unmocked profile bridge fixture (createGymDemoProfileFixture), not a hand-picked subset.
 * This is the map the adapter actually builds on first render, before any user edit.
 */
function adapterBuiltOverrideMap() {
  const profileState = createGymDemoProfileFixture();
  return new Map(profileState.students.map((student) => [student.id, {
    name: student.name,
    blocked: student.blockedAt !== null,
    paymentExempt: student.paymentExempt,
    paymentExemptReason: student.paymentExemptReason,
  }]));
}

test("the full, real adapter-built override map is a no-op on first load: fees and picker projections are byte-identical to the no-overlay projection for every canonical staff token", () => {
  const state = fixture();
  const overrides = adapterBuiltOverrideMap();
  assert.ok(overrides.size > 0, "the profile fixture must contain at least one student to be a meaningful test");
  for (const token of [admin, tomas, nora]) {
    const feesBaseline = projectGymFinanceFeesData(state, token, anchor);
    const feesWithOverlay = projectGymFinanceFeesData(state, token, anchor, "all", "", overrides);
    assert.deepEqual(feesWithOverlay, feesBaseline, "Cuotas projection must not change on first load with no user edit");

    const pickerBaseline = projectGymFinancePaymentStudentSelection(state, token);
    const pickerWithOverlay = projectGymFinancePaymentStudentSelection(state, token, overrides);
    assert.deepEqual(pickerWithOverlay, pickerBaseline, "payment picker must not change on first load with no user edit");
  }
});

// --- Bridge teacher-student links: threaded as an optional last argument into both scoping
// (projectGymFinanceFeesData/projectGymFinancePaymentStudentSelection) and authorization
// (canRecordFinancePayment), sharing one resolution so the two can never independently drift.

const generalStudentId = "gym-fixed-student-general";
const personalizedStudentId = "gym-fixed-student-personalized";
const unlinkedPersonalizedStudentId = "gym-fixed-student-personalized-unlinked";
const muslibStudentId = "gym-fixed-student-muslib";
const muslibLiteStudentId = "gym-fixed-student-muslib-lite";
const noraId = GYM_DEMO_SECONDARY_TEACHER_ID;
const tomasId = GYM_DEMO_PRIMARY_TEACHER_ID;

test("no bridge links argument leaves the fees scoping byte-identical to before", () => {
  const state = fixture();
  const noArg = ids(projectGymFinanceFeesData(state, tomas, anchor));
  const undefinedArg = ids(projectGymFinanceFeesData(state, tomas, anchor, "all", "", undefined, undefined));
  assert.deepEqual(undefinedArg, noArg);
});

test("the real adapter-built bridge link snapshot at first load is byte-identical to the no-bridge-links scoping, for every canonical staff token", () => {
  const state = fixture();
  const firstLoadLinks = createGymDemoProfileFixture().links;
  assert.ok(firstLoadLinks.length > 0, "the profile fixture must seed at least one link to be a meaningful test");
  for (const token of [admin, tomas, nora]) {
    const baseline = projectGymFinanceFeesData(state, token, anchor);
    const withFirstLoadLinks = projectGymFinanceFeesData(state, token, anchor, "all", "", undefined, firstLoadLinks);
    assert.deepEqual(withFirstLoadLinks, baseline, "first-load bridge links must be a no-op on the Cuotas projection");

    const pickerBaseline = projectGymFinancePaymentStudentSelection(state, token);
    const pickerWithFirstLoadLinks = projectGymFinancePaymentStudentSelection(state, token, undefined, firstLoadLinks);
    assert.deepEqual(pickerWithFirstLoadLinks, pickerBaseline, "first-load bridge links must be a no-op on the payment picker");
  }
});

test("a bridge link addition grows a TEACHER's scope and a removal shrinks it; ADMIN scope ignores bridge links entirely", () => {
  const state = fixture();
  // nora has zero canonical links; adding one must make exactly that student visible.
  const added = ids(projectGymFinanceFeesData(state, nora, anchor, "all", "", undefined, [
    { teacherId: noraId, studentId: unlinkedPersonalizedStudentId },
  ]));
  assert.deepEqual(added, [unlinkedPersonalizedStudentId]);

  // tomas canonically sees general/personalized/muslib/muslib-lite; dropping the muslib link
  // (while keeping the rest) must remove exactly that student and nothing else.
  const canonicalTomasLinks = getGymDemoTeacherStudentLinks();
  const withoutMuslib = canonicalTomasLinks.filter((link) => link.studentId !== muslibStudentId);
  const removed = ids(projectGymFinanceFeesData(state, tomas, anchor, "all", "", undefined, withoutMuslib));
  assert.deepEqual(removed, [generalStudentId, personalizedStudentId, muslibLiteStudentId]);

  // ADMIN's scope is always the full active roster, regardless of bridge link content.
  const adminWithEmptyLinks = ids(projectGymFinanceFeesData(state, admin, anchor, "all", "", undefined, []));
  const adminBaseline = ids(projectGymFinanceFeesData(state, admin, anchor));
  assert.deepEqual(adminWithEmptyLinks, adminBaseline);
});

test("a bridge link addition/removal moves the payment picker's own scoping, independently of the fees projection call", () => {
  const state = fixture();
  const addedPicker = projectGymFinancePaymentStudentSelection(state, nora, undefined, [
    { teacherId: noraId, studentId: unlinkedPersonalizedStudentId },
  ]);
  assert.equal(addedPicker.success, true);
  assert.deepEqual(addedPicker.students.map((student) => student.id), [unlinkedPersonalizedStudentId]);

  const canonicalTomasLinks = getGymDemoTeacherStudentLinks();
  const withoutMuslib = canonicalTomasLinks.filter((link) => link.studentId !== muslibStudentId);
  const removedPicker = projectGymFinancePaymentStudentSelection(state, tomas, undefined, withoutMuslib);
  assert.equal(removedPicker.success, true);
  assert.deepEqual(removedPicker.students.map((student) => student.id), [generalStudentId, personalizedStudentId, muslibLiteStudentId]);
});

test("a bridge link naming an id other than the acting teacher grants that teacher nothing, whether the id is unknown or a real different-role identity", () => {
  // "not-a-real-directory-id" and the general student's real id are BOTH rejected redundantly:
  // isActiveGymTeacherOrAdmin excludes them first (neither resolves to an active TEACHER/ADMIN),
  // and scopedActiveStudentIds's downstream `link.teacherId === actorId` match would exclude them
  // too (neither equals nora's own id), independent of the filter. This test cannot isolate or
  // prove either check on its own: removing just one leaves the other rejecting the same inputs
  // with an identical observable result, confirmed by mutation testing. See the comment on
  // isActiveGymTeacherOrAdmin in finance-demo-policy.ts for why no test in this codebase can
  // isolate it.
  const state = fixture();
  const unknownTeacher = ids(projectGymFinanceFeesData(state, nora, anchor, "all", "", undefined, [
    { teacherId: "not-a-real-directory-id", studentId: generalStudentId },
  ]));
  assert.deepEqual(unknownTeacher, []);

  const differentRealIdentity = ids(projectGymFinanceFeesData(state, nora, anchor, "all", "", undefined, [
    { teacherId: generalStudentId, studentId: generalStudentId },
  ]));
  assert.deepEqual(differentRealIdentity, []);
});

test("a bridge link for the acting teacher naming a different student is not conflated with the target student", () => {
  const state = fixture();
  const wrongStudent = ids(projectGymFinanceFeesData(state, nora, anchor, "all", "", undefined, [
    { teacherId: noraId, studentId: unlinkedPersonalizedStudentId },
  ]));
  assert.deepEqual(wrongStudent.includes(generalStudentId), false);
});

test("BOX finance authorization is unaffected by a gymTeacherStudentLinks argument", () => {
  // canRecordFinancePayment's non-GYM branch never even reads its 4th parameter; passing a
  // fabricated GYM-shaped link list to a BOX actor must have zero effect either way.
  const boxTeacher = resolveFinanceDemoActor({ id: "finance-teacher-carlos", role: "TEACHER" });
  assert.ok(boxTeacher, "the BOX teacher fixture token must resolve");
  const withoutAssignment = canRecordFinancePayment(boxTeacher, "any-student", [], [{ teacherId: "finance-teacher-carlos", studentId: "any-student" }]);
  assert.equal(withoutAssignment, false, "BOX authorization must still come from assignedTeacherIds, never from a gym link list");
  const withAssignment = canRecordFinancePayment(boxTeacher, "any-student", ["finance-teacher-carlos"], []);
  assert.equal(withAssignment, true, "an empty gym link list must not suppress the BOX assignedTeacherIds path");
});

/**
 * The central invariant this candidate exists to prove: for every staff actor and every active
 * student, whether the Cuotas projection shows that student MUST exactly match whether
 * canRecordFinancePayment authorizes charging that student, under every link scenario the bridge
 * can realistically produce (nothing yet, a first-load mirror, one addition, one removal).
 */
test("scoping and authorization agree over the full active roster, for every staff actor, under every bridge link scenario", () => {
  const state = fixture();
  const activeStudentIds = getGymDemoProfiles()
    .filter((profile) => profile.role === "STUDENT" && profile.deletedAt === null)
    .map((profile) => profile.id);
  assert.ok(activeStudentIds.length > 0);

  const canonicalLinks = getGymDemoTeacherStudentLinks();
  const scenarios = {
    "no links input": undefined,
    "canonical links mirror": canonicalLinks,
    "one assignment added": [...canonicalLinks, { teacherId: noraId, studentId: unlinkedPersonalizedStudentId }],
    "one assignment removed": canonicalLinks.filter((link) => !(link.teacherId === tomasId && link.studentId === muslibStudentId)),
  };

  for (const [scenarioName, links] of Object.entries(scenarios)) {
    for (const token of [admin, tomas, nora]) {
      const actor = resolveFinanceDemoActor(token);
      assert.ok(actor, `${scenarioName}: token must resolve to a finance actor`);
      const projection = projectGymFinanceFeesData(state, token, anchor, "all", "", undefined, links);
      assert.equal(projection.success, true, `${scenarioName}: projection must succeed`);
      const visibleIds = new Set(projection.rows.map((row) => row.id));
      for (const studentId of activeStudentIds) {
        const visible = visibleIds.has(studentId);
        const authorized = canRecordFinancePayment(actor, studentId, [], links);
        assert.equal(
          visible,
          authorized,
          `${scenarioName}: actor ${actor.id} and student ${studentId} disagree (visible=${visible}, authorized=${authorized})`,
        );
      }
    }
  }
});
