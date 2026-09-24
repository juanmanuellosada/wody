import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createFinanceDemoFixture, registerFinancePayment } from "./finance-demo-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createCatalogCategory, registerCatalogSale } from "./catalog-sales-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { deleteFinanceExpense, registerFinanceExpense, updateFinanceExpense } from "./expense-demo-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { projectDemoRevenue } from "./revenue-demo-projection.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { deleteDemoPayment, deleteDemoSale, updateDemoPayment, updateDemoSale } from "./revenue-demo-state.ts";

const anchor = "2030-06-03";
const admin = { id: "finance-admin", role: "ADMIN" };
const designated = { id: "finance-admin", role: "ADMIN", canViewRevenue: true, gymKind: "BOX" };

test("BOX baseline fixture remains the captured HEAD d0545a8 JSON vector", () => {
  const json = JSON.stringify(createFinanceDemoFixture(anchor));
  assert.equal(json.length, 3002);
  assert.equal(createHash("sha256").update(json).digest("hex"), "ae2ba15e8168b6678cda83c3acabccd3274f74539739a8b41e72cd45be277f2d");
});

test("BOX representative payment, catalog, sale, expense, and report contracts retain baseline outcomes", () => {
  let state = createFinanceDemoFixture(anchor);
  const payment = registerFinancePayment(state, {
    id: "compat-payment", commandId: "compat-command", actor: admin, studentId: "fee-student-juan", amountInput: "15000,50",
    paidAt: anchor, nextPaymentDate: "2030-07-03", paymentMethod: "EFECTIVO", confirmedDuplicate: false,
  }, anchor);
  assert.deepEqual(payment.result, { success: true, paymentId: "compat-payment", idempotent: false });
  state = payment.state;
  const category = createCatalogCategory(state, { id: "compat-category", actor: designated, name: "Compatibilidad" });
  assert.deepEqual(category.result, { success: true, id: "compat-category" });
  state = category.state;
  const sale = registerCatalogSale(state, {
    id: "compat-sale", commandId: "compat-sale-command", actor: designated, productId: "finance-product-water", quantity: 1,
    unitAmountCents: 1500, paymentMethod: "TARJETA", soldAt: anchor,
  }, anchor);
  assert.deepEqual(sale.result, { success: true, id: "compat-sale", idempotent: false, stockWarning: false });
  state = sale.state;
  const expense = registerFinanceExpense(state, { id: "compat-expense", actor: designated, amountCents: 200, description: "Limpieza", spentAt: anchor }, anchor);
  assert.deepEqual(expense.result, { success: true, id: "compat-expense" });
  state = expense.state;
  const report = projectDemoRevenue(state, designated, { revenueView: "mixta" }, anchor);
  assert.equal(report.success, true);
  if (report.success) assert.deepEqual([report.metrics.payments.totalCents, report.metrics.sales.totalCents, report.metrics.expenses.totalCents], [1_500_050, 1_500, 200]);
});

function unreadableBoxState() {
  const counts = { get: 0, ownKeys: 0, descriptor: 0, prototype: 0 };
  return {
    counts,
    state: new Proxy(createFinanceDemoFixture(anchor), {
      get() { counts.get += 1; throw new Error("denied command must not read BOX state"); },
      ownKeys() { counts.ownKeys += 1; throw new Error("denied command must not enumerate BOX state"); },
      getOwnPropertyDescriptor() { counts.descriptor += 1; throw new Error("denied command must inspect BOX state"); },
      getPrototypeOf() { counts.prototype += 1; throw new Error("denied command must inspect BOX state prototype"); },
    }),
  };
}

function unknownActorMalformedCommand() {
  let otherFieldReads = 0;
  const command = {};
  Object.defineProperty(command, "actor", { configurable: true, enumerable: true, value: { id: "unknown-finance-actor", role: "ADMIN", canViewRevenue: true, gymKind: "BOX" } });
  Object.defineProperty(command, "malformed", {
    configurable: true,
    enumerable: true,
    get() { otherFieldReads += 1; throw new Error("authorization must precede malformed DTO reads"); },
  });
  return { command, otherFieldReads: () => otherFieldReads };
}

/**
 * Demo-only auth is intentionally evaluated before malformed command DTOs for these mutators.
 * Production actions remain unchanged; the old invalid-command error is now the documented
 * unauthorized exception when the actor descriptor is unknown.
 */
test("seven BOX expense and history mutators deny unknown actor descriptors before malformed DTOs or state", () => {
  const operations = [
    ["register-expense", (state, command) => registerFinanceExpense(state, command, anchor)],
    ["update-expense", (state, command) => updateFinanceExpense(state, command)],
    ["delete-expense", (state, command) => deleteFinanceExpense(state, command)],
    ["update-payment", (state, command) => updateDemoPayment(state, command)],
    ["delete-payment", (state, command) => deleteDemoPayment(state, command)],
    ["update-sale", (state, command) => updateDemoSale(state, command)],
    ["delete-sale", (state, command) => deleteDemoSale(state, command)],
  ];
  for (const [name, operation] of operations) {
    const { command, otherFieldReads } = unknownActorMalformedCommand();
    const { state, counts } = unreadableBoxState();
    const output = operation(state, command);
    assert.deepEqual(output.result, { success: false, error: "No autorizado." }, name);
    assert.equal(output.state, state, `${name} retains the source state`);
    assert.equal(otherFieldReads(), 0, `${name} does not read malformed fields`);
    assert.deepEqual(counts, { get: 0, ownKeys: 0, descriptor: 0, prototype: 0 }, `${name} does not read state`);
  }
});
