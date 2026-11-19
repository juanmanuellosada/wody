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
    // Mirrors the real DemoGymProvider contract: trainingState IS trainingRef.current (read fresh, never
    // a cached mirror), and adoption only lands when `base` still matches it.
    getTrainingState: () => gym.trainingState,
    adoptTrainingState: (base, next) => {
      adoptCalls.push({ base, next });
      if (gym.trainingState !== base) return false;
      gym.trainingState = next;
      return true;
    },
  };
  // Delegates to the real coordinator by default, but a test can swap the implementation in flight (see
  // the stale-base test below) to deterministically inject a mutation into the narrow window between a
  // command reading its base and the coordinator actually running against it. Each harness gets its own
  // mutable slot, so this never leaks across tests or harnesses.
  let applyCommandImpl = coordinator.applyGymDemoProfileCommand;
  const coordinatorMock = {
    ...coordinator,
    applyGymDemoProfileCommand: (...args) => applyCommandImpl(...args),
  };
  const mocks = {
    react,
    "react/jsx-runtime": {
      jsx: (type, props) => { if (type === Context.Provider) published = props.value; return { type, props }; },
      jsxs: (type, props) => ({ type, props }),
    },
    "@/components/demo/scenarios/gym-demo-directory": directory,
    "./gym-demo-profile-coordinator": coordinatorMock,
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
    return effects.slice();
  };
  return {
    gym, adoptCalls, memory, reads, writes,
    render,
    runTimers: () => { for (const timer of timers) if (!timer.cancelled) timer.callback(); },
    setApplyCommandImpl: (fn) => { applyCommandImpl = fn; },
    get published() { return published; },
    restore: () => { globalThis.window = previousWindow; },
  };
}

async function hydrate(harness) {
  const effects = harness.render();
  assert.equal(harness.published.ready, false);
  assert.equal(harness.published.commandCallbacks, null);
  const cleanup = effects[0]();
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
    const cleanup = effects[0]();
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
    assert.equal(harness.adoptCalls[0].base, before, "the command's base is the pre-command reference, read fresh at invoke time");
    assert.notEqual(harness.adoptCalls[0].next, before, "adopted state is the pruned ledger, not the pre-command reference");
    assert.equal(harness.gym.trainingState.memberships.some((membership) => membership.studentId === personalizedStudent && membership.groupId === "gym-dated-group-strength"), false);
    assert.equal(harness.published.profileState.students.find((student) => student.id === personalizedStudent).studentType, "GENERAL");
    cleanup();
  } finally { harness.restore(); }
});

test("a command with no group-detach effect writes zero times to the training ledger and skips adoption entirely, since there is nothing to adopt", async () => {
  const harness = await createHarness();
  try {
    const cleanup = await hydrate(harness);
    const before = harness.gym.trainingState;
    const result = await harness.published.commandCallbacks.get(admin).editStudent(personalizedStudent, "Nuevo nombre");
    harness.render();
    assert.deepEqual(result, { success: true });
    assert.equal(writesTo(harness.writes, trainingKey).length, 0);
    assert.equal(writesTo(harness.writes, profileKey).length, 1, "only the stage write: no pending detach to acknowledge");
    assert.equal(harness.adoptCalls.length, 0, "adoptTrainingState is never called when the outcome carries no training change");
    assert.equal(harness.gym.trainingState, before, "the live training ledger is left untouched by reference");
    assert.equal(harness.published.warning, null, "no conflict warning when there was nothing to adopt");
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
    const cleanup = effects[0]();
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
    const firstCleanup = firstEffects[0]();
    firstCleanup();
    const secondEffects = harness.render();
    secondEffects[0]();
    harness.runTimers();
    harness.render();
    assert.deepEqual(harness.reads, [profileKey, profileKey]);
    assert.equal(harness.writes.length, 0);
    assert.equal(harness.published.ready, true);
  } finally { harness.restore(); }
});

