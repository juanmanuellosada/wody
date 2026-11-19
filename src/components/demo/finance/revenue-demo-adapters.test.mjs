import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { financeCatalogSaleActors } from "./catalog-sales-contract.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createFinanceDemoFixture } from "./finance-demo-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createDemoRevenueCallbackFactory } from "./revenue-demo-adapters.ts";

const anchor = "2030-06-03";
const datePolicy = { today: () => anchor };

function factory(initial = createFinanceDemoFixture(anchor), overrides = {}) {
  let state = initial;
  let commits = 0;
  const callbacks = createDemoRevenueCallbackFactory({
    getState: () => state,
    commit: (next) => { commits += 1; state = next; },
    fixedActor: financeCatalogSaleActors.admin,
    trustedDatePolicy: datePolicy,
    ...overrides,
  });
  return {
    callbacks,
    get state() { return state; },
    set state(next) { state = next; },
    get commits() { return commits; },
  };
}

function withHistory() {
  const base = createFinanceDemoFixture(anchor, {
    fictionalSeedPayments: [{
      studentId: "fee-student-juan", amountCents: 100, paidAt: anchor, nextPaymentDate: "2030-07-03", paymentMethod: "EFECTIVO", recordedById: financeCatalogSaleActors.admin.id,
    }],
  });
  return {
    ...base,
    sales: [{
      id: "sale-history", commandId: "sale-history-command", productId: "finance-product-water", quantity: 1,
      unitAmountCents: 100, totalAmountCents: 100, paymentMethod: "EFECTIVO", soldAt: anchor, recordedById: financeCatalogSaleActors.admin.id,
    }],
  };
}

test("seven local history callbacks convert only view currency and commit complete successful core transitions", async () => {
  const fixture = factory(withHistory());
  for (const amount of [0, -1, Number.NaN, Infinity, Number.MIN_VALUE, 1e-18, 1.001, 10_000_000_000]) {
    const before = fixture.state;
    assert.deepEqual(await fixture.callbacks.registerExpense(amount, "Limpieza", { spentAtStr: anchor }), { success: false, error: "El importe del gasto debe ser mayor a cero." });
    assert.equal(fixture.state, before);
  }
  assert.deepEqual(await fixture.callbacks.registerExpense(1.1, " Limpieza ", { spentAtStr: anchor }), { success: true });
  assert.deepEqual(fixture.state.expenses[0], {
    id: "finance-expense-local-1", amountCents: 110, description: "Limpieza", spentAt: anchor, recordedById: financeCatalogSaleActors.admin.id,
  });
  assert.deepEqual(await fixture.callbacks.updateExpense("finance-expense-local-1", { amount: 2.2 }), { success: true });
  assert.equal(fixture.state.expenses[0].amountCents, 220);
  assert.deepEqual(await fixture.callbacks.updatePayment(fixture.state.payments[0].id, 1.1), { success: true });
  assert.equal(fixture.state.payments[0].amountCents, 110);
  assert.deepEqual(await fixture.callbacks.updateSale("sale-history", { quantity: 2, unitAmount: 0 }), { success: true });
  assert.deepEqual(fixture.state.sales[0], { ...withHistory().sales[0], quantity: 2, unitAmountCents: 0, totalAmountCents: 0 });
  assert.deepEqual(await fixture.callbacks.deletePayment(fixture.state.payments[0].id), { success: true });
  assert.deepEqual(await fixture.callbacks.deleteSale("sale-history"), { success: true });
  assert.deepEqual(await fixture.callbacks.deleteExpense("finance-expense-local-1"), { success: true });
  assert.deepEqual(await fixture.callbacks.registerExpense(3, "Nuevo gasto", { spentAtStr: anchor }), { success: true });
  assert.equal(fixture.state.expenses[0].id, "finance-expense-local-2", "deleted expense IDs remain reserved for the factory lifetime");
  assert.equal(fixture.commits, 8);
});

