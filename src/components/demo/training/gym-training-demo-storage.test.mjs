import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createGymTrainingDemoFixture } from "./gym-training-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import {
  deserializeGymTrainingDemoState,
  GYM_TRAINING_DEMO_STORAGE_KEY,
  loadGymTrainingDemoState,
  persistGymTrainingDemoState,
  serializeGymTrainingDemoState,
} from "./gym-training-demo-storage.ts";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function storageSpy(bytes = new Map()) {
  const reads = [];
  const writes = [];
  return {
    reads,
    writes,
    storage: {
      getItem(key) { reads.push(key); return bytes.get(key) ?? null; },
      setItem(key, value) { writes.push([key, value]); bytes.set(key, value); },
    },
  };
}

test("GYM storage round-trips a detached canonical dated ledger, including SetNull and soft-delete history", () => {
  const fixture = createGymTrainingDemoFixture();
  fixture.groups[0].deletedAt = "2025-05-20T10:00:00.000Z";
  fixture.memberships = fixture.memberships.filter((member) => member.groupId !== fixture.groups[0].id);
  fixture.wods.find((wod) => wod.id === "gym-dated-group").targetGroupId = null;
  const bytes = serializeGymTrainingDemoState(fixture);
  const restored = deserializeGymTrainingDemoState(bytes);
  assert.equal(restored.warning, null);
  assert.deepEqual(restored.state, fixture);
  assert.notEqual(restored.state, fixture);
  assert.notEqual(restored.state.wods, fixture.wods);
  restored.state.wods[0].title = "local only";
  assert.notEqual(restored.state.wods[0].title, fixture.wods[0].title);
});

test("only null is a missing ledger; blank, corrupted, foreign, and malformed graph bytes restore a valid fresh GYM fixture", () => {
  const fixture = createGymTrainingDemoFixture();
  const foreignNamespace = clone(fixture);
  foreignNamespace.namespace = "demo-box-training/v2";
  const foreignKind = clone(fixture);
  foreignKind.kind = "BOX";
  const unknownProfile = clone(fixture);
  unknownProfile.wods[0].teacherId = "foreign-profile";
  const badLink = clone(fixture);
  badLink.memberships[0].studentId = "foreign-profile";
  const sparse = clone(fixture);
  sparse.groups = [sparse.groups[0], null];
  assert.deepEqual(deserializeGymTrainingDemoState(null), { state: fixture, warning: null });
  for (const raw of [undefined, "", " \n\t", "{bad", "[]", JSON.stringify(foreignNamespace), JSON.stringify(foreignKind), JSON.stringify(unknownProfile), JSON.stringify(badLink), JSON.stringify(sparse)]) {
    const loaded = deserializeGymTrainingDemoState(raw);
    assert.deepEqual(loaded.state, fixture);
    assert.match(loaded.warning ?? "", /no es válido/i);
    assert.notEqual(loaded.state, fixture);
  }
});

test("load reads exactly the GYM dated key and never hydrates by writing, deleting, or examining unrelated ledgers", () => {
  const bytes = new Map([
    ["wody-box-training-demo-v2", "box bytes"],
    ["wody-personal-training-demo-v1", "personal bytes"],
    ["wody-gym-fixed-routines-demo-v1", "fixed bytes"],
    ["wody-box-finance-demo-v3", "finance bytes"],
    ["wody-access-demo-v1", "access bytes"],
    ["wody-turnos-demo-v1", "turnos bytes"],
    [GYM_TRAINING_DEMO_STORAGE_KEY, ""],
  ]);
  const { storage, reads, writes } = storageSpy(bytes);
  const loaded = loadGymTrainingDemoState(storage);
  assert.deepEqual(loaded.state, createGymTrainingDemoFixture());
  assert.match(loaded.warning ?? "", /no es válido/i);
  assert.deepEqual(reads, [GYM_TRAINING_DEMO_STORAGE_KEY]);
  assert.deepEqual(writes, []);
  assert.equal(bytes.get("wody-box-training-demo-v2"), "box bytes");
  assert.equal(bytes.get("wody-gym-fixed-routines-demo-v1"), "fixed bytes");
});