test("adoptTrainingState refuses a stale-based write when a newer GYM training mutation lands after the command captured its base: the persisted training ledger diverges from live memory, and the warning says the persisted ledger is stale", async () => {
  const harness = await createHarness();
  try {
    const cleanup = await hydrate(harness);
    const capturedBase = harness.gym.getTrainingState();
    assert.ok(capturedBase.memberships.some((membership) => membership.studentId === personalizedStudent && membership.groupId === "gym-dated-group-strength"));
    // Stands in for a real concurrent GYM training mutation (e.g. a teacher's group edit) that
    // DemoGymProvider commits to its live trainingRef with no render in between: a membership for a
    // DIFFERENT student than this command targets, so losing it would be silent and easy to miss.
    const concurrentlyAdvanced = {
      ...capturedBase,
      memberships: [...capturedBase.memberships, { studentId: admin, groupId: "gym-dated-group-strength" }],
    };
    // Fires exactly when the coordinator is invoked -- i.e. exactly after this command already read its
    // base fresh (defeating any harness-artifact masking) -- to deterministically land the concurrent
    // mutation inside the real window the fix must close, instead of relying on an unreliable race.
    harness.setApplyCommandImpl((io, journal, trainingState, commandValue) => {
      harness.gym.trainingState = concurrentlyAdvanced;
      return coordinator.applyGymDemoProfileCommand(io, journal, trainingState, commandValue);
    });

    // SET_TYPE to GENERAL performs a real group-detach training-ledger write, unlike editStudent (which
    // performs none): only a command that actually writes the training ledger can exercise the
    // storage/memory divergence this warning describes, so it -- never a no-op command -- must be used.
    const result = await harness.published.commandCallbacks.get(admin).setType(personalizedStudent, "GENERAL");
    harness.render();

    assert.deepEqual(result, { success: true }, "the profile/journal write itself still succeeds");
    assert.equal(writesTo(harness.writes, trainingKey).length, 1, "exactly one training-ledger write, computed from the stale base");
    assert.equal(harness.adoptCalls.length, 1);
    assert.equal(harness.adoptCalls[0].base, capturedBase, "the base was read fresh at invoke time, not from a stale post-render mirror");
    assert.notEqual(harness.adoptCalls[0].next, capturedBase, "the coordinator computed a real pruned training write from the (stale) base");
    assert.equal(harness.gym.trainingState, concurrentlyAdvanced, "the concurrently-landed training mutation is NOT overwritten in memory by the refused adoption");
    assert.match(harness.published.warning, /turnos/);
    assert.match(harness.published.warning, /desactualiz/i, "the warning must describe the PERSISTED training ledger as stale");
    assert.doesNotMatch(harness.published.warning, /en memoria no se modificó/i, "must not claim the in-memory sheet was simply left untouched: the durable ledger actually diverged from it");
    assert.equal(harness.published.profileState.students.find((student) => student.id === personalizedStudent).studentType, "GENERAL", "the independent profile-journal change still committed");

    // Prove the divergence at the storage layer, not just describe it: the persisted training ledger was
    // computed from the stale `capturedBase`, so it reflects this command's own detach but never saw the
    // concurrent admin membership, which only ever landed in live memory. A reload would restore this
    // stale-based ledger from storage and silently lose that concurrent mutation.
    const persistedTraining = JSON.parse(harness.memory.get(trainingKey));
    assert.equal(
      persistedTraining.memberships.some((membership) => membership.studentId === admin && membership.groupId === "gym-dated-group-strength"),
      false,
      "the concurrent mutation never reached the persisted training ledger",
    );
    assert.equal(
      persistedTraining.memberships.some((membership) => membership.studentId === personalizedStudent && membership.groupId === "gym-dated-group-strength"),
      false,
      "this command's own detach IS reflected in the persisted training ledger",
    );
    assert.equal(
      harness.gym.trainingState.memberships.some((membership) => membership.studentId === admin && membership.groupId === "gym-dated-group-strength"),
      true,
      "live memory still holds the concurrent mutation that the persisted ledger lost",
    );

    cleanup();
  } finally { harness.restore(); }
});

