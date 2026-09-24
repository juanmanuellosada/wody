import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import * as rmAdapters from "../training/demo-rm-adapters.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import * as rmCore from "../training/demo-rm-core.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import * as rmStorage from "../training/demo-rm-storage.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import * as fixedAdapters from "../training/gym-fixed-demo-adapters.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import * as fixedState from "../training/gym-fixed-demo-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import * as fixedFixtures from "../training/gym-fixed-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import * as fixedStorage from "../training/gym-fixed-demo-storage.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import * as trainingAdapters from "../training/gym-training-demo-adapters.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import * as trainingState from "../training/gym-training-demo-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import * as trainingFixtures from "../training/gym-training-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import * as trainingStorage from "../training/gym-training-demo-storage.ts";
import * as directory from "../scenarios/gym-demo-directory.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import * as gymViewModel from "./gym-demo-view-model.ts";
import { defaultGymFixedRenewAt, mapGymFixedStudentRoutine, mapGymRms, mapGymWods, utcDateFromKey } from "./gym-demo-view-model.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createGymTrainingDemoFixture } from "../training/gym-training-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { projectGymTrainingViews } from "../training/gym-training-demo-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { GYM_DEMO_GENERAL_STUDENT_ID, GYM_DEMO_MUSLIB_STUDENT_ID, GYM_DEMO_PERSONALIZED_STUDENT_ID, GYM_DEMO_UNLINKED_PERSONALIZED_STUDENT_ID, getGymDemoActorToken } from "../scenarios/gym-demo-directory.ts";

const root = new URL("../../../../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("GYM view-model maps detached UTC DTOs and rejects malformed dates, fixed routines, and PRs", () => {
  const day = utcDateFromKey("0024-02-29");
  assert.equal(day.success, true);
  if (day.success) assert.equal(day.value.toISOString(), "0024-02-29T00:00:00.000Z");
  for (const value of ["", "2025-02-29", "2025-5-01", "2025-01-01T00:00:00.000Z"]) {
    const invalid = utcDateFromKey(value);
    assert.deepEqual(invalid, { success: false, code: "INVALID_UTC_DATE", error: "La fecha de demostración no es válida." });
  }

  const wods = mapGymWods([{
    id: "dated-1", title: "Trabajo", content: "Series", date: "2025-05-01", teacherId: "teacher-1",
    targetType: "GROUP", targetGroupId: "group-1", targetStudentId: null, targetGroupName: "Fuerza", targetStudentName: null,
  }]);
  assert.equal(wods.success, true);
  if (wods.success) {
    assert.equal(wods.value[0].date.toISOString(), "2025-05-01T00:00:00.000Z");
    assert.equal(wods.value[0].targetGroupId, "group-1");
  }

  assert.deepEqual(mapGymFixedStudentRoutine(null), { success: true, value: null });
  const sourceRoutine = { id: "fixed-1", title: "Fuerza", content: "Press", assignedAt: new Date("2025-05-01T00:00:00.000Z"), renewAt: new Date("2025-06-01T00:00:00.000Z"), teacherName: "Tomás" };
  const routine = mapGymFixedStudentRoutine(sourceRoutine);
  assert.equal(routine.success, true);
  if (routine.success && routine.value) {
    assert.notEqual(routine.value.renewAt, sourceRoutine.renewAt);
    assert.deepEqual(routine.value.teacher, { name: "Tomás" });
  }
  const invalidRoutine = mapGymFixedStudentRoutine({ ...sourceRoutine, renewAt: new Date("invalid") });
  assert.equal(invalidRoutine.success, false);
  if (!invalidRoutine.success) assert.equal(invalidRoutine.code, "INVALID_FIXED_ROUTINE");

  const sourceRm = { id: "rm-1", exercise: "Peso muerto", weight: 100, date: new Date("2025-05-01T00:00:00.000Z"), createdAt: new Date("2025-05-01T00:00:00.000Z") };
  const rms = mapGymRms([sourceRm]);
  assert.equal(rms.success, true);
  if (rms.success) {
    assert.notEqual(rms.value[0].date, sourceRm.date);
    assert.notEqual(rms.value[0].createdAt, sourceRm.createdAt);
  }
  assert.equal(defaultGymFixedRenewAt("2026-09-30"), "2026-10-30");
  assert.equal(defaultGymFixedRenewAt("2026-10-01"), "2026-10-31");
  assert.equal(defaultGymFixedRenewAt("2024-01-31"), "2024-03-01");

  const invalidRm = mapGymRms([{ ...sourceRm, weight: 0 }]);
  assert.equal(invalidRm.success, false);
  if (!invalidRm.success) assert.equal(invalidRm.code, "INVALID_RM");
});

