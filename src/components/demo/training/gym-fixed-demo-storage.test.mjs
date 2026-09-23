import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createGymFixedDemoFixture } from "./gym-fixed-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { isValidGymFixedDemoState } from "./gym-fixed-demo-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import {
  deserializeGymFixedDemoState,
  loadGymFixedDemoState,
  persistGymFixedDemoState,
  restoreGymFixedDemoState,
  serializeGymFixedDemoState,
  GYM_FIXED_DEMO_STORAGE_KEY,
} from "./gym-fixed-demo-storage.ts";

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

test("isolated GYM storage round-trips detached valid ledgers without dropping soft-deleted history", () => {
  const fixture = createGymFixedDemoFixture();
  const serialized = serializeGymFixedDemoState(fixture);
  const restored = restoreGymFixedDemoState(serialized);
  assert.deepEqual(restored, fixture);
  assert.notEqual(restored, fixture);
  assert.notEqual(restored.fixedRoutines, fixture.fixedRoutines);
  assert.equal(restored.fixedRoutines.some((routine) => routine.deletedAt !== null), true);
  assert.equal(serializeGymFixedDemoState(restored), serialized);
  assert.equal(isValidGymFixedDemoState({ version: 1, namespace: "demo-gym-fixed-routines/v1", fixedRoutines: [] }), true);
});

test("absent, malformed, wrong-kind, wrong-version, and nested-invalid payloads recover only the local fixture", () => {
  const fixture = createGymFixedDemoFixture();
  const wrongVersion = clone(fixture);
  wrongVersion.version = 2;
  const box = clone(fixture);
  box.namespace = "demo-box-training/v2";
  const personal = clone(fixture);
  personal.namespace = "demo-personal-routines/v1";
  const nested = clone(fixture);
  nested.fixedRoutines[0].deletedAt = "not-an-instant";
  const duplicate = clone(fixture);
  duplicate.fixedRoutines.push(clone(duplicate.fixedRoutines[0]));
  const absent = deserializeGymFixedDemoState(null);
  assert.deepEqual(absent, { state: fixture, warning: null });
  for (const raw of ["", "   \n\t", "{bad json", JSON.stringify(wrongVersion), JSON.stringify(box), JSON.stringify(personal), JSON.stringify(nested), JSON.stringify(duplicate)]) {
    const result = deserializeGymFixedDemoState(raw);
    assert.deepEqual(result.state, fixture);
    assert.match(result.warning ?? "", /no es válido/i);
  }
});

test("load reads only its own key and never writes or removes unrelated BOX, finance, access, or turnos bytes", () => {
  const bytes = new Map([
    ["wody-box-training-demo-v2", "box"],
    ["wody-box-finance-demo-v3", "finance"],
    ["wody-access-demo-v1", "access"],
    ["wody-turnos-demo-v1", "turnos"],
    [GYM_FIXED_DEMO_STORAGE_KEY, ""],
  ]);
  const { storage, reads, writes } = storageSpy(bytes);
  const loaded = loadGymFixedDemoState(storage);
  assert.deepEqual(loaded.state, createGymFixedDemoFixture());
  assert.match(loaded.warning ?? "", /no es válido/i);
  assert.deepEqual(reads, [GYM_FIXED_DEMO_STORAGE_KEY]);
  assert.deepEqual(writes, []);
  assert.equal(bytes.get(GYM_FIXED_DEMO_STORAGE_KEY), "");
  assert.equal(bytes.get("wody-box-training-demo-v2"), "box");
  assert.equal(bytes.get("wody-box-finance-demo-v3"), "finance");
  assert.equal(bytes.get("wody-access-demo-v1"), "access");
  assert.equal(bytes.get("wody-turnos-demo-v1"), "turnos");
});

test("persistence writes exactly the isolated key only for validated state and keeps invalid payloads untouched", () => {
  const { storage, writes } = storageSpy();
  const fixture = createGymFixedDemoFixture();
  assert.equal(persistGymFixedDemoState(storage, fixture), null);
  assert.equal(writes.length, 1);
  assert.equal(writes[0][0], GYM_FIXED_DEMO_STORAGE_KEY);
  const invalid = clone(fixture);
  invalid.fixedRoutines[0].gymId = "foreign";
  assert.match(persistGymFixedDemoState(storage, invalid) ?? "", /no válido/i);
  assert.equal(writes.length, 1);

  const getter = Object.defineProperty({}, "version", { enumerable: true, get() { throw new Error("no getter"); } });
  assert.throws(() => serializeGymFixedDemoState(getter), /invalid/i);
  assert.equal(writes.length, 1);
  const sparse = { version: 1, namespace: "demo-gym-fixed-routines/v1", fixedRoutines: new Array(1) };
  assert.throws(() => serializeGymFixedDemoState(sparse), /invalid/i);
  assert.equal(writes.length, 1);
});

test("storage unavailability and quota/read failures are non-fatal warnings", () => {
  assert.match(loadGymFixedDemoState(null).warning ?? "", /no está disponible/i);
  assert.match(persistGymFixedDemoState(null, createGymFixedDemoFixture()) ?? "", /no está disponible/i);
  const blocked = {
    getItem() { throw new Error("read blocked"); },
    setItem() { throw new Error("quota"); },
  };
  assert.match(loadGymFixedDemoState(blocked).warning ?? "", /No se pudo leer/i);
  assert.match(persistGymFixedDemoState(blocked, createGymFixedDemoFixture()) ?? "", /No se pudieron guardar/i);
});
