import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import {
  getGymDemoActorToken,
  GYM_DEMO_ADMIN_ID,
  GYM_DEMO_GENERAL_STUDENT_ID,
  GYM_DEMO_PRIMARY_TEACHER_ID,
  GYM_DEMO_SECONDARY_TEACHER_ID,
} from "../scenarios/gym-demo-directory.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createGymFinanceDemoFixture } from "./gym-finance-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createGymSaleDemoCallbackFactory, projectGymSaleDemoCatalog } from "./gym-sale-demo-adapters.ts";

const anchor = "2030-06-03";
const admin = getGymDemoActorToken(GYM_DEMO_ADMIN_ID);
const primaryTeacher = getGymDemoActorToken(GYM_DEMO_PRIMARY_TEACHER_ID);
const secondaryTeacher = getGymDemoActorToken(GYM_DEMO_SECONDARY_TEACHER_ID);
const saleOptions = { soldAtStr: anchor, paymentMethod: "EFECTIVO" };
const busy = { success: false, error: "Hay una venta en curso. Esperá un momento." };
const cancelled = { success: false, error: "La venta fue restablecida antes de registrarse." };

function fixture(overrides = {}) {
  let state = createGymFinanceDemoFixture(anchor);
  const commits = [];
  const callback = createGymSaleDemoCallbackFactory({
    gymActorToken: admin,
    getState: () => state,
    commit: (next) => { state = next; commits.push(next); },
    trustedSaleDatePolicy: { today: () => anchor },
    ...overrides,
  });
  return { callback, commits, get state() { return state; }, set state(value) { state = value; } };
}

function sell(callback, productId = "gym-finance-product-band", quantity = 1, amount = 25, options = saleOptions) {
  return callback(productId, quantity, amount, options);
}

test("GYM sale callbacks bind the canonical admin and both canonical teachers to the actual sale reducer", async () => {
  for (const token of [admin, primaryTeacher, secondaryTeacher]) {
    const demo = fixture({ gymActorToken: token });
    assert.deepEqual(await sell(demo.callback), { success: true });
    assert.equal(demo.commits.length, 1);
    assert.deepEqual(demo.state.sales[0], {
      id: "gym-sale-sale-local-1",
      commandId: "gym-sale-command-local-1",
      productId: "gym-finance-product-band",
      quantity: 1,
      unitAmountCents: 2500,
      totalAmountCents: 2500,
      paymentMethod: "EFECTIVO",
      soldAt: anchor,
      recordedById: token === admin ? GYM_DEMO_ADMIN_ID : token === primaryTeacher ? GYM_DEMO_PRIMARY_TEACHER_ID : GYM_DEMO_SECONDARY_TEACHER_ID,
    });
  }
});

test("GYM sales preserve BOX cents boundary while the reducer owns product, date, method, totals and stock semantics", async () => {
  const demo = fixture();
  assert.deepEqual(await sell(demo.callback, "missing"), { success: false, error: "Producto no encontrado." });
  assert.deepEqual(await sell(demo.callback, "gym-finance-product-band", 0), { success: false, error: "La cantidad no es válida." });
  assert.deepEqual(await sell(demo.callback, "gym-finance-product-band", 1.5), { success: false, error: "La cantidad no es válida." });
  assert.deepEqual(await sell(demo.callback, "gym-finance-product-band", 1, 1.001), { success: false, error: "El importe unitario no es válido." });
  assert.deepEqual(await sell(demo.callback, "gym-finance-product-band", 1, 1.1, { ...saleOptions, paymentMethod: "CHEQUE" }), { success: false, error: "La venta no es válida." });
  assert.deepEqual(await sell(demo.callback, "gym-finance-product-band", 1, 1.1, { ...saleOptions, soldAtStr: "2030-06-04" }), { success: false, error: "La fecha de la venta no puede ser futura." });
  assert.deepEqual(await sell(demo.callback, "gym-finance-product-band", 2_147_483_647, 9999999999.99), { success: false, error: "El importe total no es válido." });
  assert.deepEqual(await sell(demo.callback, "gym-finance-product-protein", 6, 0.29, { ...saleOptions, paymentMethod: "MERCADO_PAGO" }), { success: true });
  assert.equal(demo.state.sales[0].unitAmountCents, 29);
  assert.equal(demo.state.products.find((item) => item.id === "gym-finance-product-protein")?.stock, -1, "negative stock is a reducer warning, not a sale block");

  const historical = { ...demo.state.sales[0] };
  demo.state.products.find((item) => item.id === historical.productId).priceCents = 99_999;
  assert.deepEqual(demo.state.sales[0], historical, "sale amounts are immutable historical snapshots");
});