test("hostile state is rejected before writes while frozen valid state remains serializable", () => {
  const { storage, writes } = storageSpy();
  const valid = Object.freeze(createGymTrainingDemoFixture());
  assert.equal(persistGymTrainingDemoState(storage, valid), null);
  const hostile = Object.defineProperty({}, "version", { enumerable: true, get() { throw new Error("must not reflect"); } });
  const symbol = clone(createGymTrainingDemoFixture());
  symbol[Symbol("extra")] = true;
  const sparse = clone(createGymTrainingDemoFixture());
  sparse.wods = new Array(1);
  for (const value of [hostile, symbol, sparse, new Proxy({}, {})]) {
    assert.match(persistGymTrainingDemoState(storage, value) ?? "", /no válido/i);
  }
  assert.equal(writes.length, 1);
});

test("persistence writes only a descriptor-detached snapshot and never calls caller getters or toJSON", () => {
  const fixture = createGymTrainingDemoFixture();
  let reads = 0;
  const volatileWod = new Proxy(fixture.wods[0], {
    get(target, key, receiver) {
      reads += 1;
      if (key === "toJSON") throw new Error("JSON must not reach the source");
      if (key === "title") return "volatile title";
      return Reflect.get(target, key, receiver);
    },
  });
  fixture.wods[0] = volatileWod;
  const hostileRoot = new Proxy(fixture, {
    get(target, key, receiver) {
      reads += 1;
      if (key === "toJSON") throw new Error("JSON must not reach the source");
      if (key === "version") return 999;
      return Reflect.get(target, key, receiver);
    },
  });
  const { storage, writes } = storageSpy();
  assert.equal(persistGymTrainingDemoState(storage, hostileRoot), null);
  assert.equal(reads, 0);
  assert.equal(writes.length, 1);
  const written = JSON.parse(writes[0][1]);
  assert.equal(written.version, 1);
  assert.equal(written.wods[0].title, "Entrada general");
  assert.equal(deserializeGymTrainingDemoState(writes[0][1]).warning, null);
});

test("dated ledger TOCTOU markers are rejected before writes or storage key access", () => {
  const fixture = createGymTrainingDemoFixture();
  let ownKeysCalls = 0;
  const changingRoot = new Proxy(fixture, {
    ownKeys(target) {
      ownKeysCalls += 1;
      return ownKeysCalls === 1 ? Reflect.ownKeys(target) : [...Reflect.ownKeys(target), "invalidMarker"];
    },
    getOwnPropertyDescriptor(target, key) {
      return key === "invalidMarker"
        ? { value: true, enumerable: true, configurable: true, writable: true }
        : Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
  const { storage, reads, writes } = storageSpy(new Map([["wody-box-training-demo-v2", "unrelated"]]));
  assert.match(persistGymTrainingDemoState(storage, changingRoot) ?? "", /no válido/i);
  assert.deepEqual(writes, []);
  assert.deepEqual(reads, []);
});

test("invalid descriptor graphs perform zero writes", () => {
  const { storage, writes } = storageSpy();
  const invalid = createGymTrainingDemoFixture();
  Object.defineProperty(invalid, "version", { enumerable: true, get() { return 1; } });
  assert.match(persistGymTrainingDemoState(storage, invalid) ?? "", /no válido/i);
  assert.deepEqual(writes, []);
});

test("unavailable, read, and quota errors stay warnings and never include storage payloads", () => {
  assert.match(loadGymTrainingDemoState(null).warning ?? "", /no está disponible/i);
  assert.match(persistGymTrainingDemoState(null, createGymTrainingDemoFixture()) ?? "", /no está disponible/i);
  const blocked = {
    getItem() { throw new Error("private payload"); },
    setItem() { throw new Error("private payload"); },
  };
  assert.match(loadGymTrainingDemoState(blocked).warning ?? "", /No se pudo leer/i);
  assert.match(persistGymTrainingDemoState(blocked, createGymTrainingDemoFixture()) ?? "", /No se pudieron guardar/i);
});
