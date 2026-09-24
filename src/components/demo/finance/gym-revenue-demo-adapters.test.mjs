import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { getGymDemoActorToken, GYM_DEMO_ADMIN_ID, GYM_DEMO_ARCHIVED_STUDENT_ID, GYM_DEMO_GENERAL_STUDENT_ID, GYM_DEMO_PRIMARY_TEACHER_ID } from "../scenarios/gym-demo-directory.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createGymFinanceDemoFixture } from "./gym-finance-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createGymRevenueDemoCallbackFactory } from "./gym-revenue-demo-adapters.ts";

const anchor = "2030-06-03";
const admin = getGymDemoActorToken(GYM_DEMO_ADMIN_ID);
const teacher = getGymDemoActorToken(GYM_DEMO_PRIMARY_TEACHER_ID);
const busy = { success: false, error: "Hay una operación financiera en curso. Esperá un momento." };
const cancelled = { success: false, error: "La operación financiera fue restablecida antes de guardarse." };

function seeded() {
  const state = createGymFinanceDemoFixture(anchor);
  return {
    ...state,
    payments: [{ id: "payment-history", commandId: "payment-command", studentId: GYM_DEMO_GENERAL_STUDENT_ID, amountCents: 1_000, paidAt: anchor, nextPaymentDate: "2030-07-03", paymentMethod: "EFECTIVO", recordedById: GYM_DEMO_ADMIN_ID }],
    sales: [{ id: "sale-history", commandId: "sale-command", productId: "gym-finance-product-band", quantity: 1, unitAmountCents: 2_500, totalAmountCents: 2_500, paymentMethod: "EFECTIVO", soldAt: anchor, recordedById: GYM_DEMO_ADMIN_ID }],
    expenses: [{ id: "expense-history", amountCents: 500, description: "Limpieza", spentAt: anchor, recordedById: GYM_DEMO_ADMIN_ID }],
  };
}

function fixture(initial = seeded(), overrides = {}) {
  let state = initial;
  const commits = [];
  const callbacks = createGymRevenueDemoCallbackFactory({
    boundGymActorToken: admin,
    getState: () => state,
    commit: (next) => { state = next; commits.push(next); },
    trustedExpenseDatePolicy: { today: () => anchor },
    ...overrides,
  });
  return { callbacks, commits, get state() { return state; }, set state(value) { state = value; } };
}

test("GYM revenue callbacks run all seven actual reducers and retain payment due, sale stock and historical snapshots", async () => {
  const demo = fixture();
  const originalDue = demo.state.students[0].nextPaymentDate;
  const originalStock = demo.state.products[0].stock;
  assert.deepEqual(await demo.callbacks.registerExpense(1.1, " Agua ", { spentAtStr: anchor }), { success: true });
  const expenseId = demo.state.expenses.at(-1).id;
  assert.deepEqual(await demo.callbacks.updateExpense(expenseId, { amount: 2.2 }), { success: true });
  assert.deepEqual(await demo.callbacks.deleteExpense("expense-history"), { success: true });
  assert.deepEqual(await demo.callbacks.updatePayment("payment-history", 11.29), { success: true });
  assert.deepEqual(await demo.callbacks.deletePayment("payment-history"), { success: true });
  assert.equal(demo.state.students[0].nextPaymentDate, originalDue);
  assert.deepEqual(await demo.callbacks.updateSale("sale-history", { quantity: 2, unitAmount: 0 }), { success: true });
  assert.deepEqual(await demo.callbacks.deleteSale("sale-history"), { success: true });
  assert.equal(demo.state.products[0].stock, originalStock);
  assert.equal(demo.state.products[0].priceCents, 2_500);
  assert.equal(demo.commits.length, 7);
});

