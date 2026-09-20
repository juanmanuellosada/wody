import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createFinanceDemoFixture, registerFinancePayment } from "./finance-demo-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import {
  isValidFinanceDemoLegacyState,
  isValidFinanceDemoState,
  loadFinanceDemoState,
  migrateFinanceDemoStateV1,
  persistFinanceDemoState,
  resolveFinanceDemoInitialState,
  serializeFinanceDemoState,
} from "./finance-demo-storage.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { FINANCE_DEMO_LEGACY_STORAGE_KEY, FINANCE_DEMO_STORAGE_KEY } from "./finance-demo-types.ts";

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
    { ...state, version: 3 },
    { ...state, namespace: "other" },
    { ...state, students: state.students.map((student) => student.id === "fee-student-juan" ? { ...student, name: "forged" } : student) },
    { ...state, students: state.students.map((student) => student.id === "fee-student-juan" ? { ...student, assignedTeachers: [{ id: "forged", name: "Forged" }] } : student) },
    { ...state, payments: [{ ...state.payments[0], amountCents: 1.5 }] },
    { ...state, payments: [{ ...state.payments[0], paymentMethod: "CHEQUE" }] },
    { ...state, payments: [{ ...state.payments[0], recordedById: "forged" }] },
    { ...state, payments: [{ ...state.payments[0], studentId: "fee-student-archived" }] },
    { ...state, payments: [state.payments[0], { ...state.payments[0], id: "payment-2" }] },
    { ...state, payments: [state.payments[0], { ...state.payments[0], id: "payment-2", commandId: "command-2", paidAt: "2030-02-30" }] },
    { ...state, categories: [{ ...state.categories[0] }, { ...state.categories[0], id: "category-duplicate" }] },
    { ...state, products: [{ ...state.products[0], categoryId: "missing-category" }] },
    { ...state, products: [{ ...state.products[0] }, { ...state.products[1], code: state.products[0].code }] },
    { ...state, sales: [{ id: "sale-1", commandId: "sale-command-1", productId: state.products[0].id, quantity: 1, unitAmountCents: 100, totalAmountCents: 101, paymentMethod: "EFECTIVO", soldAt: anchor, recordedById: "finance-admin" }] },
    { ...state, sales: [{ id: "sale-1", commandId: "sale-command-1", productId: state.products[0].id, quantity: 1, unitAmountCents: 100, totalAmountCents: 100, paymentMethod: "EFECTIVO", soldAt: anchor, recordedById: "forged" }] },
    { ...state, nextProductCode: 0 },
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
    { ...state, categories: new Array(1) },
    { ...state, products: new Array(1) },
    { ...state, sales: new Array(1) },
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
  assert.equal(FINANCE_DEMO_STORAGE_KEY, "wody-box-finance-demo-v2");
});

test("closed persisted graphs reject invented capabilities and accounting fields at every level", () => {
  const state = registerFinancePayment(createFinanceDemoFixture(anchor), command, anchor).state;
  const fallback = createFinanceDemoFixture("2032-01-01");
  const corruptions = [
    { ...state, actorCapabilities: { canManageCatalog: true } },
    { ...state, students: state.students.map((student) => student.id === "fee-student-juan" ? { ...student, actorCapabilities: ["ADMIN"] } : student) },
    { ...state, students: state.students.map((student) => student.id === "fee-student-juan" ? { ...student, assignedTeachers: [{ ...student.assignedTeachers[0], canViewRevenue: true }] } : student) },
    { ...state, payments: [{ ...state.payments[0], actorCapabilities: { role: "ADMIN" } }] },
    { ...state, categories: [{ ...state.categories[0], actorCapabilities: true }] },
    { ...state, products: [{ ...state.products[0], costCents: 100 }] },
    { ...state, sales: [{ id: "sale-extra", commandId: "sale-extra-command", productId: state.products[0].id, quantity: 1, unitAmountCents: 100, totalAmountCents: 100, paymentMethod: "EFECTIVO", soldAt: anchor, recordedById: "finance-admin", actorCapabilities: true }] },
  ];
  for (const corrupt of corruptions) {
    assert.equal(isValidFinanceDemoState(corrupt), false);
    assert.throws(() => serializeFinanceDemoState(corrupt));
    assert.equal(resolveFinanceDemoInitialState(JSON.stringify(corrupt), fallback).state, fallback);
  }

  const legacy = { version: 1, namespace: state.namespace, anchor: state.anchor, students: state.students, payments: state.payments, actorCapabilities: true };
  assert.equal(isValidFinanceDemoLegacyState(legacy), false);
  assert.equal(resolveFinanceDemoInitialState(JSON.stringify(legacy), fallback).state, fallback);
});