test("denied, copied, BOX-shaped, Personal-shaped, student, hostile and revoked tokens read no input, state, date or IDs", async () => {
  const actualRevoked = Proxy.revocable({}, {});
  actualRevoked.revoke();
  for (const token of [null, actualRevoked.proxy, { id: GYM_DEMO_ADMIN_ID, role: "ADMIN" }, { id: "finance-admin", role: "ADMIN" }, { id: GYM_DEMO_ADMIN_ID, role: "ADMIN", gymKind: "PERSONAL" }, getGymDemoActorToken(GYM_DEMO_GENERAL_STUDENT_ID), Object.defineProperty({}, "id", { get() { throw new Error("token getter"); } })]) {
    let calls = 0;
    const callback = createGymSaleDemoCallbackFactory({
      gymActorToken: token,
      getState: () => { calls += 1; throw new Error("state"); },
      commit: () => { calls += 1; },
      nextId: () => { calls += 1; return "id"; },
      trustedSaleDatePolicy: { today: () => { calls += 1; return anchor; } },
    });
    const hostile = Object.defineProperty({}, "soldAtStr", { get() { calls += 1; throw new Error("input"); } });
    assert.deepEqual(await sell(callback, hostile, hostile, hostile, hostile), { success: false, error: "No autorizado." });
    assert.equal(calls, 0);
  }
});

test("one pending sale coalesces exact input, reads fresh state once, permits settled repeats, and cancellation fences queued work", async () => {
  let reads = 0;
  const demo = fixture({ getState: () => { reads += 1; return demo.state; } });
  const first = sell(demo.callback);
  const same = sell(demo.callback);
  const other = sell(demo.callback, "gym-finance-product-bottle");
  assert.equal(first, same);
  assert.equal(reads, 0);
  assert.deepEqual(await other, busy);
  assert.deepEqual(await first, { success: true });
  assert.equal(reads, 1);
  assert.deepEqual(await sell(demo.callback), { success: true }, "settled sale is a new transaction");
  assert.equal(demo.state.sales.length, 2);

  const reset = fixture();
  const old = sell(reset.callback);
  reset.callback.cancelPendingSale();
  const fresh = sell(reset.callback, "gym-finance-product-bottle");
  assert.deepEqual(await old, cancelled);
  assert.deepEqual(await fresh, { success: true });

  const alias = fixture();
  const aliasOld = sell(alias.callback);
  alias.callback.cancelPending();
  assert.deepEqual(await aliasOld, cancelled);
});

test("reentrant state, date and ID dependencies cancel old work without clearing a fresh generation", async () => {
  for (const dependency of ["state", "date", "id"]) {
    let state = createGymFinanceDemoFixture(anchor);
    let callback;
    let replacement;
    let idCalls = 0;
    const replace = () => {
      if (replacement) return;
      callback.cancelPendingSale();
      replacement = sell(callback, "gym-finance-product-bottle", 1, 40);
      assert.equal(replacement, sell(callback, "gym-finance-product-bottle", 1, 40));
    };
    callback = createGymSaleDemoCallbackFactory({
      gymActorToken: admin,
      getState: () => { if (dependency === "state") replace(); return state; },
      commit: (next) => { state = next; },
      trustedSaleDatePolicy: { today: () => { if (dependency === "date") replace(); return anchor; } },
      nextId: dependency === "id" ? () => {
        idCalls += 1;
        if (idCalls === 1) { replace(); return "old-id"; }
        return idCalls === 2 ? "fresh-sale" : "fresh-command";
      } : undefined,
    });
    assert.deepEqual(await sell(callback), cancelled, dependency);
    assert.deepEqual(await replacement, { success: true }, dependency);
    if (dependency === "id") assert.notEqual(state.sales[0].id, "old-id");
  }
});

test("ID allocations are lifetime reservations across failed sales and are bounded by attempts rather than identifier length", async () => {
  let sequence = 0;
  const demo = fixture({ nextId: (kind) => `${kind}-${++sequence}` });
  assert.deepEqual(await sell(demo.callback, "missing"), { success: false, error: "Producto no encontrado." });
  assert.deepEqual(await sell(demo.callback), { success: true });
  assert.equal(demo.state.sales[0].id, "sale-3", "IDs allocated before a reducer failure stay reserved");

  const long = "x".repeat(65);
  const longDemo = fixture({ nextId: (() => {
    const values = [long, "cmd"];
    return () => values.shift() ?? "stuck";
  })() });
  assert.deepEqual(await sell(longDemo.callback), { success: true });
  assert.equal(longDemo.state.sales[0].id, long);

  let attempts = 0;
  const exhausted = fixture({ nextId: () => { attempts += 1; return "same"; } });
  assert.deepEqual(await sell(exhausted.callback), { success: false, error: "No se pudo asignar un identificador local de venta." });
  assert.equal(attempts, 65, "one accepted sale ID then 64 command attempts");
});

