import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { getGymDemoActorToken, GYM_DEMO_ADMIN_ID, GYM_DEMO_PRIMARY_TEACHER_ID } from "../scenarios/gym-demo-directory.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createGymFinanceDemoFixture } from "./gym-finance-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createGymCatalogDemoCallbackFactory, projectGymCatalogDemoManagement } from "./gym-catalog-demo-adapters.ts";

const anchor = "2030-06-03";
const admin = getGymDemoActorToken(GYM_DEMO_ADMIN_ID);
const teacher = getGymDemoActorToken(GYM_DEMO_PRIMARY_TEACHER_ID);
const busy = { success: false, error: "Hay una operación de catálogo en curso. Esperá un momento." };
const cancelled = { success: false, error: "La operación de catálogo fue restablecida antes de guardarse." };

function input(overrides = {}) {
  return { description: "Barra proteica", categoryId: "gym-finance-category-supplements", salePrice: 1.1, stock: -3, ...overrides };
}

function fixture(overrides = {}) {
  let state = createGymFinanceDemoFixture(anchor);
  const commits = [];
  const callbacks = createGymCatalogDemoCallbackFactory({
    gymActorToken: admin,
    getState: () => state,
    commit: (next) => { state = next; commits.push(next); },
    ...overrides,
  });
  return { callbacks, commits, get state() { return state; }, set state(next) { state = next; } };
}

test("GYM catalog factory maps all six product contracts to the shared reducers", async () => {
  const demo = fixture();
  assert.deepEqual(await demo.callbacks.createCategory(" Snacks "), { success: true, category: { id: "gym-catalog-category-local-1", name: "Snacks" } });
  assert.deepEqual(await demo.callbacks.updateCategory("gym-catalog-category-local-1", " Barras "), { success: true });
  assert.deepEqual(await demo.callbacks.createProduct(input({ categoryId: "gym-catalog-category-local-1" })), { success: true, code: 4 });
  assert.deepEqual(await demo.callbacks.updateProduct("gym-catalog-product-local-1", input({ categoryId: "gym-catalog-category-local-1", salePrice: 0.29, stock: -7, code: 8 })), { success: true });
  assert.deepEqual(await demo.callbacks.deleteProduct("gym-catalog-product-local-1"), { success: true });
  assert.deepEqual(await demo.callbacks.deleteCategory("gym-catalog-category-local-1"), { success: false, error: "No se puede eliminar una categoría con productos asociados." });
  assert.equal(demo.state.products.at(-1)?.priceCents, 29, "view cents retain the established exact round trip");
  assert.equal(demo.state.products.at(-1)?.deletedAt, anchor);
  assert.equal(demo.commits.length, 5);
});

test("reducer business rules remain authoritative for category use, code overflow/collision, stock and malformed values", async () => {
  const demo = fixture();
  assert.match((await demo.callbacks.deleteCategory("gym-finance-category-accessories")).error, /productos asociados/);
  assert.deepEqual(await demo.callbacks.createProduct(input({ salePrice: 1.001 })), { success: false, error: "El precio no es válido." });
  assert.deepEqual(await demo.callbacks.createProduct(input({ categoryId: "missing" })), { success: false, error: "Categoría no encontrada." });
  assert.deepEqual(await demo.callbacks.createProduct(input({ code: 1 })), { success: false, error: "Ya existe un producto con ese código." });
  assert.equal((await demo.callbacks.updateProduct("gym-finance-product-band", input({ stock: -2_147_483_648, code: 9 }))).success, true, "signed stock stays reducer-valid");
  demo.state = { ...demo.state, nextProductCode: 2_147_483_647 };
  assert.deepEqual(await demo.callbacks.createProduct(input({ code: undefined })), { success: false, error: "El contador de códigos no admite otro producto." });
  const malformed = Object.defineProperty({}, "salePrice", { get() { throw new Error("must not read getter"); } });
  assert.deepEqual(await demo.callbacks.createProduct(malformed), { success: false, error: "El precio no es válido." });
});

test("the bound designated GYM admin is the only authority and denial reads no caller input, state or dependencies", async () => {
  const copied = { id: GYM_DEMO_ADMIN_ID, role: "ADMIN" };
  for (const token of [null, teacher, copied, { id: "finance-admin", role: "ADMIN" }]) {
    let calls = 0;
    const callbacks = createGymCatalogDemoCallbackFactory({
      gymActorToken: token,
      getState: () => { calls += 1; throw new Error("state"); },
      commit: () => { calls += 1; },
      nextId: () => { calls += 1; return "id"; },
    });
    const hostile = Object.defineProperty({}, "description", { get() { calls += 1; throw new Error("input"); } });
    assert.deepEqual(await callbacks.createProduct(hostile), { success: false, error: "No autorizado." });
    assert.deepEqual(await callbacks.createCategory(hostile), { success: false, error: "No autorizado." });
    assert.equal(calls, 0);
  }
});