test("expense designation and admin history policy remain independent and unknown partial fields never cross the adapter", async () => {
  const state = withHistory();
  const unprivileged = factory(state, { fixedActor: financeCatalogSaleActors.unprivilegedAdmin });
  assert.deepEqual(await unprivileged.callbacks.registerExpense(1, "No permitido", { spentAtStr: anchor }), { success: false, error: "No autorizado." });
  assert.deepEqual(await unprivileged.callbacks.updatePayment(state.payments[0].id, 2), { success: true });
  assert.deepEqual(await unprivileged.callbacks.updateSale("sale-history", { quantity: 2 }), { success: true });
  assert.equal(unprivileged.commits, 2, "known admins may correct payment and sale history without report access");

  const teacher = factory(state, { fixedActor: financeCatalogSaleActors.teacher });
  assert.deepEqual(await teacher.callbacks.updatePayment(state.payments[0].id, 2), { success: false, error: "No autorizado." });
  assert.deepEqual(await teacher.callbacks.updateSale("sale-history", { quantity: 2 }), { success: false, error: "No autorizado." });

  const designated = factory(state);
  for (const [callback, args, expected] of [
    [designated.callbacks.updateExpense, ["missing", { spentAt: anchor }], "El gasto no es válido."],
    [designated.callbacks.updateSale, ["sale-history", { productId: "finance-product-water" }], "La venta no es válida."],
    [designated.callbacks.updateSale, ["sale-history", { unitAmount: 1.001 }], "El importe unitario debe ser mayor o igual a cero."],
  ]) {
    const before = designated.state;
    assert.deepEqual(await callback(...args), { success: false, error: expected });
    assert.equal(designated.state, before);
  }
});

test("callback authorization denies hostile actors before every state read and passes canonical frozen identities to cores", async () => {
  const revokedTarget = { id: "finance-admin", role: "ADMIN", canViewRevenue: true, gymKind: "BOX" };
  const revoked = Proxy.revocable(revokedTarget, {});
  revoked.revoke();
  const getterThrow = { role: "ADMIN" };
  Object.defineProperty(getterThrow, "id", { get() { throw new Error("ACTOR_GETTER"); } });
  const actors = [
    financeCatalogSaleActors.teacher,
    { id: "unknown", role: "ADMIN", canViewRevenue: true, gymKind: "BOX" },
    new Proxy({ id: "finance-admin", role: "ADMIN", canViewRevenue: true, gymKind: "BOX" }, { getPrototypeOf() { throw new Error("PROTOTYPE_TRAP"); } }),
    revoked.proxy,
    getterThrow,
  ];

  for (const fixedActor of actors) {
    let stateReads = 0;
    let commits = 0;
    const callbacks = createDemoRevenueCallbackFactory({
      getState: () => { stateReads += 1; throw new Error("STATE_READ"); },
      commit: () => { commits += 1; },
      fixedActor,
      trustedDatePolicy: datePolicy,
    });
    const calls = [
      () => callbacks.registerExpense(1, "Gasto", { spentAtStr: anchor }),
      () => callbacks.updateExpense("expense", { amount: 1 }),
      () => callbacks.deleteExpense("expense"),
      () => callbacks.updatePayment("payment", 1),
      () => callbacks.deletePayment("payment"),
      () => callbacks.updateSale("sale", { unitAmount: 1 }),
      () => callbacks.deleteSale("sale"),
    ];
    for (const call of calls) assert.deepEqual(await call(), { success: false, error: "No autorizado." });
    assert.equal(stateReads, 0);
    assert.equal(commits, 0);
  }

  const canonical = factory(withHistory(), {
    fixedActor: { id: "finance-admin", role: "ADMIN", canViewRevenue: true, gymKind: "BOX" },
  });
  assert.deepEqual(await canonical.callbacks.registerExpense(1, "Gasto", { spentAtStr: anchor }), { success: true });
  assert.equal(canonical.commits, 1, "a matching plain actor reaches the core as the frozen roster record");

  let authorizedReads = 0;
  const authorized = factory(withHistory(), {
    getState: () => { authorizedReads += 1; throw new Error("STATE_READ"); },
  });
  for (const call of [
    () => authorized.callbacks.registerExpense(1, "Gasto", { spentAtStr: anchor }),
    () => authorized.callbacks.updateExpense("expense", { amount: 1 }),
    () => authorized.callbacks.deleteExpense("expense"),
    () => authorized.callbacks.updatePayment("payment", 1),
    () => authorized.callbacks.deletePayment("payment"),
    () => authorized.callbacks.updateSale("sale", { unitAmount: 1 }),
    () => authorized.callbacks.deleteSale("sale"),
  ]) await assert.rejects(call, /STATE_READ/);
  assert.equal(authorizedReads, 7, "authorized state failures are never hidden as authorization failures");
});

