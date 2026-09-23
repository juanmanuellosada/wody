import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createPersonalTrainingDemoFixture } from "./personal-training-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import {
  deserializePersonalTrainingDemoState,
  loadPersonalTrainingDemoState,
  persistPersonalTrainingDemoState,
  restorePersonalTrainingDemoState,
  serializePersonalTrainingDemoState,
  PERSONAL_TRAINING_DEMO_STORAGE_KEY,
} from "./personal-training-demo-storage.ts";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function storageSpy(initial = new Map()) {
  const reads = [];
  const writes = [];
  return {
    reads,
    writes,
    storage: {
      getItem(key) { reads.push(key); return initial.get(key) ?? null; },
      setItem(key, value) { writes.push([key, value]); initial.set(key, value); },
    },
  };
}

test("PERSONAL storage round-trips a detached, complete soft-delete ledger", () => {
  const fixture = createPersonalTrainingDemoFixture();
  const serialized = serializePersonalTrainingDemoState(fixture);
  const restored = restorePersonalTrainingDemoState(serialized);
  assert.deepEqual(restored, fixture);
  assert.notEqual(restored, fixture);
  assert.notEqual(restored.wods, fixture.wods);
  assert.equal(restored.wods.some((wod) => wod.deletedAt !== null), true);
  restored.wods[0].title = "local mutation";
  assert.equal(createPersonalTrainingDemoFixture().wods[0].title, "Rutina actual");
  assert.equal(serializePersonalTrainingDemoState(createPersonalTrainingDemoFixture()), serialized);
});

test("only null is absent; empty, malformed, wrong namespace, version, kind, and foreign owner recover a fresh fixture with warning", () => {
  const fixture = createPersonalTrainingDemoFixture();
  const wrongVersion = clone(fixture);
  wrongVersion.version = 2;
  const wrongNamespace = clone(fixture);
  wrongNamespace.namespace = "demo-box-training/v2";
  const foreignOwner = clone(fixture);
  foreignOwner.wods[0].teacherId = "box-teacher";
  const wrongKind = clone(fixture);
  wrongKind.wods = {};
  const absent = deserializePersonalTrainingDemoState(null);
  assert.deepEqual(absent, { state: fixture, warning: null });
  for (const raw of [undefined, "", " \n\t", "{bad json", "[]", JSON.stringify(wrongVersion), JSON.stringify(wrongNamespace), JSON.stringify(foreignOwner), JSON.stringify(wrongKind)]) {
    const result = deserializePersonalTrainingDemoState(raw);
    assert.deepEqual(result.state, fixture);
    assert.match(result.warning ?? "", /no es válido/i);
    assert.notEqual(result.state, fixture);
  }
});

test("load reads only its own bytes and recovery never writes or deletes foreign ledgers", () => {
  const bytes = new Map([
    ["wody-box-training-demo-v2", "box"],
    ["wody-gym-fixed-routines-demo-v1", "gym"],
    ["wody-box-finance-demo-v3", "finance"],
    ["wody-access-demo-v1", "access"],
    ["wody-turnos-demo-v1", "turnos"],
    [PERSONAL_TRAINING_DEMO_STORAGE_KEY, ""],
  ]);
  const { storage, reads, writes } = storageSpy(bytes);
  const result = loadPersonalTrainingDemoState(storage);
  assert.deepEqual(result.state, createPersonalTrainingDemoFixture());
  assert.match(result.warning ?? "", /no es válido/i);
  assert.deepEqual(reads, [PERSONAL_TRAINING_DEMO_STORAGE_KEY]);
  assert.deepEqual(writes, []);
  assert.equal(bytes.get("wody-box-training-demo-v2"), "box");
  assert.equal(bytes.get("wody-gym-fixed-routines-demo-v1"), "gym");
  assert.equal(bytes.get("wody-box-finance-demo-v3"), "finance");
  assert.equal(bytes.get("wody-access-demo-v1"), "access");
  assert.equal(bytes.get("wody-turnos-demo-v1"), "turnos");
});

test("strict core validation rejects symbols, getters, sparse arrays, prototypes, and invalid state before any storage write", () => {
  const { storage, writes } = storageSpy();
  const fixture = createPersonalTrainingDemoFixture();
  assert.equal(persistPersonalTrainingDemoState(storage, fixture), null);
  assert.deepEqual(writes.map(([key]) => key), [PERSONAL_TRAINING_DEMO_STORAGE_KEY]);

  const symbol = clone(fixture);
  symbol[Symbol("unexpected")] = true;
  const getter = Object.defineProperty({}, "version", { enumerable: true, get() { throw new Error("must not read"); } });
  const sparse = { version: 1, namespace: "demo-personal-training/v1", wods: new Array(1) };
  const prototype = Object.create(fixture);
  for (const invalid of [symbol, getter, sparse, prototype]) {
    assert.throws(() => serializePersonalTrainingDemoState(invalid), /invalid/i);
    assert.match(persistPersonalTrainingDemoState(storage, invalid) ?? "", /no válido/i);
  }
  assert.equal(writes.length, 1);
});

test("unavailable, read, and quota failures are warning-only and never expose payload bytes", () => {
  assert.match(loadPersonalTrainingDemoState(null).warning ?? "", /no está disponible/i);
  assert.match(persistPersonalTrainingDemoState(null, createPersonalTrainingDemoFixture()) ?? "", /no está disponible/i);
  const blocked = {
    getItem() { throw new Error("read blocked with payload"); },
    setItem() { throw new Error("quota blocked with payload"); },
  };
  assert.match(loadPersonalTrainingDemoState(blocked).warning ?? "", /No se pudo leer/i);
  assert.match(persistPersonalTrainingDemoState(blocked, createPersonalTrainingDemoFixture()) ?? "", /No se pudieron guardar/i);
});
