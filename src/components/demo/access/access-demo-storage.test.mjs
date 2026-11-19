import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createAccessDemoFixture } from "./access-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { isValidAccessDemoState } from "./access-demo-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { loadAccessDemoState, persistAccessDemoState, resolveAccessDemoInitialState, serializeAccessDemoState } from "./access-demo-storage.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { ACCESS_DEMO_STORAGE_KEY } from "./access-demo-types.ts";

const fixture = createAccessDemoFixture("2030-06-03");

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

test("closed access state serializes only its v1 namespace and round-trips a valid fixture", () => {
  assert.equal(isValidAccessDemoState(fixture), true);
  const raw = serializeAccessDemoState(fixture);
  assert.deepEqual(resolveAccessDemoInitialState(raw).state, fixture);
  assert.equal(ACCESS_DEMO_STORAGE_KEY, "wody-box-access-demo-v1");
  assert.equal(JSON.parse(raw).logs[0].method, undefined);
});

test("strict deserialization rejects unknown keys, prototypes/getters/proxies, sparse arrays, duplicate/foreign rows, and invalid decision consistency", () => {
  const log = fixture.logs[0];
  const badStates = [
    { ...fixture, extra: true },
    { ...fixture, logs: [{ ...log, method: "QR" }] },
    { ...fixture, logs: [{ ...log, userId: "foreign" }] },
    { ...fixture, logs: [log, { ...log, id: log.id }] },
    { ...fixture, logs: [{ ...log, at: "2030-02-30T12:00:00.000Z" }] },
    { ...fixture, logs: [{ ...log, state: "PENDING", decidedById: "finance-admin", decidedAt: log.at }] },
    { ...fixture, logs: [{ ...log, state: "DENIED", decidedById: null, decidedAt: null }] },
    { ...fixture, version: 2 },
  ];
  for (const value of badStates) assert.equal(isValidAccessDemoState(value), false);
  const sparse = new Array(1);
  assert.equal(isValidAccessDemoState({ ...fixture, logs: sparse }), false);
  for (const [label, logs] of [
    ["symbol", Object.assign([...fixture.logs], { [Symbol("hidden")]: "must-survive" })],
    ["non-enumerable", (() => { const rows = [...fixture.logs]; Object.defineProperty(rows, "hidden", { value: "must-survive" }); return rows; })()],
  ]) {
    const corrupt = { ...fixture, logs };
    assert.equal(isValidAccessDemoState(corrupt), false, label);
    assert.throws(() => serializeAccessDemoState(corrupt), label);
    assert.equal(label === "symbol" ? logs[Object.getOwnPropertySymbols(logs)[0]] : logs.hidden, "must-survive", `${label} validation must not strip silently lossy fields`);
  }
  const getter = { ...fixture };
  Object.defineProperty(getter, "logs", { enumerable: true, get() { throw new Error("must not read getter"); } });
  assert.equal(isValidAccessDemoState(getter), false);
  assert.equal(isValidAccessDemoState(Object.create(fixture)), false);
  const revocable = Proxy.revocable(fixture, {});
  revocable.revoke();
  assert.equal(isValidAccessDemoState(revocable.proxy), false);
});

test("read failures fall back without writes; persistence changes no finance or legacy bytes", () => {
  const financeKey = "wody-box-finance-demo-v3";
  const legacyKey = "wody-box-finance-demo-v1";
  const storage = memoryStorage({ [financeKey]: "finance-bytes", [legacyKey]: "legacy-bytes" });
  const loaded = loadAccessDemoState(storage, createAccessDemoFixture("2031-01-01"));
  assert.equal(loaded.warning, null);
  assert.equal(storage.reads.length, 1);
  assert.deepEqual(storage.reads, [ACCESS_DEMO_STORAGE_KEY]);
  assert.equal(storage.writes.length, 0);
  assert.equal(persistAccessDemoState(storage, fixture), null);
  assert.deepEqual(storage.writes.map(([key]) => key), [ACCESS_DEMO_STORAGE_KEY]);
  assert.equal(storage.values.get(financeKey), "finance-bytes");
  assert.equal(storage.values.get(legacyKey), "legacy-bytes");

  const failure = loadAccessDemoState({ getItem() { throw new Error("denied"); }, setItem() { throw new Error("no write"); } }, fixture);
  assert.equal(failure.state, fixture);
  assert.match(failure.warning, /No se pudo leer/);
});

test("malformed stored bytes retain the supplied fixture without destructive repair or artificial ledger truncation", () => {
  const massive = { ...fixture, logs: Array.from({ length: 250 }, (_, index) => ({ ...fixture.logs[0], id: `log-${index}` })) };
  assert.equal(isValidAccessDemoState(massive), true);
  const storage = memoryStorage({ [ACCESS_DEMO_STORAGE_KEY]: "{broken" });
  const loaded = loadAccessDemoState(storage, massive);
  assert.equal(loaded.state, massive);
  assert.equal(loaded.state.logs.length, 250);
  assert.equal(storage.writes.length, 0);
  assert.throws(() => serializeAccessDemoState({ ...fixture, logs: [{ ...fixture.logs[0], amount: Infinity }] }));
});
