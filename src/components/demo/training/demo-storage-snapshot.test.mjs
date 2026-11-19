import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { snapshotDemoStorageValue } from "./demo-storage-snapshot.ts";

function secondCaptureAdds(target, marker, descriptor = { value: true, enumerable: true, configurable: true, writable: true }) {
  let ownKeysCalls = 0;
  return new Proxy(target, {
    ownKeys(value) {
      ownKeysCalls += 1;
      return ownKeysCalls === 1 ? Reflect.ownKeys(value) : [...Reflect.ownKeys(value), marker];
    },
    getOwnPropertyDescriptor(value, key) {
      return key === marker ? descriptor : Reflect.getOwnPropertyDescriptor(value, key);
    },
  });
}

function secondCaptureRemoves(target, removed) {
  let ownKeysCalls = 0;
  return new Proxy(target, {
    ownKeys(value) {
      ownKeysCalls += 1;
      const keys = Reflect.ownKeys(value);
      return ownKeysCalls === 1 ? keys : keys.filter((key) => key !== removed);
    },
  });
}

test("rejects object and array keys added during descriptor capture, including non-enumerable and symbol markers", () => {
  for (const createTarget of [() => ({ stable: true }), () => ["stable"]]) {
    for (const [marker, descriptor] of [
      ["invalidMarker", { value: true, enumerable: true, configurable: true, writable: true }],
      ["hiddenMarker", { value: true, enumerable: false, configurable: true, writable: true }],
      [Symbol("invalidMarker"), { value: true, enumerable: true, configurable: true, writable: true }],
    ]) {
      assert.deepEqual(snapshotDemoStorageValue(secondCaptureAdds(createTarget(), marker, descriptor)), { ok: false });
    }
  }
});

test("rejects removed and nested keys when the descriptor capture differs from the first key list", () => {
  assert.deepEqual(snapshotDemoStorageValue(secondCaptureRemoves({ stable: true, removed: true }, "removed")), { ok: false });
  assert.deepEqual(snapshotDemoStorageValue({ nested: secondCaptureAdds({ stable: true }, "invalidMarker") }), { ok: false });
});

test("preserves rejection of accessors, non-enumerables, custom prototypes, sparse arrays, and cycles", () => {
  const accessor = Object.defineProperty({}, "stable", { enumerable: true, get() { return true; } });
  const hidden = Object.defineProperty({}, "stable", { enumerable: false, value: true });
  const customPrototype = Object.create({ inherited: true });
  customPrototype.stable = true;
  const sparse = new Array(1);
  const cyclic = { stable: true };
  cyclic.self = cyclic;
  for (const value of [accessor, hidden, customPrototype, sparse, cyclic]) {
    assert.deepEqual(snapshotDemoStorageValue(value), { ok: false });
  }
});

test("uses descriptor values only and rejects reflection failures without source get or toJSON hooks", () => {
  let reads = 0;
  const source = new Proxy(Object.defineProperty({ stable: true }, "toJSON", {
    enumerable: false,
    value() { reads += 1; throw new Error("must not serialize source"); },
  }), {
    get() { reads += 1; throw new Error("must not read source"); },
  });
  assert.deepEqual(snapshotDemoStorageValue(source), { ok: false });
  assert.equal(reads, 0);

  const throwing = new Proxy({}, { ownKeys() { throw new Error("blocked"); } });
  const revocable = Proxy.revocable({}, {});
  revocable.revoke();
  assert.deepEqual(snapshotDemoStorageValue(throwing), { ok: false });
  assert.deepEqual(snapshotDemoStorageValue(revocable.proxy), { ok: false });
});

test("keeps coherent frozen arrays and rejects a captured length that cannot close over the captured indices", () => {
  const frozen = Object.freeze([Object.freeze({ stable: true })]);
  const snapshot = snapshotDemoStorageValue(frozen);
  assert.deepEqual(snapshot, { ok: true, value: [{ stable: true }] });
  assert.notEqual(snapshot.ok && snapshot.value, frozen);

  const array = ["stable"];
  const incoherentLength = new Proxy(array, {
    getOwnPropertyDescriptor(target, key) {
      if (key === "length") return { value: 2, enumerable: false, configurable: false, writable: true };
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
  assert.deepEqual(snapshotDemoStorageValue(incoherentLength), { ok: false });
});

test("continues from its captured graph without a third source ownKeys read", () => {
  const fixture = { nested: { stable: true } };
  let ownKeysCalls = 0;
  const stableCapture = new Proxy(fixture, {
    ownKeys(target) {
      ownKeysCalls += 1;
      if (ownKeysCalls >= 3) throw new Error("third read");
      return Reflect.ownKeys(target);
    },
  });
  assert.deepEqual(snapshotDemoStorageValue(stableCapture), { ok: true, value: fixture });
  assert.equal(ownKeysCalls, 2);
});

test("optional root guard rejects changed namespace/version descriptors before child traversal", () => {
  const frozen = Object.freeze({ namespace: "wody-gym-finance-demo", version: 1, nested: Object.freeze({ stable: true }) });
  assert.deepEqual(snapshotDemoStorageValue(frozen), { ok: true, value: { namespace: "wody-gym-finance-demo", version: 1, nested: { stable: true } } });
  assert.deepEqual(snapshotDemoStorageValue(frozen, new WeakSet(), (keys, descriptors) => (
    keys.includes("namespace")
    && keys.includes("version")
    && descriptors.namespace?.value === "wody-gym-finance-demo"
    && descriptors.version?.value === 1
  )), { ok: true, value: { namespace: "wody-gym-finance-demo", version: 1, nested: { stable: true } } });

  let childReads = 0;
  const source = {
    namespace: "wody-gym-finance-demo",
    version: 1,
    nested: new Proxy({ stable: true }, {
      get() { childReads += 1; throw new Error("root guard must reject before child get"); },
      ownKeys() { childReads += 1; throw new Error("root guard must reject before child keys"); },
      getOwnPropertyDescriptor() { childReads += 1; throw new Error("root guard must reject before child descriptors"); },
      getPrototypeOf() { childReads += 1; throw new Error("root guard must reject before child prototype"); },
    }),
  };
  assert.deepEqual(snapshotDemoStorageValue(source, new WeakSet(), (keys, descriptors) => (
    keys.includes("namespace")
    && keys.includes("version")
    && descriptors.namespace?.value === "wody-box-finance-demo"
    && descriptors.version?.value === 3
  )), { ok: false });
  assert.equal(childReads, 0);
});
