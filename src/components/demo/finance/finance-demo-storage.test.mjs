import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { financeCatalogSaleActors } from "./catalog-sales-contract.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createCatalogProduct, registerCatalogSale } from "./catalog-sales-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { registerFinanceExpense } from "./expense-demo-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createFinanceDemoFixture, registerFinancePayment } from "./finance-demo-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import {
  isValidFinanceDemoLegacyState,
  isValidFinanceDemoState,
  isValidFinanceDemoV2State,
  loadFinanceDemoState,
  migrateFinanceDemoStateV1,
  migrateFinanceDemoStateV2,
  persistFinanceDemoState,
  resolveFinanceDemoInitialState,
  serializeFinanceDemoState,
} from "./finance-demo-storage.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import {
  FINANCE_DEMO_LEGACY_STORAGE_KEY,
  FINANCE_DEMO_STORAGE_KEY,
  FINANCE_DEMO_V2_STORAGE_KEY,
} from "./finance-demo-types.ts";

const anchor = "2030-06-03";
const paymentCommand = {
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

function asV2(state) {
  const v2 = { ...state, version: 2 };
  Reflect.deleteProperty(v2, "expenses");
  return v2;
}

function asV1(state) {
  return {
    version: 1,
    namespace: state.namespace,
    anchor: state.anchor,
    students: state.students,
    payments: state.payments,
  };
}

function memoryStorage(entries = {}) {
  const values = new Map(Object.entries(entries));
  const reads = [];
  const writes = [];
  return {
    getItem(key) { reads.push(key); return values.get(key) ?? null; },
    setItem(key, value) { writes.push([key, value]); values.set(key, value); },
    snapshot: () => new Map(values),
    reads,
    writes,
  };
}

test("v3 validation is closed for every nested graph, including designated-admin expenses", () => {
  const state = registerFinanceExpense(createFinanceDemoFixture(anchor), {
    id: "expense-1", actor: financeCatalogSaleActors.admin, amountCents: 100, description: "Limpieza", spentAt: anchor,
  }, anchor).state;
  assert.equal(isValidFinanceDemoState(state), true);
  assert.equal(JSON.parse(serializeFinanceDemoState(state)).expenses[0].amountCents, 100);
  for (const corrupt of [
    { ...state, version: 2 },
    { ...state, expenses: [{ ...state.expenses[0], recordedById: "finance-teacher-carlos" }] },
    { ...state, expenses: [{ ...state.expenses[0], description: " Limpieza" }] },
    { ...state, expenses: [{ ...state.expenses[0], amountCents: 0 }] },
    { ...state, expenses: [{ ...state.expenses[0], receipt: "invented" }] },
    { ...state, expenses: [state.expenses[0], { ...state.expenses[0] }] },
    { ...state, categories: [{ ...state.categories[0], extra: true }] },
    { ...state, products: [{ ...state.products[0], costCents: 1 }] },
    { ...state, sales: [{ id: "sale", commandId: "command", productId: state.products[0].id, quantity: 1, unitAmountCents: 1, totalAmountCents: 1, paymentMethod: "EFECTIVO", soldAt: anchor, recordedById: "finance-admin", buyer: "invented" }] },
    { ...state, actorCapabilities: { canManageExpenses: true } },
  ]) {
    assert.equal(isValidFinanceDemoState(corrupt), false);
    assert.throws(() => serializeFinanceDemoState(corrupt));
  }
  const sparse = new Array(1);
  assert.equal(isValidFinanceDemoState({ ...state, expenses: sparse }), false);
});

test("valid v3 wins without legacy access and direct resolution accepts only strict v1, v2, and v3", () => {
  const v3 = createFinanceDemoFixture(anchor);
  const storage = {
    getItem(key) {
      assert.equal(key, FINANCE_DEMO_STORAGE_KEY, "valid v3 must not inspect older namespaces");
      return serializeFinanceDemoState(v3);
    },
    setItem() { throw new Error("load must not write"); },
  };
  assert.equal(loadFinanceDemoState(storage, createFinanceDemoFixture("2031-01-01")).state.anchor, anchor);

  const v2 = asV2(v3);
  const v1 = asV1(v3);
  assert.equal(isValidFinanceDemoV2State(v2), true);
  assert.equal(isValidFinanceDemoLegacyState(v1), true);
  assert.equal(resolveFinanceDemoInitialState(JSON.stringify(v3)).state.version, 3);
  assert.equal(resolveFinanceDemoInitialState(JSON.stringify(v2)).state.version, 3);
  assert.equal(resolveFinanceDemoInitialState(JSON.stringify(v1)).state.version, 3);
  assert.equal(resolveFinanceDemoInitialState(JSON.stringify({ ...v2, expenses: [] })).state.version, 3, "invalid raw uses a safe fixture");
});

test("v2 migration preserves catalog, sales, payments, dues, order, snapshots, stock, and product counter exactly before adding empty expenses", () => {
  let state = registerFinancePayment(createFinanceDemoFixture(anchor), paymentCommand, anchor).state;
  state = createCatalogProduct(state, {
    id: "product-edited", actor: financeCatalogSaleActors.admin, description: "Barra", categoryId: "finance-category-drinks", priceCents: 777, stock: 8,
  }).state;
  state = registerCatalogSale(state, {
    id: "sale-1", commandId: "sale-command-1", actor: financeCatalogSaleActors.teacher, productId: "product-edited", quantity: 2, unitAmountCents: 700, paymentMethod: "EFECTIVO", soldAt: anchor,
  }, anchor).state;
  const v2 = asV2(state);
  const migrated = migrateFinanceDemoStateV2(v2);
  assert.deepEqual({ ...migrated, version: 2, expenses: undefined }, { ...v2, expenses: undefined });
  assert.deepEqual(migrated.expenses, []);
  assert.equal(migrated.products.find((product) => product.id === "product-edited")?.stock, 6);

  const legacy = asV1(state);
  const fromV1 = migrateFinanceDemoStateV1(legacy);
  assert.deepEqual(fromV1.students, legacy.students);
  assert.deepEqual(fromV1.payments, legacy.payments);
  assert.equal(fromV1.sales.length, 0);
  assert.deepEqual(fromV1.expenses, []);
});

test("missing, corrupt, and throwing keys fall through independently in v3 then v2 then v1 order", () => {
  const source = registerFinancePayment(createFinanceDemoFixture(anchor), paymentCommand, anchor).state;
  const v2 = JSON.stringify(asV2(source));
  const v1 = JSON.stringify(asV1(source));
  const storage = memoryStorage({ [FINANCE_DEMO_STORAGE_KEY]: "{broken", [FINANCE_DEMO_V2_STORAGE_KEY]: v2, [FINANCE_DEMO_LEGACY_STORAGE_KEY]: v1 });
  const v2Recovered = loadFinanceDemoState(storage, createFinanceDemoFixture("2032-01-01"));
  assert.deepEqual(v2Recovered.state.payments, source.payments);
  assert.match(v2Recovered.warning ?? "", /v2/);
  assert.deepEqual(storage.reads, [FINANCE_DEMO_STORAGE_KEY, FINANCE_DEMO_V2_STORAGE_KEY]);

  const faults = {
    getItem(key) {
      if (key === FINANCE_DEMO_STORAGE_KEY || key === FINANCE_DEMO_V2_STORAGE_KEY) throw new Error("denied");
      if (key === FINANCE_DEMO_LEGACY_STORAGE_KEY) return v1;
      throw new Error("unexpected namespace");
    },
    setItem() { throw new Error("load must not write"); },
  };
  const v1Recovered = loadFinanceDemoState(faults, createFinanceDemoFixture("2032-01-01"));
  assert.deepEqual(v1Recovered.state.payments, source.payments);
  assert.match(v1Recovered.warning ?? "", /recuperó v1/);

  const allCorrupt = memoryStorage({ [FINANCE_DEMO_STORAGE_KEY]: "{broken", [FINANCE_DEMO_V2_STORAGE_KEY]: "{broken", [FINANCE_DEMO_LEGACY_STORAGE_KEY]: "{broken" });
  const fallback = createFinanceDemoFixture("2032-01-01");
  assert.equal(loadFinanceDemoState(allCorrupt, fallback).state, fallback);
  assert.equal(allCorrupt.writes.length, 0);
});

test("load never writes or deletes, persist writes only v3, and legacy bytes remain unchanged", () => {
  const state = createFinanceDemoFixture(anchor);
  const v2Bytes = JSON.stringify(asV2(state));
  const v1Bytes = JSON.stringify(asV1(state));
  const storage = memoryStorage({ [FINANCE_DEMO_V2_STORAGE_KEY]: v2Bytes, [FINANCE_DEMO_LEGACY_STORAGE_KEY]: v1Bytes });
  const loaded = loadFinanceDemoState(storage, createFinanceDemoFixture("2031-01-01"));
  assert.equal(storage.writes.length, 0);
  assert.equal(loaded.state.version, 3);
  assert.equal(persistFinanceDemoState(storage, loaded.state), null);
  assert.deepEqual(storage.writes.map(([key]) => key), [FINANCE_DEMO_STORAGE_KEY]);
  assert.equal(storage.snapshot().get(FINANCE_DEMO_V2_STORAGE_KEY), v2Bytes);
  assert.equal(storage.snapshot().get(FINANCE_DEMO_LEGACY_STORAGE_KEY), v1Bytes);
  assert.equal(FINANCE_DEMO_STORAGE_KEY, "wody-box-finance-demo-v3");
});

test("post-migration expense, payment, sale, and catalog transitions retain all unrelated records and a reset fixture is v3 with no expenses", () => {
  const migrated = migrateFinanceDemoStateV2(asV2(createFinanceDemoFixture(anchor)));
  const withExpense = registerFinanceExpense(migrated, {
    id: "expense-1", actor: financeCatalogSaleActors.admin, amountCents: 123, description: "Luz", spentAt: anchor,
  }, anchor).state;
  const withPayment = registerFinancePayment(withExpense, paymentCommand, anchor).state;
  const withSale = registerCatalogSale(withPayment, {
    id: "sale-1", commandId: "sale-command-1", actor: financeCatalogSaleActors.teacher, productId: "finance-product-water", quantity: 1, unitAmountCents: 1500, paymentMethod: "EFECTIVO", soldAt: anchor,
  }, anchor).state;
  const withCatalogEdit = createCatalogProduct(withSale, {
    id: "product-new", actor: financeCatalogSaleActors.admin, description: "Barra", categoryId: "finance-category-drinks", priceCents: 500, stock: 3,
  }).state;
  assert.equal(withCatalogEdit.expenses.length, 1);
  assert.equal(withCatalogEdit.payments.length, 1);
  assert.equal(withCatalogEdit.sales.length, 1);
  assert.equal(withCatalogEdit.products.find((product) => product.id === "finance-product-water")?.stock, 11);
  const reset = createFinanceDemoFixture(anchor);
  assert.equal(reset.version, 3);
  assert.deepEqual(reset.expenses, []);
  assert.deepEqual(reset.payments, []);
});