function optionsProxy(base, mutateSecond = () => {}, config = {}) {
  let ownKeysCalls = 0;
  let gets = 0;
  const proxy = new Proxy(base, {
    ownKeys(target) {
      ownKeysCalls += 1;
      if (ownKeysCalls === 2) mutateSecond(target);
      if (ownKeysCalls > 2 && config.throwThird) throw new Error("third enumeration");
      return config.reorderSecond && ownKeysCalls === 2 ? [...Reflect.ownKeys(target)].reverse() : Reflect.ownKeys(target);
    },
    get() { gets += 1; throw new Error("source get"); },
  });
  return { proxy, get ownKeysCalls() { return ownKeysCalls; }, get gets() { return gets; } };
}

test("sale options capture accepts only stable plain data descriptors before queueing and ignores later mutation", async () => {
  const mutations = [
    (value) => { value.extra = true; },
    (value) => { value[Symbol("extra")] = true; },
    (value) => { Object.defineProperty(value, "extra", { value: true }); },
    (value) => { delete value.soldAtStr; },
    (value) => { delete value.soldAtStr; value.extra = true; },
  ];
  for (const mutate of mutations) {
    let reads = 0; let ids = 0; let commits = 0;
    const demo = fixture({ getState: () => { reads += 1; return demo.state; }, nextId: () => { ids += 1; return "id"; }, commit: () => { commits += 1; } });
    const hostile = optionsProxy({ ...saleOptions }, mutate);
    assert.deepEqual(await sell(demo.callback, "gym-finance-product-band", 1, 25, hostile.proxy), { success: false, error: "La venta no es válida." });
    assert.equal(reads, 0); assert.equal(ids, 0); assert.equal(commits, 0);
    assert.equal(hostile.gets, 0); assert.equal(hostile.ownKeysCalls, 2);
  }

  const demo = fixture();
  const options = { ...saleOptions };
  const queued = sell(demo.callback, "gym-finance-product-band", 1, 25, options);
  options.soldAtStr = "2030-06-04";
  options.paymentMethod = "CHEQUE";
  assert.deepEqual(await queued, { success: true });

  const reordered = optionsProxy({ ...saleOptions }, () => {}, { reorderSecond: true, throwThird: true });
  assert.deepEqual(await sell(demo.callback, "gym-finance-product-bottle", 1, 40, reordered.proxy), { success: true });
  assert.equal(reordered.ownKeysCalls, 2);
  assert.equal(reordered.gets, 0);
});

test("GYM sale catalog projection gates before capture, distinguishes invalid from empty, preserves order/prices and detaches DTOs", () => {
  let reads = 0;
  const hostile = new Proxy(createGymFinanceDemoFixture(anchor), { get(target, key, receiver) { reads += 1; return Reflect.get(target, key, receiver); } });
  assert.deepEqual(projectGymSaleDemoCatalog(hostile, getGymDemoActorToken(GYM_DEMO_GENERAL_STUDENT_ID)), { success: false, error: "No autorizado." });
  assert.equal(reads, 0);
  assert.deepEqual(projectGymSaleDemoCatalog({ ...createGymFinanceDemoFixture(anchor), namespace: "wody-box-finance-demo" }, admin), { success: false, error: "El estado financiero no es válido." });

  const state = createGymFinanceDemoFixture(anchor);
  const projection = projectGymSaleDemoCatalog(state, primaryTeacher);
  assert.equal(projection.success, true);
  if (!projection.success) throw new Error("expected sale projection");
  assert.deepEqual(projection.products.map((item) => [item.id, item.salePrice, item.categoryName]), [
    ["gym-finance-product-band", 25, "Accesorios"],
    ["gym-finance-product-bottle", 40, "Accesorios"],
    ["gym-finance-product-protein", 320, "Suplementos"],
  ]);
  projection.products[0].description = "mutated DTO";
  assert.equal(state.products[0].description, "Banda elástica");
  assert.deepEqual(projectGymSaleDemoCatalog({ ...state, products: [], categories: [], nextProductCode: 1 }, admin), { success: true, products: [] });
});

test("trusted dependency failures reject and release the queue for a later call", async () => {
  const stateFailure = fixture({ getState: () => { throw new Error("GET_STATE"); } });
  await assert.rejects(sell(stateFailure.callback), /GET_STATE/);
  const dateFailure = fixture({ trustedSaleDatePolicy: { today: () => { throw new Error("CLOCK"); } } });
  await assert.rejects(sell(dateFailure.callback), /CLOCK/);
  const idFailure = fixture({ nextId: () => { throw new Error("NEXT_ID"); } });
  await assert.rejects(sell(idFailure.callback), /NEXT_ID/);
  let commitCalls = 0;
  const commitFailure = fixture({ commit: () => { commitCalls += 1; if (commitCalls === 1) throw new Error("COMMIT"); } });
  await assert.rejects(sell(commitFailure.callback), /COMMIT/);
  assert.notDeepEqual(await sell(commitFailure.callback, "gym-finance-product-bottle"), busy);
});
