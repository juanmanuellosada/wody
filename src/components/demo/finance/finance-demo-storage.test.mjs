import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createFinanceDemoFixture, registerFinancePayment } from "./finance-demo-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import {
  isValidFinanceDemoState,
  loadFinanceDemoState,
  persistFinanceDemoState,
  resolveFinanceDemoInitialState,
  serializeFinanceDemoState,
} from "./finance-demo-storage.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { FINANCE_DEMO_STORAGE_KEY } from "./finance-demo-types.ts";

const anchor = "2030-06-03";
const command = {
  id: "payment-1",
  commandId: "command-1",
  actor: { id: "finance-admin", role: "ADMIN" },
  studentId: "fee-student-juan",
  amountInput: "15000,50",
  paidAt: anchor,
  nextPaymentDate: "2030-07-03",
  paymentMethod: "MERCADO_PAGO",
  confirmedDuplicate: false,
};

function memoryStorage(value = null) {
  let current = value;
  return {
    getItem: () => current,
    setItem: (_key, next) => { current = next; },
    read: () => current,
  };
}

test("the full persisted graph accepts valid finance history and rejects metadata, relation, and ID corruption", () => {
  const initial = createFinanceDemoFixture(anchor);
  const state = registerFinancePayment(initial, command, anchor).state;
  assert.equal(isValidFinanceDemoState(state), true);
  assert.equal(JSON.parse(serializeFinanceDemoState(state)).payments[0].amountCents, 1_500_050);

  for (const corrupt of [
    { ...state, version: 2 },
    { ...state, namespace: "other" },
    { ...state, students: state.students.map((student) => student.id === "fee-student-juan" ? { ...student, name: "forged" } : student) },
    { ...state, students: state.students.map((student) => student.id === "fee-student-juan" ? { ...student, assignedTeachers: [{ id: "forged", name: "Forged" }] } : student) },
    { ...state, payments: [{ ...state.payments[0], amountCents: 1.5 }] },
    { ...state, payments: [{ ...state.payments[0], paymentMethod: "CHEQUE" }] },
    { ...state, payments: [{ ...state.payments[0], recordedById: "forged" }] },
    { ...state, payments: [{ ...state.payments[0], studentId: "fee-student-archived" }] },
    { ...state, payments: [state.payments[0], { ...state.payments[0], id: "payment-2" }] },
    { ...state, payments: [state.payments[0], { ...state.payments[0], id: "payment-2", commandId: "command-2", paidAt: "2030-02-30" }] },
  ]) {
    assert.equal(isValidFinanceDemoState(corrupt), false);
  }
});

test("sparse arrays and explicit non-record entries are rejected before every traversal or Map construction", () => {
  const state = registerFinancePayment(createFinanceDemoFixture(anchor), command, anchor).state;
  const sparseStudents = [...state.students];
  delete sparseStudents[0];
  const sparsePayments = new Array(1);
  const sparseTeachers = state.students.map((student) => student.id === "fee-student-juan"
    ? { ...student, assignedTeachers: new Array(1) }
    : student);
  const undefinedTeachers = state.students.map((student) => student.id === "fee-student-juan"
    ? { ...student, assignedTeachers: [undefined] }
    : student);
  const nullTeachers = state.students.map((student) => student.id === "fee-student-juan"
    ? { ...student, assignedTeachers: [null] }
    : student);
  const malformed = [
    { ...state, students: sparseStudents },
    { ...state, students: [undefined, ...state.students.slice(1)] },
    { ...state, students: [null, ...state.students.slice(1)] },
    { ...state, students: sparseTeachers },
    { ...state, students: undefinedTeachers },
    { ...state, students: nullTeachers },
    { ...state, payments: sparsePayments },
    { ...state, payments: [undefined] },
    { ...state, payments: [null] },
  ];
  for (const corrupt of malformed) {
    assert.equal(isValidFinanceDemoState(corrupt), false);
    assert.throws(() => serializeFinanceDemoState(corrupt));
  }

  const validFallback = createFinanceDemoFixture("2031-01-01");
  for (const corrupt of malformed) {
    const resolved = resolveFinanceDemoInitialState(JSON.stringify(corrupt), validFallback);
    assert.equal(resolved.state, validFallback, "invalid persisted arrays cannot partially merge");
    const invalidFallback = resolveFinanceDemoInitialState(null, corrupt);
    assert.equal(isValidFinanceDemoState(invalidFallback.state), true, "invalid injected fallback resets to a full deterministic fixture");
    const loaded = loadFinanceDemoState(memoryStorage(JSON.stringify(corrupt)), corrupt);
    assert.equal(isValidFinanceDemoState(loaded.state), true, "load never throws or accepts a sparse fallback graph");
  }
});

test("valid storage takes precedence over valid injected fallback; invalid raw data never partially merges", () => {
  const fallback = createFinanceDemoFixture("2031-01-01");
  const stored = registerFinancePayment(createFinanceDemoFixture(anchor), command, anchor).state;
  const raw = serializeFinanceDemoState(stored);
  assert.equal(resolveFinanceDemoInitialState(raw, fallback).state.anchor, anchor);
  const malformed = resolveFinanceDemoInitialState("{broken", fallback);
  assert.equal(malformed.state, fallback);
  assert.match(malformed.warning ?? "", /no es válido/);
  const deepInvalid = resolveFinanceDemoInitialState(JSON.stringify({ ...stored, payments: [{ ...stored.payments[0], commandId: "" }] }), fallback);
  assert.equal(deepInvalid.state, fallback);
  assert.match(deepInvalid.warning ?? "", /no es válido/);
});

test("storage read and write failures degrade to a deterministic in-memory fixture", () => {
  const fallback = createFinanceDemoFixture(anchor);
  const throwingRead = { getItem() { throw new Error("denied"); }, setItem() {} };
  const loaded = loadFinanceDemoState(throwingRead, fallback);
  assert.equal(loaded.state, fallback);
  assert.match(loaded.warning ?? "", /No se pudo leer/);

  const throwingWrite = { getItem() { return null; }, setItem() { throw new Error("denied"); } };
  assert.match(persistFinanceDemoState(throwingWrite, fallback) ?? "", /No se pudieron guardar/);
  assert.match(persistFinanceDemoState(null, fallback) ?? "", /pestaña no está disponible/);
});

test("the generic storage interface writes only the finance session key", () => {
  const storage = memoryStorage();
  const state = createFinanceDemoFixture(anchor);
  assert.equal(persistFinanceDemoState(storage, state), null);
  assert.equal(typeof storage.read(), "string");
  const loaded = loadFinanceDemoState(storage, createFinanceDemoFixture("2031-01-01"));
  assert.equal(loaded.state.anchor, anchor);
  assert.equal(FINANCE_DEMO_STORAGE_KEY, "wody-box-finance-demo-v1");
});