test("actual reducer errors retain exact cents, date, method, missing-record, partial-patch and overflow semantics", async () => {
  const demo = fixture();
  const before = demo.state;
  for (const amount of [Number.MIN_VALUE, 1e-18, 1.001, 1.0000000000000002, 10_000_000_000]) {
    assert.deepEqual(await demo.callbacks.registerExpense(amount, "A"), { success: false, error: "El importe del gasto debe ser mayor a cero." });
    assert.deepEqual(await demo.callbacks.updatePayment("payment-history", amount), { success: false, error: "El importe debe ser mayor a cero." });
  }
  assert.deepEqual(await demo.callbacks.registerExpense(1.1, "A", { spentAtStr: "2030-06-04" }), { success: false, error: "La fecha del gasto no puede ser futura." });
  assert.deepEqual(await demo.callbacks.updateExpense("missing", { amount: 1 }), { success: false, error: "Gasto no encontrado." });
  assert.deepEqual(await demo.callbacks.updateSale("sale-history", { quantity: 0 }), { success: false, error: "La cantidad debe ser un entero mayor o igual a 1." });
  assert.deepEqual(await demo.callbacks.updateSale("sale-history", { quantity: 2_147_483_647, unitAmount: 9_999_999_999.99 }), { success: false, error: "El importe total no es válido." });
  assert.deepEqual(await demo.callbacks.updateSale("missing", { quantity: 1 }), { success: false, error: "Venta no encontrada." });
  assert.equal(demo.state.payments[0].amountCents, before.payments[0].amountCents);

  const archived = fixture({ ...seeded(), payments: [{ ...seeded().payments[0], id: "archived-payment", studentId: GYM_DEMO_ARCHIVED_STUDENT_ID }] });
  assert.deepEqual(await archived.callbacks.updatePayment("archived-payment", 2), { success: true });
  assert.deepEqual(await archived.callbacks.deletePayment("archived-payment"), { success: true });
});

test("canonical GYM authorization precedes DTO, state, clock and ID access, while history follows the ADMIN policy", async () => {
  for (const token of [null, {}, { id: GYM_DEMO_ADMIN_ID, role: "ADMIN" }, getGymDemoActorToken(GYM_DEMO_GENERAL_STUDENT_ID)]) {
    let calls = 0;
    const callbacks = createGymRevenueDemoCallbackFactory({
      boundGymActorToken: token,
      getState: () => { calls += 1; throw new Error("state"); },
      commit: () => { calls += 1; },
      trustedExpenseDatePolicy: { today: () => { calls += 1; return anchor; } },
      nextId: () => { calls += 1; return "id"; },
    });
    const hostile = Object.defineProperty({}, "amount", { get() { calls += 1; throw new Error("DTO"); } });
    for (const call of [
      () => callbacks.registerExpense(hostile, hostile, hostile), () => callbacks.updateExpense(hostile, hostile), () => callbacks.deleteExpense(hostile),
      () => callbacks.updatePayment(hostile, hostile), () => callbacks.deletePayment(hostile), () => callbacks.updateSale(hostile, hostile), () => callbacks.deleteSale(hostile),
    ]) assert.deepEqual(await call(), { success: false, error: "No autorizado." });
    assert.equal(calls, 0);
  }

  const staff = fixture(seeded(), { boundGymActorToken: teacher });
  assert.deepEqual(await staff.callbacks.registerExpense(1, "No"), { success: false, error: "No autorizado." });
  assert.deepEqual(await staff.callbacks.updatePayment("payment-history", 2), { success: false, error: "No autorizado." });
  assert.deepEqual(await staff.callbacks.updateSale("sale-history", { quantity: 2 }), { success: false, error: "No autorizado." });
});

test("one factory gate coalesces exact work, fences cancellation, reads fresh state and releases trusted exceptions", async () => {
  let reads = 0;
  const demo = fixture(seeded(), { getState: () => { reads += 1; return demo.state; } });
  const first = demo.callbacks.updatePayment("payment-history", 2);
  assert.equal(first, demo.callbacks.updatePayment("payment-history", 2));
  assert.equal(reads, 0);
  assert.deepEqual(await demo.callbacks.deletePayment("payment-history"), busy);
  assert.deepEqual(await first, { success: true });
  assert.equal(reads, 1);
  assert.deepEqual(await demo.callbacks.updatePayment("payment-history", 3), { success: true });

  const reset = fixture();
  const old = reset.callbacks.registerExpense(1, "Agua");
  reset.callbacks.cancelPending();
  assert.deepEqual(await old, cancelled);
  assert.equal(reset.commits.length, 0);
  assert.deepEqual(await reset.callbacks.registerExpense(1, "Agua"), { success: true });

  let stateCalls = 0;
  const throwing = fixture(seeded(), { getState: () => { stateCalls += 1; if (stateCalls === 1) throw new Error("GET_STATE"); return seeded(); } });
  await assert.rejects(throwing.callbacks.updatePayment("payment-history", 2), /GET_STATE/);
  assert.deepEqual(await throwing.callbacks.updatePayment("payment-history", 2), { success: true }, "rejection clears the gate");
});

