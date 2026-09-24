import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import * as payments from "../finance/gym-finance-payment-adapters.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import * as catalog from "../finance/gym-catalog-demo-adapters.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import * as sales from "../finance/gym-sale-demo-adapters.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import * as revenue from "../finance/gym-revenue-demo-adapters.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import * as fixtures from "../finance/gym-finance-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import * as storageModule from "../finance/gym-finance-demo-storage.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import * as directory from "../scenarios/gym-demo-directory.ts";

const root = new URL("../../../../", import.meta.url);
const source = () => readFile(new URL("src/components/demo/gym/DemoGymFinanceProvider.tsx", root), "utf8");
const ownKey = "wody-gym-finance-demo-v1";
const admin = directory.GYM_DEMO_ADMIN_ID;
const primaryTeacher = directory.GYM_DEMO_PRIMARY_TEACHER_ID;
const secondaryTeacher = directory.GYM_DEMO_SECONDARY_TEACHER_ID;
const generalStudent = directory.GYM_DEMO_GENERAL_STUDENT_ID;

async function createHarness({ raw = null, getItem, setItem, profileLinks = directory.getGymDemoTeacherStudentLinks() } = {}) {
  const compiled = ts.transpileModule(await source(), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const states = [];
  const refs = [];
  const effects = [];
  let hook = 0;
  let published = null;
  const timers = [];
  const reads = [];
  const writes = [];
  let currentProfileLinks = profileLinks;
  const paymentFactoryOptions = [];
  const Context = { Provider: () => null };
  const react = {
    createContext: () => Context,
    useState: (initial) => {
      const index = hook++;
      if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
      return [states[index], (next) => { states[index] = typeof next === "function" ? next(states[index]) : next; }];
    },
    useRef: (initial) => {
      const index = hook++;
      return refs[index] ??= { current: initial };
    },
    useEffect: (effect) => { hook++; effects.push(effect); },
    useMemo: (factory) => (hook++, factory()),
    useCallback: (callback) => (hook++, callback),
    useContext: () => null,
  };
  const previousWindow = globalThis.window;
  const memory = new Map([[ownKey, raw], ["unrelated-key", "preserved"]]);
  globalThis.window = {
    sessionStorage: {
      getItem: (key) => {
        reads.push(key);
        return getItem ? getItem(key, memory) : (memory.get(key) ?? null);
      },
      setItem: (key, value) => {
        writes.push([key, value]);
        if (setItem) return setItem(key, value, memory);
        memory.set(key, value);
      },
    },
    setTimeout: (callback) => (timers.push({ callback, cancelled: false }), timers.length - 1),
    clearTimeout: (id) => { timers[id].cancelled = true; },
  };
  const counts = { payment: 0, catalog: 0, sale: 0, revenue: 0 };
  const mocks = {
    react,
    "react/jsx-runtime": {
      jsx: (type, props) => { if (type === Context.Provider) published = props.value; return { type, props }; },
      jsxs: (type, props) => ({ type, props }),
    },
    "@/lib/dates": { getTodayArgentina: () => new Date("2030-06-03T12:00:00.000Z"), toInputDate: (date) => date.toISOString().slice(0, 10) },
    "@/components/demo/finance/gym-finance-payment-adapters": {
      ...payments,
      createGymFinancePaymentCallbackFactory: (options) => {
        counts.payment += 1;
        paymentFactoryOptions.push(options);
        return payments.createGymFinancePaymentCallbackFactory(options);
      },
    },
    "@/components/demo/finance/gym-catalog-demo-adapters": { ...catalog, createGymCatalogDemoCallbackFactory: (options) => (counts.catalog += 1, catalog.createGymCatalogDemoCallbackFactory(options)) },
    "@/components/demo/finance/gym-sale-demo-adapters": { ...sales, createGymSaleDemoCallbackFactory: (options) => (counts.sale += 1, sales.createGymSaleDemoCallbackFactory(options)) },
    "@/components/demo/finance/gym-revenue-demo-adapters": { ...revenue, createGymRevenueDemoCallbackFactory: (options) => (counts.revenue += 1, revenue.createGymRevenueDemoCallbackFactory(options)) },
    "@/components/demo/finance/gym-finance-demo-fixtures": fixtures,
    "@/components/demo/finance/gym-finance-demo-storage": storageModule,
    "@/components/demo/scenarios/gym-demo-directory": directory,
    // Structural harness patch (same class of gap fixed for gym-demo-provider.test.mjs and
    // gym-demo-integration.test.mjs): the real module is intentionally not loaded here, so
    // DemoGymFinanceProvider's useDemoGymProfile() call resolves against this minimal stand-in
    // instead of the real profile bridge context, which this CJS harness cannot provide.
    "./DemoGymProfileProvider": { useDemoGymProfile: () => ({ profileState: { links: currentProfileLinks } }) },
  };
  const commonjsModule = { exports: {} };
  const require = (specifier) => { if (!(specifier in mocks)) throw new Error(`Unexpected module: ${specifier}`); return mocks[specifier]; };
  new Function("require", "exports", "module", compiled)(require, commonjsModule.exports, commonjsModule);
  const render = () => {
    hook = 0;
    effects.length = 0;
    commonjsModule.exports.DemoGymFinanceProvider({ children: "demo" });
    return effects.slice();
  };
  return {
    counts, memory, reads, writes, paymentFactoryOptions,
    render,
    runTimers: () => { for (const timer of timers) if (!timer.cancelled) timer.callback(); },
    get published() { return published; },
    setProfileLinks: (next) => { currentProfileLinks = next; },
    restore: () => { globalThis.window = previousWindow; },
  };
}

async function hydrate(harness) {
  const effects = harness.render();
  assert.equal(harness.published.ready, false);
  assert.equal(harness.published.paymentCallbacks, null);
  assert.equal(harness.published.catalogCallbacks, null);
  assert.equal(harness.published.saleCallbacks, null);
  assert.equal(harness.published.revenueCallbacks, null);
  const cleanup = effects[0]();
  harness.runTimers();
  harness.render();
  assert.equal(harness.published.ready, true);
  return cleanup;
}

const paymentOptions = { paidAtStr: "2030-06-03", paymentMethod: "EFECTIVO", confirmedDuplicate: false };

function assertRuntimeImmutableLookup(lookup, expectedKeys, injectedKey = generalStudent) {
  assert.equal(typeof lookup.set, "undefined");
  assert.equal(typeof lookup.delete, "undefined");
  assert.equal(typeof lookup.clear, "undefined");
  assert.equal(Object.getPrototypeOf(lookup), null);
  const firstKey = expectedKeys[0];
  const firstValue = lookup.get(firstKey);
  assert.throws(() => Map.prototype.set.call(lookup, injectedKey, firstValue));
  assert.throws(() => Map.prototype.delete.call(lookup, firstKey));
  assert.throws(() => Map.prototype.clear.call(lookup));
  assert.throws(() => Object.defineProperty(lookup, "get", { value: () => firstValue }));
  assert.throws(() => Object.setPrototypeOf(lookup, Map.prototype));
  let callbackMap = null;
  lookup.forEach((_value, _key, map) => { callbackMap = map; });
  assert.equal(callbackMap, lookup);
  const entry = [...lookup.entries()][0];
  try {
    entry[0] = injectedKey;
    entry[1] = firstValue;
  } catch {}
  assert.deepEqual([...lookup.keys()], expectedKeys);
  assert.equal(lookup.get(injectedKey), expectedKeys.includes(injectedKey) ? firstValue : undefined);
  assert.equal(lookup.get(firstKey), firstValue);
}

test("GYM finance provider reads its one key before publishing exactly eight canonical factories", async () => {
  const harness = await createHarness();
  try {
    const cleanup = await hydrate(harness);
    assert.deepEqual(harness.reads, [ownKey]);
    assert.deepEqual(harness.writes, []);
    assert.deepEqual(harness.counts, { payment: 3, catalog: 1, sale: 3, revenue: 1 });
    assert.deepEqual([...harness.published.paymentCallbacks.keys()], [admin, primaryTeacher, secondaryTeacher]);
    assert.deepEqual([...harness.published.catalogCallbacks.keys()], [admin]);
    assert.deepEqual([...harness.published.saleCallbacks.keys()], [admin, primaryTeacher, secondaryTeacher]);
    assert.deepEqual([...harness.published.revenueCallbacks.keys()], [admin]);
    assert.equal(harness.published.catalogCallbacks.get(primaryTeacher), undefined);
    assert.equal(harness.published.today, "2030-06-03");
    cleanup();
  } finally {
    harness.restore();
  }
});

test("GYM finance provider threads a live getGymTeacherStudentLinks accessor from the profile bridge into every payment factory", async () => {
  const injectedLinks = [{ teacherId: primaryTeacher, studentId: generalStudent }];
  const harness = await createHarness({ profileLinks: injectedLinks });
  try {
    const cleanup = await hydrate(harness);
    assert.equal(harness.paymentFactoryOptions.length, 3, "one options object per payment factory");
    for (const options of harness.paymentFactoryOptions) {
      assert.equal(typeof options.getGymTeacherStudentLinks, "function");
      assert.deepEqual(options.getGymTeacherStudentLinks(), injectedLinks, "the provider's accessor must return the current useDemoGymProfile() links, not a canonical default");
    }

    // The SAME already-created accessor must observe a later profile-bridge change: this is the
    // provider-level half of freshness (the factory-level half is proven in
    // gym-finance-payment-adapters.test.mjs). Simulates DemoGymProfileProvider committing a new
    // links array and this provider's own sync effect reacting to it on the next render.
    //
    // Deliberately not indexed (e.g. effects[1]): a future added or reordered effect would make an
    // index-based lookup silently run the wrong effect. Every effect from this render is run
    // instead, which stays correct regardless of position or count. Re-running the hydration effect
    // here is a harmless no-op for this assertion: its own setTimeout is captured but never fired
    // (harness.runTimers() is not called again), so it neither touches harness.published nor
    // duplicates any payment/catalog/sale/revenue factory (each registration is itself guarded by
    // `if (factories.current.has(actorId)) continue;`).
    const updatedLinks = [{ teacherId: secondaryTeacher, studentId: generalStudent }];
    harness.setProfileLinks(updatedLinks);
    for (const effect of harness.render()) effect();
    assert.deepEqual(harness.paymentFactoryOptions[0].getGymTeacherStudentLinks(), updatedLinks);
    cleanup();
  } finally {
    harness.restore();
  }
});

test("GYM finance publishes runtime-immutable canonical lookup bindings", async () => {
  const harness = await createHarness();
  try {
    const cleanup = await hydrate(harness);
    const { paymentCallbacks, catalogCallbacks, saleCallbacks, revenueCallbacks } = harness.published;
    assertRuntimeImmutableLookup(paymentCallbacks, [admin, primaryTeacher, secondaryTeacher]);
    assertRuntimeImmutableLookup(catalogCallbacks, [admin]);
    assertRuntimeImmutableLookup(saleCallbacks, [admin, primaryTeacher, secondaryTeacher]);
    assertRuntimeImmutableLookup(revenueCallbacks, [admin]);
    assert.equal(paymentCallbacks.get(generalStudent), undefined, "a borrowed Map mutation cannot bind the admin callback to a student key");
    assert.equal(catalogCallbacks.get(generalStudent), undefined);
    assert.equal(saleCallbacks.get(generalStudent), undefined);
    assert.equal(revenueCallbacks.get(generalStudent), undefined);
    assert.deepEqual(harness.writes, []);
    assert.equal(harness.published.state.payments.length, 0);
    cleanup();
  } finally { harness.restore(); }
});

test("GYM finance provider uses the synchronous ledger bridge for real staff reducers", async () => {
  const harness = await createHarness();
  try {
    const cleanup = await hydrate(harness);
    const callbacks = harness.published.paymentCallbacks;
    const first = callbacks.get(admin)(generalStudent, "100", "2030-07-03", paymentOptions);
    const second = callbacks.get(primaryTeacher)(directory.GYM_DEMO_PERSONALIZED_STUDENT_ID, "120", "2030-07-05", paymentOptions);
    assert.equal((await first).success, true);
    assert.equal((await second).success, true);
    assert.equal((await callbacks.get(secondaryTeacher)(generalStudent, "100", "2030-07-03", paymentOptions)).success, false, "unassigned teacher remains reducer-denied");
    assert.equal(harness.published.state.payments.length, 0, "the hook harness does not re-render automatically");
    harness.render();
    assert.equal(harness.published.state.payments.length, 2, "two queued factories observe the ref published by the first commit");
    assert.equal((await harness.published.catalogCallbacks.get(admin).createCategory("Novedades")).success, true);
    assert.equal((await harness.published.saleCallbacks.get(primaryTeacher)("gym-finance-product-band", 1, 25, { soldAtStr: "2030-06-03", paymentMethod: "EFECTIVO" })).success, true);
    assert.equal((await harness.published.revenueCallbacks.get(admin).registerExpense(12, "Limpieza", { spentAtStr: "2030-06-03" })).success, true);
    assert.ok(harness.writes.length >= 5);
    assert.ok(harness.writes.every(([key, value]) => key === ownKey && !value.includes("actor") && !value.includes("token")));
    cleanup();
  } finally {
    harness.restore();
  }
});

test("GYM finance reset cancels all eight factories, preserves their reservations, and advances its epoch", async () => {
  const harness = await createHarness();
  try {
    const cleanup = await hydrate(harness);
    const before = harness.published;
    const firstPayment = await before.paymentCallbacks.get(admin)(generalStudent, "100", "2030-07-03", paymentOptions);
    assert.equal(firstPayment.success, true);
    harness.render();
    const pending = [
      harness.published.paymentCallbacks.get(admin)(generalStudent, "100", "2030-08-03", paymentOptions),
      harness.published.catalogCallbacks.get(admin).createCategory("Cancelada"),
      harness.published.saleCallbacks.get(admin)("gym-finance-product-band", 1, 25, { soldAtStr: "2030-06-03", paymentMethod: "EFECTIVO" }),
      harness.published.revenueCallbacks.get(admin).registerExpense(12, "Cancelado", { spentAtStr: "2030-06-03" }),
    ];
    harness.published.reset();
    harness.render();
    assert.equal(harness.published.resetEpoch, 1);
    assert.equal(harness.published.state.payments.length, 0);
    assert.equal(harness.published.paymentCallbacks.get(admin), before.paymentCallbacks.get(admin));
    assert.equal(harness.published.catalogCallbacks.get(admin), before.catalogCallbacks.get(admin));
    assert.equal(harness.published.saleCallbacks.get(admin), before.saleCallbacks.get(admin));
    assert.equal(harness.published.revenueCallbacks.get(admin), before.revenueCallbacks.get(admin));
    assertRuntimeImmutableLookup(harness.published.paymentCallbacks, [admin, primaryTeacher, secondaryTeacher]);
    assertRuntimeImmutableLookup(harness.published.catalogCallbacks, [admin]);
    assertRuntimeImmutableLookup(harness.published.saleCallbacks, [admin, primaryTeacher, secondaryTeacher]);
    assertRuntimeImmutableLookup(harness.published.revenueCallbacks, [admin]);
    for (const result of await Promise.all(pending)) assert.equal(result.success, false);
    const nextPayment = await harness.published.paymentCallbacks.get(admin)(generalStudent, "100", "2030-07-03", paymentOptions);
    assert.deepEqual(nextPayment, { success: true, paymentId: "gym-finance-payment-local-2", idempotent: false });
    assert.deepEqual(harness.counts, { payment: 3, catalog: 1, sale: 3, revenue: 1 });
    assert.equal(harness.memory.get("unrelated-key"), "preserved");
    cleanup();
  } finally {
    harness.restore();
  }
});

test("GYM finance hydration remains read-only across corrupt, unavailable, and restartable lifecycle paths", async () => {
  const corrupt = await createHarness({ raw: "{bad" });
  try {
    const cleanup = await hydrate(corrupt);
    assert.match(corrupt.published.warning, /no es válido/);
    assert.deepEqual(corrupt.writes, []);
    cleanup();
  } finally { corrupt.restore(); }

  const unavailable = await createHarness({ getItem: () => { throw new Error("read"); } });
  try {
    const effects = unavailable.render();
    const firstCleanup = effects[0]();
    firstCleanup();
    const replay = unavailable.render();
    const secondCleanup = replay[0]();
    unavailable.runTimers();
    unavailable.render();
    assert.equal(unavailable.published.ready, true);
    assert.match(unavailable.published.warning, /No se pudo leer/);
    assert.deepEqual(unavailable.writes, []);
    assert.deepEqual(unavailable.counts, { payment: 3, catalog: 1, sale: 3, revenue: 1 });
    secondCleanup();
  } finally { unavailable.restore(); }

  const writeFailure = await createHarness({ setItem: () => { throw new Error("write"); } });
  try {
    const cleanup = await hydrate(writeFailure);
    assert.equal((await writeFailure.published.paymentCallbacks.get(admin)(generalStudent, "100", "2030-07-03", paymentOptions)).success, true);
    writeFailure.render();
    assert.match(writeFailure.published.warning, /no se pudieron guardar/i);
    assert.equal(writeFailure.published.state.payments.length, 1);
    cleanup();
  } finally { writeFailure.restore(); }
});

test("GYM finance provider restores valid empty, nonempty, and archived ledgers without hydration writes", async () => {
  const empty = fixtures.createGymFinanceDemoFixture("2030-06-03");
  const emptyHarness = await createHarness({ raw: storageModule.serializeGymFinanceDemoState(empty) });
  try {
    const cleanup = await hydrate(emptyHarness);
    assert.deepEqual(emptyHarness.published.state, empty);
    assert.equal(emptyHarness.published.state.payments.length, 0);
    assert.equal(emptyHarness.published.state.students.find((student) => student.id === "gym-fixed-student-muslib-archived").deletedAt, "2025-04-01T00:00:00.000Z");
    assert.deepEqual(emptyHarness.writes, []);
    cleanup();
  } finally { emptyHarness.restore(); }

  const sourceHarness = await createHarness();
  try {
    const cleanup = await hydrate(sourceHarness);
    await sourceHarness.published.paymentCallbacks.get(admin)(generalStudent, "100", "2030-07-03", paymentOptions);
    sourceHarness.render();
    const persisted = sourceHarness.memory.get(ownKey);
    const restoredHarness = await createHarness({ raw: persisted });
    try {
      const restoredCleanup = await hydrate(restoredHarness);
      assert.deepEqual(restoredHarness.published.state, sourceHarness.published.state);
      assert.deepEqual(restoredHarness.writes, []);
      restoredCleanup();
    } finally { restoredHarness.restore(); }
    cleanup();
  } finally { sourceHarness.restore(); }
});

test("GYM finance cleanup cancels pending work before invalidating its ledger bridge", async () => {
  const harness = await createHarness();
  try {
    const cleanup = await hydrate(harness);
    const pending = harness.published.paymentCallbacks.get(admin)(generalStudent, "100", "2030-07-03", paymentOptions);
    cleanup();
    assert.equal((await pending).success, false);
    assert.deepEqual(harness.writes, []);
    harness.render();
    assert.equal(harness.published.state.payments.length, 0);
  } finally { harness.restore(); }
});

test("GYM finance provider remains unmounted and has no BOX or persona persistence boundary", async () => {
  const provider = await source();
  assert.match(provider, /loadGymFinanceDemoState\(storage, createGymFinanceDemoFixture\(anchor\)\.anchor\)/);
  assert.match(provider, /cancelAllFactories[\s\S]*stateRef\.current = next[\s\S]*persistGymFinanceDemoState[\s\S]*setResetEpoch/);
  assert.match(provider, /readyRef\.current = true;[\s\S]*setPublishedFactories[\s\S]*setReady\(true\)/);
  assert.match(provider, /window\.clearTimeout\(timer\);[\s\S]*cancelAllFactories[\s\S]*aliveRef\.current = false/);
  assert.doesNotMatch(provider, /wody-box-|localStorage|selectedActor|ScenarioProviders/);
});
