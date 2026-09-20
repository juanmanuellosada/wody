import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import {
  getFeeBlockStatus,
  getFeeStatus,
  parseFeeStatusFilter,
  parseFeeStudentType,
  projectFeeStudents,
  selectFeeStudents,
} from "./fees-contract.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { demoFeeIdentities, getDemoFeeFixtures } from "./fees-fixtures.ts";

const anchor = "2030-06-03";

function selected(role) {
  return selectFeeStudents(getDemoFeeFixtures(anchor), demoFeeIdentities[role]);
}

test("admin sees every active fictional student while teacher sees only assigned active students", () => {
  const admin = selected("admin");
  const teacher = selected("teacher");
  assert.equal(admin.length, 7);
  assert.equal(teacher.length, 5);
  assert.equal(admin.some((student) => student.name === "Tomás Fernández"), true, "admin keeps unassigned students");
  assert.equal(teacher.some((student) => student.name === "Tomás Fernández"), false, "teacher excludes unassigned students");
  assert.equal(teacher.some((student) => student.id === "fee-student-lucas"), true, "multiple assignments retain the matching teacher");
  assert.equal(admin.some((student) => student.id === "fee-student-archived"), false, "deleted fixture is not active");
  const lite = admin.find((student) => student.id === "fee-student-camila");
  assert.deepEqual({ email: lite?.email, accountKind: lite?.accountKind }, { email: null, accountKind: "LITE" });
});

test("due counts exclude exempt students while Todos and Exentos retain them", () => {
  const projection = projectFeeStudents(selected("admin"), anchor, "all", "");
  assert.deepEqual(projection.counts, { all: 7, overdue: 2, "due-soon": 2, ok: 2, exempt: 1 });
  assert.equal(projectFeeStudents(selected("admin"), anchor, "exempt", "").rows.length, 1);
  assert.equal(projectFeeStudents(selected("admin"), anchor, "exempt", "PERSONALIZED").rows[0]?.paymentExemptReason, "Beca de demostración");
  assert.deepEqual(
    projectFeeStudents(selected("admin"), anchor, "all", "PERSONALIZED").rows.map((student) => student.name),
    ["María García", "Sofía López", "Valentina Ruiz"],
  );
  assert.deepEqual(
    projectFeeStudents(selected("teacher"), anchor, "overdue", "PERSONALIZED").rows.map((student) => student.name),
    ["María García"],
  );
});

test("UTC date-only status boundaries match the Cuotas contract", () => {
  assert.deepEqual(getFeeStatus("2030-06-02", anchor), { kind: "overdue", days: 1 });
  assert.deepEqual(getFeeStatus("2030-06-03", anchor), { kind: "due-soon", days: 0 });
  assert.deepEqual(getFeeStatus("2030-06-10", anchor), { kind: "due-soon", days: 7 });
  assert.deepEqual(getFeeStatus("2030-06-11", anchor), { kind: "ok", days: 8 });
  assert.deepEqual(getFeeBlockStatus({ blocked: false, nextPaymentDate: "2030-04-19" }, anchor, 45), { blocked: false });
  assert.deepEqual(getFeeBlockStatus({ blocked: false, nextPaymentDate: "2030-04-18" }, anchor, 45), { blocked: true, kind: "overdue", days: 46 });
  assert.deepEqual(getFeeBlockStatus({ blocked: true, nextPaymentDate: "2030-06-20" }, anchor, 45), { blocked: true, kind: "manual" });
  assert.throws(() => getFeeStatus("2030-02-30", anchor), /valid date-only DTO/);
});

test("parsers retain manual MUSCULACION filters even though BOX does not offer it in the UI", () => {
  assert.equal(parseFeeStatusFilter("exempt"), "exempt");
  assert.equal(parseFeeStatusFilter("unknown"), "all");
  assert.equal(parseFeeStudentType("MUSCULACION_LIBRE"), "MUSCULACION_LIBRE");
  assert.equal(parseFeeStudentType("invalid"), "");
});
