import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import * as directory from "../scenarios/gym-demo-directory.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import * as coordinator from "./gym-demo-profile-coordinator.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import * as core from "./gym-demo-profile-core.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import * as journalModule from "./gym-demo-profile-journal.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import * as storageModule from "./gym-demo-profile-storage.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createGymTrainingDemoFixture } from "../training/gym-training-demo-fixtures.ts";

const root = new URL("../../../../", import.meta.url);
const source = () => readFile(new URL("src/components/demo/gym/DemoGymProfileProvider.tsx", root), "utf8");
const profileKey = "wody-gym-profiles-demo-v1";
const trainingKey = "wody-gym-training-demo-v1";
const admin = directory.GYM_DEMO_ADMIN_ID;
const primaryTeacher = directory.GYM_DEMO_PRIMARY_TEACHER_ID;
const secondaryTeacher = directory.GYM_DEMO_SECONDARY_TEACHER_ID;
const personalizedStudent = directory.GYM_DEMO_PERSONALIZED_STUDENT_ID;

async function createHarness({ raw = null, getItem, setItem, gymReady = true } = {}) {
  const compiled = ts.transpileModule(await source(), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const states = [];
  const refs = [];
  let effects = [];
  let hook = 0;
  let published = null;
  const timers = [];
  const reads = [];
  const writes = [];
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
  const memory = new Map([[profileKey, raw], ["unrelated-key", "preserved"]]);
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
  const adoptCalls = [];
  const gym = {
    ready: gymReady,
    trainingState: createGymTrainingDemoFixture(),
    adoptTrainingState: (next) => { adoptCalls.push(next); gym.trainingState = next; },
  };
  const mocks = {
    react,
    "react/jsx-runtime": {
      jsx: (type, props) => { if (type === Context.Provider) published = props.value; return { type, props }; },
      jsxs: (type, props) => ({ type, props }),
    },
    "@/components/demo/scenarios/gym-demo-directory": directory,
    "./gym-demo-profile-coordinator": coordinator,
    "./gym-demo-profile-core": core,
    "./gym-demo-profile-journal": journalModule,
    "./gym-demo-profile-storage": storageModule,
    "./DemoGymProvider": { useDemoGym: () => gym },
  };
  const commonjsModule = { exports: {} };
  const require = (specifier) => { if (!(specifier in mocks)) throw new Error(`Unexpected module: ${specifier}`); return mocks[specifier]; };
  new Function("require", "exports", "module", compiled)(require, commonjsModule.exports, commonjsModule);
  const render = () => {
    hook = 0;
    effects = [];
    commonjsModule.exports.DemoGymProfileProvider({ children: "demo" });
    const captured = effects.slice();
    captured[0](); // training-state mirror sync: idempotent, safe to run every render
    return captured;
  };
  return {
    gym, adoptCalls, memory, reads, writes,
    render,
    runTimers: () => { for (const timer of timers) if (!timer.cancelled) timer.callback(); },
    get published() { return published; },
    restore: () => { globalThis.window = previousWindow; },
  };
}

async function hydrate(harness) {
  const effects = harness.render();
  assert.equal(harness.published.ready, false);
  assert.equal(harness.published.commandCallbacks, null);
  const cleanup = effects[1]();
  harness.runTimers();
  harness.render();
  assert.equal(harness.published.ready, true);
  return cleanup;
}

function writesTo(writes, key) {
  return writes.filter(([writtenKey]) => writtenKey === key);
}

function assertRuntimeImmutableLookup(lookup, expectedKeys, injectedKey = personalizedStudent) {
  assert.equal(typeof lookup.set, "undefined");
  assert.equal(typeof lookup.delete, "undefined");
  assert.equal(typeof lookup.clear, "undefined");
  assert.equal(Object.getPrototypeOf(lookup), null);
  const firstKey = expectedKeys[0];
  const firstValue = lookup.get(firstKey);
  assert.throws(() => Map.prototype.set.call(lookup, injectedKey, firstValue));
  assert.throws(() => Map.prototype.delete.call(lookup, firstKey));
  assert.throws(() => Object.setPrototypeOf(lookup, Map.prototype));
  assert.deepEqual([...lookup.keys()], expectedKeys);
  assert.equal(lookup.get(firstKey), firstValue);
}

test("GYM profile provider reads only its own key and publishes staff factories once both it and the GYM ledger are ready", async () => {
  const harness = await createHarness();
  try {
    const cleanup = await hydrate(harness);
    assert.deepEqual(harness.reads, [profileKey]);
    assert.deepEqual(harness.writes, []);
    assert.deepEqual([...harness.published.commandCallbacks.keys()], [admin, primaryTeacher, secondaryTeacher]);
    assertRuntimeImmutableLookup(harness.published.commandCallbacks, [admin, primaryTeacher, secondaryTeacher]);
    cleanup();
  } finally { harness.restore(); }
});

test("commandCallbacks stays null while the GYM training ledger has not hydrated, even after the profile journal is ready", async () => {
  const harness = await createHarness({ gymReady: false });
  try {
    const effects = harness.render();
    const cleanup = effects[1]();
    harness.runTimers();
    harness.render();
    assert.equal(harness.published.ready, false, "own journal is hydrated but the parent GYM ledger is not");
    assert.equal(harness.published.commandCallbacks, null);
    harness.gym.ready = true;
    harness.render();
    assert.equal(harness.published.ready, true);
    assert.notEqual(harness.published.commandCallbacks, null);
    cleanup();
  } finally { harness.restore(); }
});

test("a GENERAL command writes the training ledger exactly once, via adoptTrainingState only (never a second persist by this provider)", async () => {
  const providerSource = await source();
  assert.doesNotMatch(providerSource, /persistGymTrainingDemoState/, "only the coordinator may persist the training ledger");
  const harness = await createHarness();
  try {
    const cleanup = await hydrate(harness);
    const before = harness.gym.trainingState;
    assert.ok(before.memberships.some((membership) => membership.studentId === personalizedStudent && membership.groupId === "gym-dated-group-strength"));

    const result = await harness.published.commandCallbacks.get(admin).setType(personalizedStudent, "GENERAL");
    harness.render();

    assert.deepEqual(result, { success: true });
    assert.equal(writesTo(harness.writes, trainingKey).length, 1, "exactly one training-ledger write for this command");
    assert.equal(writesTo(harness.writes, profileKey).length, 2, "journal is persisted at stage, then again at acknowledge");
    assert.equal(harness.adoptCalls.length, 1, "the coordinator's result is adopted in-memory exactly once");
    assert.notEqual(harness.adoptCalls[0], before, "adopted state is the pruned ledger, not the pre-command reference");
    assert.equal(harness.gym.trainingState.memberships.some((membership) => membership.studentId === personalizedStudent && membership.groupId === "gym-dated-group-strength"), false);
    assert.equal(harness.published.profileState.students.find((student) => student.id === personalizedStudent).studentType, "GENERAL");
    cleanup();
  } finally { harness.restore(); }
});

test("a command with no group-detach effect writes zero times to the training ledger and still adopts the unchanged reference", async () => {
  const harness = await createHarness();
  try {
    const cleanup = await hydrate(harness);
    const before = harness.gym.trainingState;
    const result = await harness.published.commandCallbacks.get(admin).editStudent(personalizedStudent, "Nuevo nombre");
    harness.render();
    assert.deepEqual(result, { success: true });
    assert.equal(writesTo(harness.writes, trainingKey).length, 0);
    assert.equal(writesTo(harness.writes, profileKey).length, 1, "only the stage write: no pending detach to acknowledge");
    assert.equal(harness.adoptCalls.length, 1);
    assert.equal(harness.adoptCalls[0], before, "an unchanged training ledger is adopted by the same reference");
    assert.equal(harness.published.profileState.students.find((student) => student.id === personalizedStudent).name, "Nuevo nombre");
    cleanup();
  } finally { harness.restore(); }
});

test("an unauthorized or invalid command returns a rejection, changes no state, and writes nothing", async () => {
  const harness = await createHarness();
  try {
    const cleanup = await hydrate(harness);
    const before = harness.published.profileState;
    // SET_BLOCKED is ADMIN-only; a teacher actor must be reduced-core-rejected, not silently allowed.
    const result = await harness.published.commandCallbacks.get(primaryTeacher).setBlocked(personalizedStudent, true);
    harness.render();
    assert.equal(result.success, false);
    assert.equal(harness.writes.length, 0);
    assert.equal(harness.adoptCalls.length, 0);
    assert.deepEqual(harness.published.profileState, before, "a rejected command leaves the projected profile state unchanged");
    cleanup();
  } finally { harness.restore(); }
});

test("GYM profile provider serializes commands per actor: a second call while one is pending is busy-rejected, and cancelPending cancels the queued one", async () => {
  const harness = await createHarness();
  try {
    const cleanup = await hydrate(harness);
    const callbacks = harness.published.commandCallbacks.get(admin);
    const first = callbacks.editStudent(personalizedStudent, "Primero");
    const second = callbacks.editStudent(admin, "Otro"); // distinct target: still busy-rejected, not merged
    assert.equal((await second).success, false);
    assert.match((await second).error, /otra operación/);
    assert.equal((await first).success, true);
    harness.render();

    const pending = callbacks.editStudent(personalizedStudent, "Cancelado");
    callbacks.cancelPending();
    const cancelled = await pending;
    assert.equal(cancelled.success, false);
    assert.match(cancelled.error, /cancelada/);
    harness.render();
    assert.equal(harness.published.profileState.students.find((student) => student.id === personalizedStudent).name, "Primero", "the cancelled command never committed");
    cleanup();
  } finally { harness.restore(); }
});

test("GYM profile reset cancels pending factories, re-persists the fresh fixture, touches only its own key, and preserves factory reservations", async () => {
  const harness = await createHarness();
  try {
    const cleanup = await hydrate(harness);
    await harness.published.commandCallbacks.get(admin).editStudent(personalizedStudent, "Editado");
    harness.render();
    const before = harness.published;
    const pending = harness.published.commandCallbacks.get(primaryTeacher).editStudent(personalizedStudent, "Nunca");

    harness.published.reset();
    harness.render();

    assert.equal(harness.published.resetEpoch, 1);
    const canonicalName = directory.getGymDemoProfile(personalizedStudent).name;
    assert.equal(harness.published.profileState.students.find((student) => student.id === personalizedStudent).name, canonicalName, "reset restores the fresh canonical fixture");
    assert.equal(harness.published.commandCallbacks.get(admin), before.commandCallbacks.get(admin), "factory reservations survive reset");
    assert.equal((await pending).success, false, "the command queued before reset never commits");
    assert.equal(writesTo(harness.writes, trainingKey).length, 0, "reset never touches the training ledger");
    assert.ok(writesTo(harness.writes, profileKey).length >= 2, "reset persists the fresh fixture under its own key");
    assert.equal(harness.memory.get("unrelated-key"), "preserved");
    cleanup();
  } finally { harness.restore(); }
});

test("GYM profile hydration is read-only across corrupt and unavailable storage, and warns without writing", async () => {
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
    const cleanup = effects[1]();
    unavailable.runTimers();
    unavailable.render();
    assert.equal(unavailable.published.ready, true);
    assert.match(unavailable.published.warning, /No se pudo leer/);
    assert.deepEqual(unavailable.writes, []);
    cleanup();
  } finally { unavailable.restore(); }
});

test("controlled provider effects restart after pre-hydration cleanup without writes", async () => {
  const harness = await createHarness();
  try {
    const firstEffects = harness.render();
    const firstCleanup = firstEffects[1]();
    firstCleanup();
    const secondEffects = harness.render();
    secondEffects[1]();
    harness.runTimers();
    harness.render();
    assert.deepEqual(harness.reads, [profileKey, profileKey]);
    assert.equal(harness.writes.length, 0);
    assert.equal(harness.published.ready, true);
  } finally { harness.restore(); }
});

test("GYM profile provider stays scoped to its own domain: no BOX, Personal, or finance namespace, and no second reconcile loop", async () => {
  const provider = await source();
  assert.doesNotMatch(provider, /wody-box-|wody-personal-|wody-gym-finance-|finance\/|localStorage/);
  assert.doesNotMatch(provider, /reconcileGymDemoProfilePendingGroupDetaches/, "the coordinator already reconciles; this provider must not run a second loop");
  assert.match(provider, /adoptTrainingState\(outcome\.trainingState\)/);
  assert.match(provider, /trainingStorage: storageRef\.current/);
  assert.match(provider, /if \(!value\) throw new Error/);
});
