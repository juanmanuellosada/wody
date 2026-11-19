import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { financeCatalogSaleActors } from "./catalog-sales-contract.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import {
  deleteFinanceExpense,
  isValidFinanceExpenseGraph,
  registerFinanceExpense,
  updateFinanceExpense,
} from "./expense-demo-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createFinanceDemoFixture } from "./finance-demo-state.ts";

const today = "2030-06-03";
const admin = financeCatalogSaleActors.admin;

function expenseCommand(overrides = {}) {
  return {
    id: "expense-1",
    actor: admin,
    amountCents: 12_345,
    description: "  Agua y limpieza  ",
    spentAt: today,
    ...overrides,
  };
}

function createExpense(state = createFinanceDemoFixture(today), overrides = {}) {
  const transition = registerFinanceExpense(state, expenseCommand(overrides), today);
  assert.equal(transition.result.success, true);
  return transition.state;
}

function expectFailure(state, operation, expected = /./) {
  const transition = operation();
  assert.equal(transition.state, state);
  assert.equal(transition.result.success, false);
  assert.match(transition.result.error, expected);
}

test("designated admin creates, partially updates, and deletes a positive Decimal(12,2) local expense immutably", () => {
  const base = createFinanceDemoFixture(today);
  const created = registerFinanceExpense(base, expenseCommand(), today);
  assert.deepEqual(created.result, { success: true, id: "expense-1" });
  assert.equal(base.expenses.length, 0);
  assert.deepEqual(created.state.expenses, [{
    id: "expense-1",
    amountCents: 12_345,
    description: "Agua y limpieza",
    spentAt: today,
    recordedById: admin.id,
  }]);

  const updated = updateFinanceExpense(created.state, {
    actor: admin,
    expenseId: "expense-1",
    amountCents: 9_999,
    description: "  Limpieza corregida ",
  });
  assert.deepEqual(updated.result, { success: true, id: "expense-1" });
  assert.deepEqual(updated.state.expenses[0], {
    ...created.state.expenses[0],
    amountCents: 9_999,
    description: "Limpieza corregida",
  });
  assert.equal(updated.state.payments, created.state.payments);
  assert.equal(updated.state.categories, created.state.categories);
  assert.equal(updated.state.products, created.state.products);
  assert.equal(updated.state.sales, created.state.sales);

  const removed = deleteFinanceExpense(updated.state, { actor: admin, expenseId: "expense-1" });
  assert.deepEqual(removed.result, { success: true, id: "expense-1" });
  assert.deepEqual(removed.state.expenses, []);
  assert.equal(removed.state.products, updated.state.products);
});

test("expense commands reject caller privilege claims for every non-designated role and spoof", () => {
  const state = createFinanceDemoFixture(today);
  for (const actor of [
    financeCatalogSaleActors.unprivilegedAdmin,
    financeCatalogSaleActors.teacher,
    { id: "finance-student", role: "STUDENT", canViewRevenue: true },
    { id: "finance-access", role: "ACCESS", canViewRevenue: true },
    { id: "outside", role: "ADMIN", canViewRevenue: true },
    { id: admin.id, role: "ADMIN", canViewRevenue: false },
    { id: financeCatalogSaleActors.teacher.id, role: "ADMIN", canViewRevenue: true },
  ]) {
    expectFailure(state, () => registerFinanceExpense(state, expenseCommand({ actor }), today), /autorizado/);
  }

  const withExpense = createExpense();
  expectFailure(withExpense, () => updateFinanceExpense(withExpense, { actor: financeCatalogSaleActors.teacher, expenseId: "expense-1", amountCents: 1 }), /autorizado/);
  expectFailure(withExpense, () => deleteFinanceExpense(withExpense, { actor: financeCatalogSaleActors.unprivilegedAdmin, expenseId: "expense-1" }), /autorizado/);
});

test("creation enforces actual action amount, trim, calendar, and non-future rules without mutation", () => {
  const state = createFinanceDemoFixture(today);
  for (const [field, value, expected] of [
    ["amountCents", 0, /mayor a cero/],
    ["amountCents", -1, /mayor a cero/],
    ["amountCents", 1.5, /mayor a cero/],
    ["amountCents", Number.NaN, /mayor a cero/],
    ["amountCents", Number.POSITIVE_INFINITY, /mayor a cero/],
    ["amountCents", 1_000_000_000_000, /mayor a cero/],
    ["description", "   ", /descripción/],
    ["description", null, /descripción/],
    ["spentAt", "2030-02-30", /fecha/],
    ["spentAt", "2030-06-04", /futura/],
    ["spentAt", null, /fecha/],
  ]) {
    expectFailure(state, () => registerFinanceExpense(state, expenseCommand({ [field]: value }), today), expected);
  }
  assert.equal(registerFinanceExpense(state, expenseCommand({ amountCents: 999_999_999_999 }), today).result.success, true);
  expectFailure(state, () => registerFinanceExpense(state, expenseCommand(), "invalid"), /fecha/);
});

test("partial edits preserve date and recorder and reject all unsupported, sparse, duplicate, and malformed inputs", () => {
  const state = createExpense();
  for (const command of [
    { actor: admin, expenseId: "expense-1" },
    { actor: admin, expenseId: "expense-1", amountCents: 0 },
    { actor: admin, expenseId: "expense-1", description: " " },
    { actor: admin, expenseId: "expense-1", spentAt: "2030-01-01" },
    { actor: admin, expenseId: "expense-1", recordedById: admin.id },
    { actor: admin, expenseId: "expense-1", amountCents: null },
    { actor: admin, expenseId: null, amountCents: 100 },
    null,
    [],
  ]) expectFailure(state, () => updateFinanceExpense(state, command), /./);
  expectFailure(state, () => registerFinanceExpense(state, expenseCommand(), today), /Identificador/);
  expectFailure(state, () => deleteFinanceExpense(state, { actor: admin, expenseId: "missing" }), /encontrado/);

  const sparse = new Array(1);
  const malformed = { ...state, expenses: sparse };
  assert.equal(isValidFinanceExpenseGraph(sparse), false);
  expectFailure(malformed, () => registerFinanceExpense(malformed, expenseCommand({ id: "expense-2" }), today), /gastos/);
});