test("strict v1 migration preserves the full payment and student graph while v2 storage has priority", () => {
  const paid = registerFinancePayment(createFinanceDemoFixture(anchor), command, anchor).state;
  const legacy = {
    version: 1,
    namespace: paid.namespace,
    anchor: paid.anchor,
    students: paid.students,
    payments: paid.payments,
  };
  assert.equal(isValidFinanceDemoLegacyState(legacy), true);
  const migrated = migrateFinanceDemoStateV1(legacy);
  assert.equal(migrated.version, 2);
  assert.deepEqual(migrated.students, legacy.students);
  assert.deepEqual(migrated.payments, legacy.payments);
  assert.equal(migrated.sales.length, 0);

  const keys = new Map([
    [FINANCE_DEMO_STORAGE_KEY, serializeFinanceDemoState(createFinanceDemoFixture("2031-01-01"))],
    [FINANCE_DEMO_LEGACY_STORAGE_KEY, JSON.stringify(legacy)],
  ]);
  const reads = [];
  const storage = {
    getItem(key) { reads.push(key); return keys.get(key) ?? null; },
    setItem(key, value) { keys.set(key, value); },
  };
  const preferred = loadFinanceDemoState(storage, createFinanceDemoFixture());
  assert.equal(preferred.state.anchor, "2031-01-01");
  assert.equal(keys.has(FINANCE_DEMO_LEGACY_STORAGE_KEY), true, "migration never silently deletes v1");
  assert.equal(reads.every((key) => key === FINANCE_DEMO_STORAGE_KEY || key === FINANCE_DEMO_LEGACY_STORAGE_KEY), true);

  keys.set(FINANCE_DEMO_STORAGE_KEY, "{corrupt");
  const recovered = loadFinanceDemoState(storage, createFinanceDemoFixture("2032-01-01"));
  assert.deepEqual(recovered.state.payments, legacy.payments);
  assert.match(recovered.warning ?? "", /v2 no es válido/);

  keys.set(FINANCE_DEMO_LEGACY_STORAGE_KEY, JSON.stringify({ ...legacy, payments: [{ ...legacy.payments[0], recordedById: "forged" }] }));
  const fallback = createFinanceDemoFixture("2032-01-01");
  const invalidBoth = loadFinanceDemoState(storage, fallback);
  assert.equal(invalidBoth.state, fallback);
  assert.match(invalidBoth.warning ?? "", /no es válido/);
});

test("storage reads v2 and v1 independently without writes or namespace probing", () => {
  const legacyState = registerFinancePayment(createFinanceDemoFixture(anchor), command, anchor).state;
  const legacy = JSON.stringify({ version: 1, namespace: legacyState.namespace, anchor: legacyState.anchor, students: legacyState.students, payments: legacyState.payments });
  const fallback = createFinanceDemoFixture("2032-01-01");

  const v2Wins = {
    getItem(key) {
      assert.equal(key, FINANCE_DEMO_STORAGE_KEY, "valid v2 must not require a legacy read");
      return serializeFinanceDemoState(createFinanceDemoFixture(anchor));
    },
    setItem() { throw new Error("load must not write"); },
  };
  assert.equal(loadFinanceDemoState(v2Wins, fallback).state.anchor, anchor);

  const v2FaultV1Valid = {
    getItem(key) {
      if (key === FINANCE_DEMO_STORAGE_KEY) throw new Error("v2 denied");
      assert.equal(key, FINANCE_DEMO_LEGACY_STORAGE_KEY);
      return legacy;
    },
    setItem() { throw new Error("load must not write"); },
  };
  const recovered = loadFinanceDemoState(v2FaultV1Valid, fallback);
  assert.deepEqual(recovered.state.payments, legacyState.payments);
  assert.match(recovered.warning ?? "", /v2/);

  const v2InvalidV1Fault = {
    getItem(key) {
      if (key === FINANCE_DEMO_STORAGE_KEY) return "{broken";
      if (key === FINANCE_DEMO_LEGACY_STORAGE_KEY) throw new Error("v1 denied");
      throw new Error("unexpected namespace");
    },
    setItem() { throw new Error("load must not write"); },
  };
  const v1Fault = loadFinanceDemoState(v2InvalidV1Fault, fallback);
  assert.equal(v1Fault.state, fallback);
  assert.match(v1Fault.warning ?? "", /No se pudo leer/);

  const bothFault = {
    getItem() { throw new Error("denied"); },
    setItem() { throw new Error("load must not write"); },
  };
  const failed = loadFinanceDemoState(bothFault, fallback);
  assert.equal(failed.state, fallback);
  assert.match(failed.warning ?? "", /No se pudo leer/);
});
