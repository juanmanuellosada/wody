import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createGymAccessDemoFixture } from "./gym-access-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { isValidGymAccessDemoState } from "./gym-access-demo-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { loadGymAccessDemoState, persistGymAccessDemoState, resolveGymAccessDemoInitialState, serializeGymAccessDemoState } from "./gym-access-demo-storage.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { GYM_ACCESS_DEMO_STORAGE_KEY } from "./gym-access-demo-types.ts";

const fixture = createGymAccessDemoFixture("2030-06-03");

function memoryStorage(entries = {}) {
  const values = new Map(Object.entries(entries));
  const reads = [];
  const writes = [];
  return {
    getItem(key) { reads.push(key); return values.get(key) ?? null; },
    setItem(key, value) { writes.push([key, value]); values.set(key, value); },
    reads,
    writes,
    values,
  };
}

test("the GYM access namespace and storage key are isolated from BOX's", () => {
  assert.equal(GYM_ACCESS_DEMO_STORAGE_KEY, "wody-gym-access-demo-v1");
  assert.notEqual(GYM_ACCESS_DEMO_STORAGE_KEY, "wody-box-access-demo-v1");
});

test("a valid fixture round-trips through serialize/resolve", () => {
  assert.equal(isValidGymAccessDemoState(fixture), true);
  const raw = serializeGymAccessDemoState(fixture);
  assert.deepEqual(resolveGymAccessDemoInitialState(raw).state, fixture);
  assert.equal(resolveGymAccessDemoInitialState(raw).warning, null);
});

test("an invalid state refuses to serialize", () => {
  assert.throws(() => serializeGymAccessDemoState({ ...fixture, extra: true }));
});

test("load reads only its own key and never the BOX or GYM finance keys, and read/write failures fall back safely", () => {
  const boxKey = "wody-box-access-demo-v1";
  const gymFinanceKey = "wody-gym-finance-demo-v1";
  const storage = memoryStorage({ [boxKey]: "box-bytes", [gymFinanceKey]: "gym-finance-bytes" });
  const loaded = loadGymAccessDemoState(storage, createGymAccessDemoFixture("2031-01-01"));
  assert.equal(loaded.warning, null);
  assert.deepEqual(storage.reads, [GYM_ACCESS_DEMO_STORAGE_KEY]);
  assert.equal(storage.writes.length, 0);
  assert.equal(persistGymAccessDemoState(storage, fixture), null);
  assert.deepEqual(storage.writes.map(([key]) => key), [GYM_ACCESS_DEMO_STORAGE_KEY]);
  assert.equal(storage.values.get(boxKey), "box-bytes", "the BOX key is never touched");
  assert.equal(storage.values.get(gymFinanceKey), "gym-finance-bytes", "GYM finance's own key is never touched");

  const failure = loadGymAccessDemoState({ getItem() { throw new Error("denied"); }, setItem() { throw new Error("no write"); } }, fixture);
  assert.equal(failure.state, fixture);
  assert.match(failure.warning, /No se pudo leer/);

  assert.equal(loadGymAccessDemoState(null, fixture).warning, "El almacenamiento de esta pestaña no está disponible; los cambios no se conservarán.");
  assert.equal(persistGymAccessDemoState(null, fixture), "El almacenamiento de esta pestaña no está disponible; los cambios no se conservarán.");
});

test("malformed stored bytes never trigger a destructive write and fall back to the supplied fixture", () => {
  const storage = memoryStorage({ [GYM_ACCESS_DEMO_STORAGE_KEY]: "{broken" });
  const loaded = loadGymAccessDemoState(storage, fixture);
  assert.equal(loaded.state, fixture);
  assert.match(loaded.warning, /no es válido/);
  assert.equal(storage.writes.length, 0);

  const boxShaped = { ...fixture, namespace: "wody-box-access-demo-v1" };
  const wrongNamespace = memoryStorage({ [GYM_ACCESS_DEMO_STORAGE_KEY]: JSON.stringify(boxShaped) });
  const rejected = loadGymAccessDemoState(wrongNamespace, fixture);
  assert.equal(rejected.state, fixture, "a differently-namespaced payload never silently becomes the live state");
});
