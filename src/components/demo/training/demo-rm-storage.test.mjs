import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createDemoRmCore } from "./demo-rm-core.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import {
  createDemoRmStorageAdapter,
  GYM_DEMO_RM_STORAGE_KEY,
  PERSONAL_DEMO_RM_STORAGE_KEY,
} from "./demo-rm-storage.ts";

function setup(kind = "GYM") {
  const core = createDemoRmCore({ kind, ownerIds: ["owner", "other"] });
  const fixture = core.createRm(core.emptyState(), core.getActorToken("owner"), {
    id: "fixture-rm", exercise: "Clean", weight: "80", date: "2025-05-10",
  }).state;
  return { core, fixture, storage: createDemoRmStorageAdapter(core, fixture) };
}

function storageSpy(bytes = new Map()) {
  const reads = [];
  const writes = [];
  return {
    bytes,
    reads,
    writes,
    storage: {
      getItem(key) { reads.push(key); return bytes.has(key) ? bytes.get(key) : null; },
      setItem(key, value) { writes.push([key, value]); bytes.set(key, value); },
    },
  };
}

test("each trusted kind has its own fixed storage key and round-trips every valid physical ledger row detached", () => {
  for (const [kind, key] of [["GYM", GYM_DEMO_RM_STORAGE_KEY], ["PERSONAL", PERSONAL_DEMO_RM_STORAGE_KEY]]) {
    const { core, storage } = setup(kind);
    const owner = core.getActorToken("owner");
    let state = core.createRm(core.emptyState(), owner, { id: "one", exercise: "Squat", weight: "1e-18", date: "0004-02-29" }).state;
    state = core.createRm(state, owner, { id: "two", exercise: "Press", weight: "80kg", date: "2025-02-29" }).state;
    const raw = storage.serialize(state);
    assert.equal(storage.key, key);
    const loaded = storage.deserialize(raw);
    assert.equal(loaded.warning, null);
    assert.deepEqual(loaded.state, state);
    assert.notEqual(loaded.state, state);
    assert.notEqual(loaded.state.rms, state.rms);
    loaded.state.rms[0].exercise = "mutated";
    assert.equal(storage.deserialize(raw).state.rms[0].exercise, "Squat");
  }
});

test("only null is absent; blank, corrupt, foreign namespace, version, kind, owner, and closed-shape invalid bytes recover without writes", () => {
  const { fixture, storage } = setup();
  const foreignOwner = structuredClone(fixture);
  foreignOwner.rms[0].studentId = "unregistered";
  const wrongVersion = structuredClone(fixture);
  wrongVersion.version = 2;
  const wrongNamespace = structuredClone(fixture);
  wrongNamespace.namespace = "demo-box-rms/v1";
  const wrongKind = structuredClone(fixture);
  wrongKind.kind = "PERSONAL";
  const closedShape = structuredClone(fixture);
  closedShape.extra = true;
  assert.deepEqual(storage.deserialize(null), { state: fixture, warning: null });
  for (const raw of ["", " \n\t", "{broken", JSON.stringify(foreignOwner), JSON.stringify(wrongVersion), JSON.stringify(wrongNamespace), JSON.stringify(wrongKind), JSON.stringify(closedShape)]) {
    const loaded = storage.deserialize(raw);
    assert.deepEqual(loaded.state, fixture);
    assert.match(loaded.warning ?? "", /válido/i);
  }

  const bytes = new Map([[GYM_DEMO_RM_STORAGE_KEY, ""], ["wody-box-training-demo-v2", "box"], ["wody-box-finance-demo-v3", "finance"], ["wody-access-demo-v1", "access"], ["wody-turnos-demo-v1", "turnos"]]);
  const spy = storageSpy(bytes);
  const loaded = storage.load(spy.storage);
  assert.deepEqual(loaded.state, fixture);
  assert.deepEqual(spy.reads, [GYM_DEMO_RM_STORAGE_KEY]);
  assert.deepEqual(spy.writes, []);
  assert.equal(bytes.get("wody-box-training-demo-v2"), "box");
  assert.equal(bytes.get("wody-box-finance-demo-v3"), "finance");
  assert.equal(bytes.get("wody-access-demo-v1"), "access");
  assert.equal(bytes.get("wody-turnos-demo-v1"), "turnos");
});

test("serialization validates before JSON and persistence never writes invalid, unavailable, or quota-failed values", () => {
  const { core, fixture, storage } = setup();
  const spy = storageSpy();
  assert.equal(storage.persist(spy.storage, fixture), null);
  assert.deepEqual(spy.writes.map(([key]) => key), [GYM_DEMO_RM_STORAGE_KEY]);
  assert.throws(() => storage.serialize({ ...fixture, rms: new Array(1) }), /invalid/i);
  const getter = Object.defineProperty({}, "version", { enumerable: true, get() { throw new Error("must not run"); } });
  assert.throws(() => storage.serialize(getter), /invalid/i);
  assert.match(storage.persist(spy.storage, getter) ?? "", /no válido/i);
  assert.equal(spy.writes.length, 1);
  assert.match(storage.load(null).warning ?? "", /no está disponible/i);
  assert.match(storage.persist(null, fixture) ?? "", /no está disponible/i);
  const blocked = { getItem() { throw new Error("read"); }, setItem() { throw new Error("quota"); } };
  assert.match(storage.load(blocked).warning ?? "", /No se pudo leer/i);
  assert.match(storage.persist(blocked, fixture) ?? "", /No se pudieron guardar/i);
  assert.equal(core.isValidState(fixture), true);
});

test("composition accepts only a valid scoped fixture and never derives keys from persisted values", () => {
  const gym = createDemoRmCore({ kind: "GYM", ownerIds: ["owner"] });
  const personal = createDemoRmCore({ kind: "PERSONAL", ownerIds: ["owner"] });
  assert.throws(() => createDemoRmStorageAdapter(gym, personal.emptyState()), /fixture/i);
  assert.equal(createDemoRmStorageAdapter(gym).key, GYM_DEMO_RM_STORAGE_KEY);
  assert.equal(createDemoRmStorageAdapter(personal).key, PERSONAL_DEMO_RM_STORAGE_KEY);
});