test("one factory-wide microtask gate coalesces exact work, uses one fresh state and permits settled repeats", async () => {
  let reads = 0;
  const demo = fixture({ getState: () => { reads += 1; return demo.state; } });
  const first = demo.callbacks.createCategory("Nueva");
  const same = demo.callbacks.createCategory("Nueva");
  const different = demo.callbacks.deleteProduct("gym-finance-product-band");
  assert.equal(first, same);
  assert.equal(reads, 0);
  assert.deepEqual(await different, busy);
  assert.equal((await first).success, true);
  assert.equal(reads, 1);
  assert.equal((await demo.callbacks.createCategory("Otra")).success, true);
  assert.equal(reads, 2);
});

test("cancellation and reentrant trusted dependencies fence old generations and do not clear newer work", async () => {
  const demo = fixture();
  const old = demo.callbacks.createCategory("Vieja");
  demo.callbacks.cancelPending();
  const fresh = demo.callbacks.createCategory("Nueva");
  assert.deepEqual(await old, cancelled);
  assert.equal((await fresh).success, true);

  let state = createGymFinanceDemoFixture(anchor);
  let callbacks;
  let replacement;
  callbacks = createGymCatalogDemoCallbackFactory({
    gymActorToken: admin,
    getState: () => {
      if (!replacement) {
        callbacks.cancelPending();
        replacement = callbacks.createCategory("Nueva generación");
      }
      return state;
    },
    commit: (next) => { state = next; },
  });
  assert.deepEqual(await callbacks.createCategory("Anterior"), cancelled);
  assert.equal((await replacement).success, true);
  assert.equal(state.categories.at(-1)?.name, "Nueva generación");
});

test("factory IDs are lifetime reservations across entities, commands, failures, reset and bounded attempts", async () => {
  const long = "x".repeat(65);
  const demo = fixture({ nextId: () => long });
  assert.equal((await demo.callbacks.createCategory("Nueva")).success, true);
  assert.equal(demo.state.categories.at(-1)?.id, long);
  demo.state = createGymFinanceDemoFixture(anchor);
  assert.deepEqual(await demo.callbacks.createCategory("Otra"), { success: false, error: "No se pudo asignar un identificador local del catálogo." });

  let attempts = 0;
  const exhausted = fixture({ nextId: () => { attempts += 1; return "occupied"; } });
  assert.equal((await exhausted.callbacks.createCategory("Una")).success, true);
  assert.deepEqual(await exhausted.callbacks.updateCategory("gym-finance-category-accessories", "Dos"), { success: false, error: "No se pudo asignar un identificador local del catálogo." });
  assert.equal(attempts, 65, "one accepted ID followed by 64 attempts for the requested command ID");
});

test("trusted errors propagate, release the queue, and product inputs are captured before enqueuing", async () => {
  const getFailure = fixture({ getState: () => { throw new Error("GET_STATE"); } });
  await assert.rejects(getFailure.callbacks.createCategory("X"), /GET_STATE/);
  const idFailure = fixture({ nextId: () => { throw new Error("NEXT_ID"); } });
  await assert.rejects(idFailure.callbacks.createCategory("X"), /NEXT_ID/);
  let commitCalls = 0;
  const commitFailure = fixture({ commit: () => { commitCalls += 1; if (commitCalls === 1) throw new Error("COMMIT"); } });
  await assert.rejects(commitFailure.callbacks.createCategory("X"), /COMMIT/);
  assert.notDeepEqual(await commitFailure.callbacks.createCategory("Y"), busy);

  const demo = fixture();
  const data = input();
  const queued = demo.callbacks.createProduct(data);
  data.description = "Mutated after invocation";
  data.stock = 999;
  assert.equal((await queued).success, true);
  assert.equal(demo.state.products.at(-1)?.description, "Barra proteica");
  assert.equal(demo.state.products.at(-1)?.stock, -3);
});

function capturedProductProxy(base, mutateSecond = () => {}, options = {}) {
  let ownKeysCalls = 0;
  let ordinaryGets = 0;
  const proxy = new Proxy(base, {
    ownKeys(target) {
      ownKeysCalls += 1;
      if (ownKeysCalls === 1 && options.throwFirst) throw new Error("FIRST_OWN_KEYS");
      if (ownKeysCalls === 2) {
        if (options.throwSecond) throw new Error("SECOND_OWN_KEYS");
        mutateSecond(target);
      }
      if (ownKeysCalls > 2 && options.throwThird) throw new Error("THIRD_OWN_KEYS");
      const keys = Reflect.ownKeys(target);
      return options.reorderSecond && ownKeysCalls === 2 ? [...keys].reverse() : keys;
    },
    get() {
      ordinaryGets += 1;
      throw new Error("SOURCE_GET");
    },
  });
  return { proxy, get ownKeysCalls() { return ownKeysCalls; }, get ordinaryGets() { return ordinaryGets; } };
}