test("GYM students project training without staff-only fixed assignment or renewal projectors", () => {
  const state = createGymTrainingDemoFixture();
  for (const actorId of [GYM_DEMO_GENERAL_STUDENT_ID, GYM_DEMO_PERSONALIZED_STUDENT_ID, GYM_DEMO_UNLINKED_PERSONALIZED_STUDENT_ID, GYM_DEMO_MUSLIB_STUDENT_ID]) {
    const projection = projectGymTrainingViews(state, getGymDemoActorToken(actorId));
    assert.equal(projection.success, true, actorId);
    if (projection.success) assert.equal(mapGymWods(projection.student.wods).success, true, actorId);
  }
});

test("controlled route rejects malformed MUSLIB fixed state without hiding it as an empty routine", async () => {
  const compiled = ts.transpileModule(await source("src/components/demo/gym/DemoGymTrainingRoute.tsx"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const FixedRoutineStudentView = (props) => ({ leaf: "fixed", props });
  const WodCard = (props) => ({ leaf: "wod", props });
  const WodHistory = (props) => ({ leaf: "history", props });
  let gym;
  const jsx = (type, props) => typeof type === "function" ? type(props ?? {}) : { type, props: props ?? {} };
  const mocks = {
    react: { useEffect: () => {}, useRef: (value) => ({ current: value }), useState: (value) => [value, () => {}], useMemo: (factory) => factory() },
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: Symbol.for("fragment") },
    "@/components/RmsView": { RmsView: () => null },
    "@/components/fixed-routine/FixedRoutineManagerView": { FixedRoutineManagerView: () => null },
    "@/components/fixed-routine/FixedRoutineStudentView": { FixedRoutineStudentView },
    "@/components/group/GroupManagerView": { GroupManagerView: () => null },
    "@/components/wod/ShareWodButton": { ShareWodButton: () => null },
    "@/components/wod/StudentWodDetailView": { StudentWodDetailView: () => null },
    "@/components/wod/WodCard": { WodCard },
    "@/components/wod/WodHistory": { WodHistory },
    "@/components/wod/WodManagerView": { WodManagerView: () => null },
    "@/lib/gym-terms": { gymTerms: () => ({ wod: "Rutina", wods: "Rutinas" }) },
    "./gym-demo-view-model": gymViewModel,
    "@/components/demo/training/gym-fixed-demo-state": fixedState,
    "@/components/demo/training/gym-training-demo-state": trainingState,
    "@/components/demo/scenarios/gym-demo-directory": directory,
    "./DemoGymProvider": { defaultActorId: () => directory.GYM_DEMO_ADMIN_ID, useDemoGym: () => gym },
    "./DemoGymProfileProvider": { useDemoGymProfile: () => ({ profileState: { students: [] } }) },
  };
  const commonjsModule = { exports: {} };
  const require = (specifier) => { if (!(specifier in mocks)) throw new Error(`Unexpected module: ${specifier}`); return mocks[specifier]; };
  new Function("require", "exports", "module", compiled)(require, commonjsModule.exports, commonjsModule);
  const base = {
    ready: true, warning: null, trainingState: trainingFixtures.createGymTrainingDemoFixture(), rmsState: rmCore.createDemoRmCore({ kind: "GYM", ownerIds: [] }).emptyState(),
    actorsForRole: () => [], selectActor: () => {}, trainingCallbacks: null, fixedCallbacks: null, rmCallbacks: null,
    rmProjection: { success: true, rms: [] }, resetDatedTraining: () => {}, resetFixedRoutines: () => {}, resetRms: () => {}, datedEpoch: 0, fixedEpoch: 0, rmEpoch: 0, today: "2026-09-30",
  };
  const renderStudent = (actorId, fixedDemoState) => {
    gym = { ...base, selectedActor: directory.getGymDemoProfile(actorId), fixedState: fixedDemoState };
    return commonjsModule.exports.SharedDemoGymTrainingRoute({ routeKey: "test", routeRole: "STUDENT", routeActorId: actorId, screen: "student" });
  };
  const findNode = (root, predicate) => {
    const stack = [root];
    while (stack.length) {
      const node = stack.pop();
      if (!node || typeof node !== "object") continue;
      if (predicate(node)) return node;
      const children = node.props?.children;
      if (Array.isArray(children)) stack.push(...children);
      else stack.push(children);
    }
    return null;
  };
  let toJsonCalls = 0;
  const getterState = { ...fixedFixtures.createGymFixedDemoFixture() };
  Object.defineProperty(getterState, "namespace", { enumerable: true, get: () => "gym-fixed-demo" });
  const volatileNested = { ...fixedFixtures.createGymFixedDemoFixture(), fixedRoutines: new Proxy([], { ownKeys: () => { throw new Error("volatile"); } }) };
  const toJsonState = { ...fixedFixtures.createGymFixedDemoFixture(), toJSON: () => { toJsonCalls += 1; return fixedFixtures.createGymFixedDemoFixture(); } };
  for (const invalidState of [{}, { ...fixedFixtures.createGymFixedDemoFixture(), namespace: "wrong" }, { ...fixedFixtures.createGymFixedDemoFixture(), fixedRoutines: [{}] }, getterState, volatileNested, toJsonState]) {
    const result = renderStudent(GYM_DEMO_MUSLIB_STUDENT_ID, invalidState);
    assert.equal(result.type, "main");
    assert.ok(findNode(result, (node) => node.type === "p" && node.props.role === "alert"));
    assert.equal(findNode(result, (node) => node.leaf === "fixed"), null);
  }
  assert.equal(toJsonCalls, 0);
  const changingMarker = (target) => {
    let ownKeysCalls = 0;
    return new Proxy(target, {
      ownKeys(value) {
        ownKeysCalls += 1;
        return ownKeysCalls === 1 ? Reflect.ownKeys(value) : [...Reflect.ownKeys(value), "invalidMarker"];
      },
      getOwnPropertyDescriptor(value, key) {
        return key === "invalidMarker"
          ? { value: true, enumerable: true, configurable: true, writable: true }
          : Reflect.getOwnPropertyDescriptor(value, key);
      },
    });
  };
  for (const invalidState of [
    changingMarker(fixedFixtures.createGymFixedDemoFixture()),
    { ...fixedFixtures.createGymFixedDemoFixture(), fixedRoutines: changingMarker(fixedFixtures.createGymFixedDemoFixture().fixedRoutines) },
  ]) {
    const result = renderStudent(GYM_DEMO_MUSLIB_STUDENT_ID, invalidState);
    assert.ok(findNode(result, (node) => node.type === "p" && node.props.role === "alert"));
    assert.equal(findNode(result, (node) => node.leaf === "fixed"), null);
  }
  const fixture = fixedFixtures.createGymFixedDemoFixture();
  let ownKeysCalls = 0;
  const statefulFixture = new Proxy(fixture, {
    ownKeys(target) {
      ownKeysCalls += 1;
      if (ownKeysCalls >= 3) throw new Error("origin became volatile");
      return Reflect.ownKeys(target);
    },
  });
  const detachedRoutine = renderStudent(GYM_DEMO_MUSLIB_STUDENT_ID, statefulFixture);
  assert.equal(findNode(detachedRoutine, (node) => node.leaf === "fixed")?.props.activeRoutine.id, "gym-fixed-active");
  assert.ok(ownKeysCalls < 3);
  let poisonReads = 0;
  const poison = new Proxy({}, { ownKeys: () => { poisonReads += 1; throw new Error("must not inspect"); } });
  assert.equal(gymViewModel.projectGymFixedStudentRoutineSafe(poison, {}).success, false);
  assert.equal(poisonReads, 0);
  const empty = renderStudent(GYM_DEMO_MUSLIB_STUDENT_ID, { ...fixedFixtures.createGymFixedDemoFixture(), fixedRoutines: [] });
  const emptyFixed = findNode(empty, (node) => node.leaf === "fixed");
  assert.equal(emptyFixed?.props.activeRoutine, null);
  const routine = renderStudent(GYM_DEMO_MUSLIB_STUDENT_ID, fixedFixtures.createGymFixedDemoFixture());
  assert.equal(findNode(routine, (node) => node.leaf === "fixed")?.props.activeRoutine.id, "gym-fixed-active");
  for (const actorId of [GYM_DEMO_GENERAL_STUDENT_ID, GYM_DEMO_PERSONALIZED_STUDENT_ID]) {
    const result = renderStudent(actorId, {});
    assert.equal(result.type, "main");
    assert.equal(findNode(result, (node) => node.type === "p" && node.props.role === "alert"), null);
  }
});

test("controlled route threads the profile bridge's name overrides into all three training projections, and a partial map blanks nobody", async () => {
  const compiled = ts.transpileModule(await source("src/components/demo/gym/DemoGymTrainingRoute.tsx"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  let groupManagerProps = null;
  let fixedRoutineManagerProps = null;
  const GroupManagerView = (props) => { groupManagerProps = props; return null; };
  const FixedRoutineManagerView = (props) => { fixedRoutineManagerProps = props; return null; };
  const jsx = (type, props) => typeof type === "function" ? type(props ?? {}) : { type, props: props ?? {} };
  // Only gym-fixed-student-muslib is overridden. gym-fixed-student-muslib-lite (also visible at both the
  // training-groups and fixed-assignment call sites below) is deliberately absent from the map: it proves a
  // partial map falls back to the canonical name instead of blanking a student nobody edited.
  const editedName = "Micaela Editada";
  const teacherId = directory.GYM_DEMO_PRIMARY_TEACHER_ID;
  const gym = {
    ready: true, warning: null,
    trainingState: trainingFixtures.createGymTrainingDemoFixture(),
    fixedState: fixedFixtures.createGymFixedDemoFixture(),
    rmsState: rmCore.createDemoRmCore({ kind: "GYM", ownerIds: [] }).emptyState(),
    selectedActor: directory.getGymDemoProfile(teacherId),
    actorsForRole: () => [], selectActor: () => {},
    trainingCallbacks: {}, fixedCallbacks: {}, rmCallbacks: null,
    rmProjection: { success: true, rms: [] },
    resetDatedTraining: () => {}, resetFixedRoutines: () => {}, resetRms: () => {},
    datedEpoch: 0, fixedEpoch: 0, rmEpoch: 0,
    // Within 7 days of gym-fixed-active's 2025-05-30 renewAt, and not overdue: matches the pure-module fixture test.
    today: "2025-05-25",
  };
  const mocks = {
    react: { useEffect: () => {}, useRef: (value) => ({ current: value }), useState: (value) => [value, () => {}], useMemo: (factory) => factory() },
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: Symbol.for("fragment") },
    "@/components/RmsView": { RmsView: () => null },
    "@/components/fixed-routine/FixedRoutineManagerView": { FixedRoutineManagerView },
    "@/components/fixed-routine/FixedRoutineStudentView": { FixedRoutineStudentView: () => null },
    "@/components/group/GroupManagerView": { GroupManagerView },
    "@/components/wod/ShareWodButton": { ShareWodButton: () => null },
    "@/components/wod/StudentWodDetailView": { StudentWodDetailView: () => null },
    "@/components/wod/WodCard": { WodCard: () => null },
    "@/components/wod/WodHistory": { WodHistory: () => null },
    "@/components/wod/WodManagerView": { WodManagerView: () => null },
    "@/lib/gym-terms": { gymTerms: () => ({ wod: "Rutina", wods: "Rutinas" }) },
    "./gym-demo-view-model": gymViewModel,
    // Real, unmocked pure projections: this exercises the actual nameOverrides wiring end to end, not a stand-in.
    "@/components/demo/training/gym-fixed-demo-state": fixedState,
    "@/components/demo/training/gym-training-demo-state": trainingState,
    "@/components/demo/scenarios/gym-demo-directory": directory,
    "./DemoGymProvider": { defaultActorId: () => teacherId, useDemoGym: () => gym },
    "./DemoGymProfileProvider": {
      useDemoGymProfile: () => ({ profileState: { students: [{ id: directory.GYM_DEMO_MUSLIB_STUDENT_ID, name: editedName }] } }),
    },
  };
  const commonjsModule = { exports: {} };
  const require = (specifier) => { if (!(specifier in mocks)) throw new Error(`Unexpected module: ${specifier}`); return mocks[specifier]; };
  new Function("require", "exports", "module", compiled)(require, commonjsModule.exports, commonjsModule);
  commonjsModule.exports.SharedDemoGymTrainingRoute({ routeKey: "profile-bridge-test", routeRole: "TEACHER", routeActorId: teacherId, screen: "staff" });

  // Call site 1: projectGymTrainingViews -> GroupManagerView's group roster (gym-dated-group-strength has
  // both students as members). Would still pass with an empty/unused override map, a map keyed by the wrong
  // field, or a dropped fourth argument: every assertion below would fail in exactly that case.
  assert.ok(groupManagerProps, "GroupManagerView was never rendered");
  const group = groupManagerProps.groups.find((candidate) => candidate.id === "gym-dated-group-strength");
  assert.equal(group?.students.find((student) => student.id === directory.GYM_DEMO_MUSLIB_STUDENT_ID)?.name, editedName);
  assert.equal(group?.students.find((student) => student.id === directory.GYM_DEMO_HISTORICAL_MUSLIB_LITE_STUDENT_ID)?.name, "León Acosta");

  // Call site 2: projectGymFixedAssignmentContext -> FixedRoutineManagerView's muslibStudents picker.
  assert.ok(fixedRoutineManagerProps, "FixedRoutineManagerView was never rendered");
  const muslib = fixedRoutineManagerProps.muslibStudents.find((student) => student.id === directory.GYM_DEMO_MUSLIB_STUDENT_ID);
  const muslibLite = fixedRoutineManagerProps.muslibStudents.find((student) => student.id === directory.GYM_DEMO_HISTORICAL_MUSLIB_LITE_STUDENT_ID);
  assert.equal(muslib?.name, editedName);
  assert.equal(muslibLite?.name, "León Acosta");

  // Call site 3: projectGymFixedRenewals -> FixedRoutineManagerView's renewalRoutines list.
  const renewal = fixedRoutineManagerProps.renewalRoutines.find((routine) => routine.studentId === directory.GYM_DEMO_MUSLIB_STUDENT_ID);
  assert.equal(renewal?.studentName, editedName);
});

test("controlled provider effects restart after pre-hydration cleanup without writes", async () => {
  const providerSource = await source("src/components/demo/gym/DemoGymProvider.tsx");
  const compiled = ts.transpileModule(providerSource, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const states = [];
  const refs = [];
  const effects = [];
  let hook = 0;
  let published = null;
  const Context = { Provider: () => null };
  const react = {
    createContext: () => Context,
    useState: (initial) => {
      const index = hook++;
      if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
      return [states[index], (next) => { states[index] = typeof next === "function" ? next(states[index]) : next; }];
    },
    useRef: (initial) => (hook++, refs[hook - 1] ??= { current: initial }),
    useEffect: (effect) => { hook++; effects.push(effect); },
    useMemo: (factory) => (hook++, factory()),
    useCallback: (callback) => (hook++, callback),
    useContext: () => null,
  };
  const timers = [];
  const reads = [];
  const writes = [];
  const previousWindow = globalThis.window;
  globalThis.window = {
    sessionStorage: { getItem: (key) => (reads.push(key), null), setItem: (key, value) => writes.push([key, value]) },
    setTimeout: (callback) => (timers.push({ callback, cancelled: false }), timers.length - 1),
    clearTimeout: (id) => { timers[id].cancelled = true; },
  };
  let trainingFactoryCount = 0;
  let fixedFactoryCount = 0;
  let rmFactoryCount = 0;
  const mocks = {
    react,
    "react/jsx-runtime": { jsx: (type, props) => { if (type === Context.Provider) published = props.value; return { type, props }; }, jsxs: (type, props) => ({ type, props }) },
    "@/lib/dates": { getTodayArgentina: () => new Date("2026-09-30T00:00:00.000Z"), toInputDate: (date) => date.toISOString().slice(0, 10) },
    "@/components/demo/training/demo-rm-adapters": { ...rmAdapters, createDemoRmCallbackFactory: (options) => { rmFactoryCount += 1; return rmAdapters.createDemoRmCallbackFactory(options); } },
    "@/components/demo/training/demo-rm-core": rmCore,
    "@/components/demo/training/demo-rm-storage": rmStorage,
    "@/components/demo/training/gym-fixed-demo-adapters": { ...fixedAdapters, createGymFixedCallbackFactory: (options) => { fixedFactoryCount += 1; return fixedAdapters.createGymFixedCallbackFactory(options); } },
    "@/components/demo/training/gym-fixed-demo-state": fixedState,
    "@/components/demo/training/gym-fixed-demo-fixtures": fixedFixtures,
    "@/components/demo/training/gym-fixed-demo-storage": fixedStorage,
    "@/components/demo/training/gym-training-demo-adapters": { ...trainingAdapters, createGymTrainingCallbackFactory: (options) => { trainingFactoryCount += 1; return trainingAdapters.createGymTrainingCallbackFactory(options); } },
    "@/components/demo/training/gym-training-demo-state": trainingState,
    "@/components/demo/training/gym-training-demo-fixtures": trainingFixtures,
    "@/components/demo/training/gym-training-demo-storage": trainingStorage,
    "@/components/demo/scenarios/gym-demo-directory": directory,
  };
  const commonjsModule = { exports: {} };
  const require = (specifier) => { if (!(specifier in mocks)) throw new Error(`Unexpected module: ${specifier}`); return mocks[specifier]; };
  new Function("require", "exports", "module", compiled)(require, commonjsModule.exports, commonjsModule);
  const render = () => { hook = 0; effects.length = 0; commonjsModule.exports.DemoGymProvider({ children: "demo" }); return effects.slice(); };
  try {
    const firstEffects = render();
    const firstCleanup = firstEffects[0]();
    firstCleanup();
    const secondEffects = render();
    secondEffects[0]();
    for (const timer of timers) if (!timer.cancelled) timer.callback();
    assert.deepEqual(reads.sort(), ["wody-gym-fixed-routines-demo-v1", "wody-gym-fixed-routines-demo-v1", "wody-gym-rms-demo-v1", "wody-gym-rms-demo-v1", "wody-gym-training-demo-v1", "wody-gym-training-demo-v1"]);
    assert.equal(writes.length, 0);
    assert.equal(states[4], true);
    assert.equal(trainingFactoryCount, 3);
    assert.equal(fixedFactoryCount, 3);
    assert.equal(rmFactoryCount, 7);
    render();
    published.resetDatedTraining();
    render();
    assert.equal(trainingFactoryCount, 3);
    assert.equal(fixedFactoryCount, 3);
    assert.equal(rmFactoryCount, 7);
  } finally {
    globalThis.window = previousWindow;
  }
});

test("GYM provider lifecycle owns three ledgers, delays publication, and resets one domain at a time", async () => {
  const provider = await source("src/components/demo/gym/DemoGymProvider.tsx");
  assert.match(provider, /const restoredTraining = loadGymTrainingDemoState\(storage\);\s*const restoredFixed = loadGymFixedDemoState\(storage\);\s*const restoredRms = gymRmStorage\.load\(storage\);/);
  assert.match(provider, /hydrationGenerationRef[\s\S]*window\.clearTimeout\(timer\)[\s\S]*hydrationGenerationRef\.current \+= 1/);
  assert.match(provider, /hydratedRef\.current = true;\s*setReady\(true\);/);
  assert.match(provider, /new Map\(trainingFactories\.current\)[\s\S]*new Map\(fixedFactories\.current\)[\s\S]*new Map\(rmFactories\.current\)[\s\S]*setReady\(true\)/);
  assert.match(provider, /for \(const actorId of staffIds\)[\s\S]*createGymTrainingCallbackFactory[\s\S]*createGymFixedCallbackFactory/);
  assert.match(provider, /for \(const ownerId of GYM_RM_OWNER_IDS\)[\s\S]*gymRmCore\.getActorToken\(ownerId\)[\s\S]*createDemoRmCallbackFactory/);
  assert.match(provider, /getTrainingState: \(\) => trainingRef\.current/);
  assert.match(provider, /resetDatedTraining[\s\S]*trainingFactories\.current\.values\(\)[\s\S]*fixedFactories\.current\.values\(\)[\s\S]*persistGymTrainingDemoState[\s\S]*setDatedEpoch/);
  assert.match(provider, /toInputDate\(getTodayArgentina\(\)\)/);
  assert.match(provider, /resetFixedRoutines[\s\S]*persistGymFixedDemoState[\s\S]*setFixedEpoch/);
  assert.match(provider, /resetRms[\s\S]*gymRmStorage\.persist[\s\S]*setRmEpoch/);
  assert.doesNotMatch(provider, /wody-box-|wody-personal-|DemoFinanceProvider|DemoAccessProvider/);
});

test("GYM route mounts production presentation in the staff order and has no query-persona authority", async () => {
  const route = await source("src/components/demo/gym/DemoGymTrainingRoute.tsx");
  const group = route.indexOf("<GroupManagerView");
  const fixed = route.indexOf("<FixedRoutineManagerView");
  const wod = route.indexOf("<WodManagerView");
  assert.ok(group >= 0 && group < fixed && fixed < wod);
  assert.match(route, /FixedRoutineStudentView/);
  assert.match(route, /RmsView/);
  assert.match(route, /WodCard[\s\S]*WodHistory/);
  assert.match(route, /useGymProjection\(actor\.id, true\)/);
  assert.match(route, /useGymProjection\(gym\.selectedActor\.id, false\)/);
  assert.match(route, /GroupManagerView key=\{gym\.datedEpoch\}/);
  assert.match(route, /FixedRoutineManagerView key=\{gym\.fixedEpoch\}/);
  assert.match(route, /WodManagerView key=\{`\$\{gym\.datedEpoch\}:\$\{gym\.fixedEpoch\}`\}/);
  assert.match(route, /defaultGymFixedRenewAt\(gym\.today!\)/);
  assert.match(route, /selectedWodId \? wods\.value\.find/);
  assert.match(route, /wods\.value\[0\] \?\? null/);
  assert.doesNotMatch(route, /useSearchParams|searchParams|RmsClient|WodManagerClient|as unknown/);
});