test("exact currency boundary rejects tiny non-cent values without rejecting legitimate decimals or safe maxima", async () => {
  const fixture = factory(withHistory());
  const paymentId = fixture.state.payments[0].id;
  for (const amount of [Number.MIN_VALUE, 1e-18, 1.001, -1]) {
    assert.deepEqual(await fixture.callbacks.updatePayment(paymentId, amount), { success: false, error: "El importe debe ser mayor a cero." });
    assert.deepEqual(await fixture.callbacks.updateSale("sale-history", { unitAmount: amount }), { success: false, error: "El importe unitario debe ser mayor o igual a cero." });
  }
  assert.deepEqual(await fixture.callbacks.registerExpense(100.01, "Limpieza", { spentAtStr: anchor }), { success: true });
  assert.equal(fixture.state.expenses[0].amountCents, 10_001);
  assert.deepEqual(await fixture.callbacks.registerExpense(9_999_999_999.99, "Límite", { spentAtStr: anchor }), { success: true });
  assert.equal(fixture.state.expenses[1].amountCents, 999_999_999_999);
  assert.deepEqual(await fixture.callbacks.updatePayment(paymentId, 11.29), { success: true });
  assert.equal(fixture.state.payments[0].amountCents, 1_129);
  assert.deepEqual(await fixture.callbacks.updateSale("sale-history", { unitAmount: 1.1 }), { success: true });
  assert.equal(fixture.state.sales[0].unitAmountCents, 110);
  assert.deepEqual(await fixture.callbacks.updateSale("sale-history", { unitAmount: 0 }), { success: true });
  assert.equal(fixture.state.sales[0].unitAmountCents, 0, "an explicit zero sale amount remains valid");
});

test("fresh execution state, reserved expense IDs, reentry, and reset generation prevent stale commits", async () => {
  const fixture = factory();
  const first = fixture.callbacks.registerExpense(1, "Agua", { spentAtStr: anchor });
  const duplicate = fixture.callbacks.registerExpense(1, "Agua", { spentAtStr: anchor });
  const distinct = fixture.callbacks.registerExpense(2, "Luz", { spentAtStr: anchor });
  assert.equal(first, duplicate, "same in-flight logical mutation shares its promise");
  fixture.callbacks.cancelPendingMutation();
  assert.deepEqual(await distinct, { success: false, error: "Hay una operación financiera en curso. Esperá un momento." });
  assert.deepEqual(await first, { success: false, error: "La operación financiera fue restablecida antes de guardarse." });
  assert.deepEqual(await fixture.callbacks.registerExpense(1, "Agua", { spentAtStr: anchor }), { success: true });
  assert.equal(fixture.state.expenses[0].id, "finance-expense-local-1", "a cancelled operation allocated no ID before reset");

  const restored = factory({
    ...fixture.state,
    expenses: [...fixture.state.expenses, { ...fixture.state.expenses[0], id: "finance-expense-local-2" }],
  });
  assert.deepEqual(await restored.callbacks.registerExpense(2, "Luz", { spentAtStr: anchor }), { success: true });
  assert.equal(restored.state.expenses.at(-1)?.id, "finance-expense-local-3", "persisted collisions are checked without parsing their suffixes");

  const collision = factory(fixture.state, { nextId: () => "finance-expense-local-1" });
  assert.deepEqual(await collision.callbacks.registerExpense(2, "Colisión", { spentAtStr: anchor }), { success: false, error: "No se pudo asignar un identificador local de gasto." });

  const latest = factory(withHistory());
  const pending = latest.callbacks.updatePayment(latest.state.payments[0].id, 3);
  latest.state = { ...latest.state, payments: latest.state.payments.map((payment) => ({ ...payment, amountCents: 999 })) };
  assert.deepEqual(await pending, { success: true });
  assert.equal(latest.state.payments[0].amountCents, 300, "the mutation reads current state when its queued operation executes");
});