test("reentrant ID dependencies reserve old candidates, cancel old work, and leave fresh work coalescible", async () => {
  let state = seeded();
  let callbacks;
  let replacement;
  let calls = 0;
  callbacks = createGymRevenueDemoCallbackFactory({
    boundGymActorToken: admin,
    getState: () => state,
    commit: (next) => { state = next; },
    trustedExpenseDatePolicy: { today: () => anchor },
    nextId: () => {
      calls += 1;
      if (calls === 1) {
        callbacks.cancelPendingMutation();
        replacement = callbacks.registerExpense(2, "Fresh");
        assert.equal(replacement, callbacks.registerExpense(2, "Fresh"));
        return "old-id";
      }
      return "fresh-id";
    },
  });
  assert.deepEqual(await callbacks.registerExpense(1, "Old"), cancelled);
  assert.deepEqual(await replacement, { success: true });
  assert.equal(state.expenses.at(-1).id, "fresh-id");
});

test("expense allocation is bounded, lifetime-reserved, and never used by history operations", async () => {
  const long = "x".repeat(65);
  const values = [long, "second", "third"];
  const demo = fixture(seeded(), { nextId: () => values.shift() ?? "reused" });
  assert.deepEqual(await demo.callbacks.registerExpense(1, "A"), { success: true });
  assert.equal(demo.state.expenses.at(-1).id, long);
  assert.deepEqual(await demo.callbacks.deleteExpense(long), { success: true });
  assert.deepEqual(await demo.callbacks.registerExpense(1, "B"), { success: true });
  assert.notEqual(demo.state.expenses.at(-1).id, long);

  let calls = 0;
  const history = fixture(seeded(), { nextId: () => { calls += 1; return "never"; } });
  assert.deepEqual(await history.callbacks.updatePayment("payment-history", 2), { success: true });
  assert.deepEqual(await history.callbacks.deleteSale("sale-history"), { success: true });
  assert.equal(calls, 0);

  let attempts = 0;
  const exhausted = fixture(seeded(), { nextId: () => { attempts += 1; return "same"; } });
  assert.deepEqual(await exhausted.callbacks.registerExpense(1, "A"), { success: true });
  assert.deepEqual(await exhausted.callbacks.registerExpense(1, "B"), { success: false, error: "No se pudo asignar un identificador local de gasto." });
  assert.equal(attempts, 65);
});

function optionsProxy(base, mutateSecond = () => {}, reorder = false) {
  let keys = 0;
  let gets = 0;
  const proxy = new Proxy(base, {
    ownKeys(target) { keys += 1; if (keys === 2) mutateSecond(target); return reorder && keys === 2 ? [...Reflect.ownKeys(target)].reverse() : Reflect.ownKeys(target); },
    get() { gets += 1; throw new Error("source get"); },
  });
  return { proxy, get keys() { return keys; }, get gets() { return gets; } };
}

test("patches and expense options use stable descriptor-only capture and ignore post-enqueue mutation", async () => {
  for (const mutation of [
    (value) => { value.extra = true; },
    (value) => { value[Symbol("extra")] = true; },
    (value) => { Object.defineProperty(value, "hidden", { value: 1 }); },
    (value) => { delete value.amount; },
  ]) {
    let reads = 0; let ids = 0; let commits = 0;
    const demo = fixture(seeded(), { getState: () => { reads += 1; return demo.state; }, nextId: () => { ids += 1; return "id"; }, commit: () => { commits += 1; } });
    const hostile = optionsProxy({ amount: 2 }, mutation);
    assert.deepEqual(await demo.callbacks.updateExpense("expense-history", hostile.proxy), { success: false, error: "El gasto no es válido." });
    assert.equal(reads, 0); assert.equal(ids, 0); assert.equal(commits, 0); assert.equal(hostile.gets, 0); assert.equal(hostile.keys, 2);
  }

  const demo = fixture();
  const patch = { amount: 2 };
  const queued = demo.callbacks.updateExpense("expense-history", patch);
  patch.amount = 99;
  assert.deepEqual(await queued, { success: true });
  assert.equal(demo.state.expenses[0].amountCents, 200);
  const reordered = optionsProxy({ spentAtStr: anchor }, () => {}, true);
  assert.deepEqual(await demo.callbacks.registerExpense(1, "Fecha", reordered.proxy), { success: true });
  assert.equal(reordered.keys, 2);
  assert.equal(reordered.gets, 0);
});