test("invoke refuses to run once the provider is no longer alive/ready, before touching the coordinator or any state: a callback a consumer kept after cleanup produces zero writes, zero adoption and no state change", async () => {
  const harness = await createHarness();
  try {
    const cleanup = await hydrate(harness);
    const retainedCallbacks = harness.published.commandCallbacks.get(admin);
    const before = harness.published.profileState;

    cleanup(); // unmount: aliveRef/readyRef go false and storageRef is cleared

    const result = await retainedCallbacks.editStudent(personalizedStudent, "Nunca debería aplicarse");
    harness.render();

    assert.equal(result.success, false);
    assert.deepEqual(harness.writes, [], "no coordinator call, so zero writes");
    assert.equal(harness.adoptCalls.length, 0, "no adoption attempted");
    assert.deepEqual(harness.published.profileState, before, "no state change");
  } finally { harness.restore(); }
});

test("invoke re-checks isUsable() inside the queued microtask, not only at synchronous call time: cleanup landing after the call but before that microtask drains still produces zero writes, zero adoption and no state change", async () => {
  const harness = await createHarness();
  try {
    const cleanup = await hydrate(harness);
    const before = harness.published.profileState;
    const callbacks = harness.published.commandCallbacks.get(admin);

    // isUsable() is true at this exact synchronous instant, so the call is accepted and its
    // `Promise.resolve().then(...)` microtask gets queued.
    const pending = callbacks.editStudent(personalizedStudent, "Nunca debería aplicarse");
    // Cleanup (unmount) runs synchronously right after, in the same tick, strictly before that queued
    // microtask has any chance to drain: this is the exact gap the isUsable() re-check inside the
    // then-callback must close, not merely the generation bump that cleanup's cancelPending() also does.
    cleanup();

    const result = await pending;
    harness.render();

    assert.equal(result.success, false);
    assert.deepEqual(harness.writes, [], "the microtask never reached storage or the coordinator");
    assert.equal(harness.adoptCalls.length, 0, "no adoption attempted");
    assert.deepEqual(harness.published.profileState, before, "no state change");
  } finally { harness.restore(); }
});

test("two calls sharing the same invocation key while one is pending return the identical promise, and storage is written only once", async () => {
  const harness = await createHarness();
  try {
    const cleanup = await hydrate(harness);
    const callbacks = harness.published.commandCallbacks.get(admin);
    const first = callbacks.editStudent(personalizedStudent, "Mismo valor");
    const second = callbacks.editStudent(personalizedStudent, "Mismo valor"); // same key: dedupe, not busy-reject

    assert.equal(second, first, "the second call returns the exact same pending promise, not a new one");
    const [firstResult, secondResult] = await Promise.all([first, second]);
    assert.deepEqual(firstResult, { success: true });
    assert.deepEqual(secondResult, { success: true });
    harness.render();
    assert.equal(writesTo(harness.writes, profileKey).length, 1, "the deduped call never re-ran the coordinator, so storage was written only once");
    cleanup();
  } finally { harness.restore(); }
});

test("GYM profile provider stays scoped to its own domain: no BOX, Personal, or finance namespace, and no second reconcile loop", async () => {
  const provider = await source();
  assert.doesNotMatch(provider, /wody-box-|wody-personal-|wody-gym-finance-|finance\/|localStorage/);
  assert.doesNotMatch(provider, /reconcileGymDemoProfilePendingGroupDetaches/, "the coordinator already reconciles; this provider must not run a second loop");
  assert.match(provider, /adoptTrainingState\(base, outcome\.trainingState\)/);
  assert.match(provider, /trainingStorage: storageRef\.current/);
  assert.match(provider, /if \(!value\) throw new Error/);
});