test("product input capture compares the two source key lists before state, IDs, commits, or ordinary gets", async () => {
  const cases = [
    ["string addition", (source) => { source.unexpectedCapability = true; }],
    ["symbol addition", (source) => { source[Symbol("unexpected")] = true; }],
    ["non-enumerable addition", (source) => { Object.defineProperty(source, "unexpectedCapability", { value: true }); }],
    ["required removal", (source) => { delete source.stock; }],
    ["same-count replacement", (source) => { delete source.stock; source.unexpectedCapability = true; }],
  ];
  const callbacks = [
    ["create", (factory, value) => factory.createProduct(value), () => input()],
    ["update", (factory, value) => factory.updateProduct("gym-finance-product-band", value), () => input({ code: 1 })],
  ];

  for (const [callbackName, invoke, validInput] of callbacks) {
    for (const [caseName, mutate] of cases) {
      let reads = 0;
      let ids = 0;
      let commits = 0;
      const demo = fixture({
        getState: () => { reads += 1; return demo.state; },
        nextId: () => { ids += 1; return `id-${callbackName}-${caseName}`; },
        commit: () => { commits += 1; },
      });
      const hostile = capturedProductProxy(validInput(), mutate);
      const result = await invoke(demo.callbacks, hostile.proxy);
      assert.equal(result.success, false, `${callbackName}/${caseName}`);
      assert.equal(reads, 0, `${callbackName}/${caseName} must not capture state`);
      assert.equal(ids, 0, `${callbackName}/${caseName} must not allocate`);
      assert.equal(commits, 0, `${callbackName}/${caseName} must not commit`);
      assert.equal(hostile.ordinaryGets, 0, `${callbackName}/${caseName} must use descriptors only`);
      assert.equal(hostile.ownKeysCalls, 2, `${callbackName}/${caseName} must not enumerate source a third time`);

      const control = capturedProductProxy(validInput());
      assert.equal((await invoke(demo.callbacks, control.proxy)).success, true, `${callbackName}/${caseName} leaves the factory usable`);
      assert.equal(control.ownKeysCalls, 2);
      assert.equal(control.ordinaryGets, 0);
    }
  }
});

test("product input capture handles reflection failures and accepts coherent reordered maps without a third source enumeration", async () => {
  for (const [name, options] of [["first", { throwFirst: true }], ["second", { throwSecond: true }]]) {
    let reads = 0;
    const demo = fixture({ getState: () => { reads += 1; return demo.state; } });
    const hostile = capturedProductProxy(input(), () => {}, options);
    assert.equal((await demo.callbacks.createProduct(hostile.proxy)).success, false, `${name} enumeration failure`);
    assert.equal(reads, 0);
    assert.equal(hostile.ordinaryGets, 0);
  }

  for (const [callbackName, invoke, validInput] of [
    ["create", (factory, value) => factory.createProduct(value), () => input()],
    ["update", (factory, value) => factory.updateProduct("gym-finance-product-band", value), () => input({ code: 1 })],
  ]) {
    let commits = 0;
    const demo = fixture({ commit: () => { commits += 1; } });
    const stable = capturedProductProxy(validInput(), () => {}, { reorderSecond: true, throwThird: true });
    assert.equal((await invoke(demo.callbacks, stable.proxy)).success, true, `${callbackName} accepts the same key set in a different order`);
    assert.equal(commits, 1);
    assert.equal(stable.ownKeysCalls, 2, `${callbackName} never asks the source for a third key list`);
    assert.equal(stable.ordinaryGets, 0);
  }
});

test("management projection authorizes before state capture and keeps BOX presentation shape/order", () => {
  let reads = 0;
  const hostile = new Proxy(createGymFinanceDemoFixture(anchor), { get(target, key, receiver) { reads += 1; return Reflect.get(target, key, receiver); } });
  assert.deepEqual(projectGymCatalogDemoManagement(hostile, teacher), { success: false, error: "No autorizado." });
  assert.equal(reads, 0);
  assert.deepEqual(projectGymCatalogDemoManagement({ ...createGymFinanceDemoFixture(anchor), namespace: "wody-box-finance-demo" }, admin), { success: false, error: "El estado financiero no es válido." });

  const state = createGymFinanceDemoFixture(anchor);
  const projected = projectGymCatalogDemoManagement(state, admin);
  assert.equal(projected.success, true);
  if (!projected.success) throw new Error("projection unexpectedly failed");
  assert.deepEqual(projected.categories, state.categories);
  assert.deepEqual(projected.products.map((row) => row.id), state.products.map((row) => row.id));
  assert.equal(projected.previewCode, state.nextProductCode);
  const empty = projectGymCatalogDemoManagement({ ...state, categories: [], products: [], nextProductCode: 1 }, admin);
  assert.deepEqual(empty, { success: true, categories: [], products: [], previewCode: 1 });
});
