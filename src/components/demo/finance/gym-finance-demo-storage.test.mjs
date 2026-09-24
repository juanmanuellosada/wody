import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createCatalogProduct, registerCatalogSale } from "./catalog-sales-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { registerFinanceExpense } from "./expense-demo-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { getGymDemoActorToken, GYM_DEMO_ADMIN_ID, GYM_DEMO_SECONDARY_TEACHER_ID } from "../scenarios/gym-demo-directory.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createGymFinanceDemoFixture } from "./gym-finance-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { isValidGymFinanceDemoState } from "./finance-demo-storage.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import {
  deserializeGymFinanceDemoState,
  GYM_FINANCE_DEMO_STORAGE_KEY,
  loadGymFinanceDemoState,
  persistGymFinanceDemoState,
  restoreGymFinanceDemoState,
  serializeGymFinanceDemoState,
} from "./gym-finance-demo-storage.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { registerFinancePayment } from "./finance-demo-state.ts";

const anchor = "2030-06-03";
const admin = getGymDemoActorToken(GYM_DEMO_ADMIN_ID);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function storageSpy(entries = {}) {
  const values = new Map(Object.entries(entries));
  const reads = [];
  const writes = [];
  return {
    reads,
    writes,
    values,
    storage: {
      getItem(key) { reads.push(key); return values.get(key) ?? null; },
      setItem(key, value) { writes.push([key, value]); values.set(key, value); },
    },
  };
}

function settledLedger() {
  let state = createGymFinanceDemoFixture(anchor);
  const payment = registerFinancePayment(state, {
    id: "gym-storage-payment",
    commandId: "gym-storage-payment-command",
    actor: admin,
    studentId: state.students[0].id,
    amountInput: "1234,56",
    paidAt: anchor,
    nextPaymentDate: "2030-07-03",
    paymentMethod: "EFECTIVO",
    confirmedDuplicate: false,
  }, anchor);
  assert.equal(payment.result.success, true);
  state = payment.state;
  const product = createCatalogProduct(state, {
    id: "gym-storage-product",
    actor: admin,
    description: "Colchoneta",
    categoryId: state.categories[0].id,
    priceCents: 900,
    stock: 1,
  });
  assert.equal(product.result.success, true);
  state = product.state;
  const sale = registerCatalogSale(state, {
    id: "gym-storage-sale",
    commandId: "gym-storage-sale-command",
    actor: admin,
    productId: "gym-storage-product",
    quantity: 3,
    unitAmountCents: 900,
    paymentMethod: "TARJETA",
    soldAt: anchor,
  }, anchor);
  assert.equal(sale.result.success, true);
  state = sale.state;
  const expense = registerFinanceExpense(state, {
    id: "gym-storage-expense",
    actor: admin,
    amountCents: 250,
    description: "Limpieza",
    spentAt: anchor,
  }, anchor);
  assert.equal(expense.result.success, true);
  state = expense.state;
  const archived = state.students.find((student) => student.deletedAt !== null);
  return {
    ...state,
    payments: [...state.payments, {
      id: "gym-storage-archived-payment",
      commandId: "gym-storage-archived-command",
      studentId: archived.id,
      amountCents: 777,
      paidAt: "2030-05-01",
      nextPaymentDate: "2030-06-01",
      paymentMethod: "TRANSFERENCIA",
      recordedById: GYM_DEMO_ADMIN_ID,
    }],
  };
}

function freezeGraph(value, seen = new WeakSet()) {
  if (!value || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) freezeGraph(value[key], seen);
  return Object.freeze(value);
}

test("round-trips a reducer-produced GYM ledger byte-for-byte without losing archived history, due dates, stock, IDs, or order", () => {
  const state = settledLedger();
  assert.equal(isValidGymFinanceDemoState(state), true);
  assert.equal(state.products.find((product) => product.id === "gym-storage-product").stock, -2);
  const bytes = serializeGymFinanceDemoState(state);
  const restored = deserializeGymFinanceDemoState(bytes, "2040-01-01");
  assert.equal(restored.warning, null);
  assert.deepEqual(restored.state, JSON.parse(bytes));
  assert.equal(serializeGymFinanceDemoState(restored.state), bytes);
  assert.equal(restored.state.payments.at(-1).studentId, state.students.find((student) => student.deletedAt !== null).id);
  assert.equal(restored.state.payments.at(-1).id, "gym-storage-archived-payment");
  assert.equal(restored.state.students[0].nextPaymentDate, "2030-07-03");
  assert.equal(restored.state.products.find((product) => product.id === "gym-storage-product").stock, -2);
});

test("only null denotes absence; blank, malformed, foreign, unknown, and capability-bearing bytes warn and fall back without storage mutation", () => {
  const fixture = createGymFinanceDemoFixture(anchor);
  assert.deepEqual(deserializeGymFinanceDemoState(null, anchor), { state: fixture, warning: null });
  const foreign = clone(fixture);
  foreign.namespace = "wody-box-finance-demo";
  const foreignStudent = clone(fixture);
  foreignStudent.students[0].id = "foreign-student";
  for (const raw of [undefined, "", " \n\t", "{bad", JSON.stringify({ ...fixture, version: 2 }), JSON.stringify(foreign), JSON.stringify(foreignStudent), JSON.stringify({ ...fixture, actor: admin }), JSON.stringify({ ...fixture, token: "forged" }), JSON.stringify({ ...fixture, policy: {} }), JSON.stringify({ ...fixture, personaSelection: "admin" })]) {
    const result = deserializeGymFinanceDemoState(raw, anchor);
    assert.deepEqual(result.state, fixture);
    assert.match(result.warning ?? "", /no es válido/i);
    assert.notEqual(result.state, fixture);
  }
  const corrupt = storageSpy({ [GYM_FINANCE_DEMO_STORAGE_KEY]: "" });
  const loaded = loadGymFinanceDemoState(corrupt.storage, anchor);
  assert.match(loaded.warning ?? "", /no es válido/i);
  assert.deepEqual(corrupt.reads, [GYM_FINANCE_DEMO_STORAGE_KEY]);
  assert.deepEqual(corrupt.writes, []);
  assert.equal(corrupt.values.get(GYM_FINANCE_DEMO_STORAGE_KEY), "");
});

test("editable profile-bridge fields on a GYM student row diverge freely from the fixture, while canonical fields and assigned-teacher identity stay pinned", () => {
  const fixture = createGymFinanceDemoFixture(anchor);
  const edited = clone(fixture);
  edited.students[0] = {
    ...edited.students[0],
    name: "Nombre Editado",
    studentType: "PERSONALIZED",
    canCreateOwnRoutines: true,
    paymentExempt: true,
    paymentExemptReason: "Convenio actualizado",
    blocked: true,
    assignedTeachers: [{ id: GYM_DEMO_SECONDARY_TEACHER_ID, name: "Nora Vidal" }],
  };
  assert.equal(isValidGymFinanceDemoState(edited), true);

  for (const [field, value] of [
    ["email", "forged@finance-demo.invalid"],
    ["accountKind", fixture.students[0].accountKind === "FULL" ? "LITE" : "FULL"],
    ["deletedAt", "2020-01-01T00:00:00.000Z"],
  ]) {
    const broken = clone(fixture);
    broken.students[0] = { ...broken.students[0], [field]: value };
    assert.equal(isValidGymFinanceDemoState(broken), false, field);
  }

  const unknownId = clone(fixture);
  unknownId.students[0] = { ...unknownId.students[0], id: "unknown-student" };
  assert.equal(isValidGymFinanceDemoState(unknownId), false);

  const forgedTeacherName = clone(fixture);
  forgedTeacherName.students[0].assignedTeachers = [{ id: GYM_DEMO_SECONDARY_TEACHER_ID, name: "Impostor" }];
  assert.equal(isValidGymFinanceDemoState(forgedTeacherName), false);

  const fakeTeacherId = clone(fixture);
  fakeTeacherId.students[0].assignedTeachers = [{ id: "not-a-real-actor", name: "Nadie" }];
  assert.equal(isValidGymFinanceDemoState(fakeTeacherId), false);
});

test("editable GYM student fields are still type-checked even though their values may diverge from the fixture", () => {
  const fixture = createGymFinanceDemoFixture(anchor);
  const invalidRows = [
    { name: 42 },
    { name: "" },
    { name: "   " },
    { studentType: "OTRO" },
    { studentType: null },
    { canCreateOwnRoutines: "true" },
    { paymentExempt: 1 },
    { blocked: "false" },
    { paymentExemptReason: 123 },
    { assignedTeachers: [{ id: GYM_DEMO_SECONDARY_TEACHER_ID }] },
    { assignedTeachers: [{ id: GYM_DEMO_SECONDARY_TEACHER_ID, name: "Nora Vidal", extra: true }] },
    { assignedTeachers: [{ id: 42, name: "Nora Vidal" }] },
    { assignedTeachers: [{ id: GYM_DEMO_SECONDARY_TEACHER_ID, name: 42 }] },
  ];
  for (const patch of invalidRows) {
    const broken = clone(fixture);
    broken.students[0] = { ...broken.students[0], ...patch };
    assert.equal(isValidGymFinanceDemoState(broken), false, JSON.stringify(patch));
  }
  assert.equal(isValidGymFinanceDemoState(fixture), true);
});

test("loads only its v1 GYM key and rejects all BOX generations without probing or changing other demo ledgers", () => {
  const bytes = {
    "wody-box-finance-demo-v1": "box-v1",
    "wody-box-finance-demo-v2": "box-v2",
    "wody-box-finance-demo-v3": "box-v3",
    "wody-personal-training-demo-v1": "personal",
    "wody-gym-training-demo-v1": "dated",
    "wody-gym-fixed-routines-demo-v1": "fixed",
    "wody-gym-rms-demo-v1": "rm",
    "wody-access-demo-v1": "access",
    "wody-turnos-demo-v1": "turnos",
  };
  const { storage, reads, writes, values } = storageSpy(bytes);
  const result = loadGymFinanceDemoState(storage, anchor);
  assert.equal(result.warning, null);
  assert.deepEqual(reads, [GYM_FINANCE_DEMO_STORAGE_KEY]);
  assert.deepEqual(writes, []);
  for (const [key, value] of Object.entries(bytes)) assert.equal(values.get(key), value, key);
});

test("persist writes the one owned key only after core-owned validation and leaves invalid graphs untouched", () => {
  const { storage, reads, writes } = storageSpy({ "wody-box-finance-demo-v3": "box bytes" });
  const valid = settledLedger();
  assert.equal(persistGymFinanceDemoState(storage, valid), null);
  assert.deepEqual(reads, []);
  assert.deepEqual(writes.map(([key]) => key), [GYM_FINANCE_DEMO_STORAGE_KEY]);
  const invalid = clone(valid);
  invalid.payments[0].recordedById = "foreign-recorder";
  assert.match(persistGymFinanceDemoState(storage, invalid) ?? "", /no válido/i);
  assert.equal(writes.length, 1);
});

test("the core snapshot rejects hostile source shapes and serializes only descriptor-captured bytes without source gets or toJSON", () => {
  const fixture = settledLedger();
  let gets = 0;
  fixture.products[0] = new Proxy(fixture.products[0], {
    get(target, key, receiver) {
      gets += 1;
      if (key === "toJSON") throw new Error("source toJSON must not run");
      if (key === "description") return "volatile";
      return Reflect.get(target, key, receiver);
    },
  });
  const source = new Proxy(fixture, {
    get(target, key, receiver) {
      gets += 1;
      if (key === "toJSON") throw new Error("source toJSON must not run");
      if (key === "version") return 999;
      return Reflect.get(target, key, receiver);
    },
  });
  const { storage, writes } = storageSpy();
  assert.equal(persistGymFinanceDemoState(storage, source), null);
  assert.equal(gets, 0);
  assert.equal(JSON.parse(writes[0][1]).version, 1);
  assert.notEqual(JSON.parse(writes[0][1]).products[0].description, "volatile");

  const clean = settledLedger();
  const symbol = clone(clean); symbol[Symbol("extra")] = true;
  const hidden = clone(clean); Object.defineProperty(hidden, "hidden", { value: true });
  const accessor = clone(clean); Object.defineProperty(accessor, "anchor", { enumerable: true, get() { throw new Error("getter"); } });
  const customPrototype = Object.assign(Object.create({ inherited: true }), clean);
  const sparse = clone(clean); sparse.students = new Array(1);
  const cyclic = clone(clean); cyclic.self = cyclic;
  const revoked = Proxy.revocable(clone(clean), {}); revoked.revoke();
  for (const hostile of [symbol, hidden, accessor, customPrototype, sparse, cyclic, revoked.proxy]) {
    assert.throws(() => serializeGymFinanceDemoState(hostile), /invalid/i);
  }
  assert.equal(writes.length, 1);
});

test("a changed header and a second ownKeys marker fail before any child traversal or storage access", () => {
  const fixture = createGymFinanceDemoFixture(anchor);
  let childTraps = 0;
  fixture.students = new Proxy(fixture.students, {
    get() { childTraps += 1; throw new Error("child must not be read"); },
    ownKeys() { childTraps += 1; throw new Error("child must not be listed"); },
    getOwnPropertyDescriptor() { childTraps += 1; throw new Error("child descriptor"); },
  });
  const headerChangesToBox = new Proxy(fixture, {
    getOwnPropertyDescriptor(target, key) {
      if (key === "namespace") return { value: "wody-box-finance-demo", enumerable: true, configurable: true, writable: true };
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
  let ownKeysCalls = 0;
  const changing = new Proxy(createGymFinanceDemoFixture(anchor), {
    ownKeys(target) {
      ownKeysCalls += 1;
      return ownKeysCalls === 1 ? Reflect.ownKeys(target) : [...Reflect.ownKeys(target), "lateMarker"];
    },
    getOwnPropertyDescriptor(target, key) {
      return key === "lateMarker"
        ? { value: true, enumerable: true, configurable: true, writable: true }
        : Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
  const first = storageSpy();
  assert.match(persistGymFinanceDemoState(first.storage, headerChangesToBox) ?? "", /no válido/i);
  assert.equal(childTraps, 0);
  assert.deepEqual(first.reads, []);
  assert.deepEqual(first.writes, []);
  const second = storageSpy();
  assert.match(persistGymFinanceDemoState(second.storage, changing) ?? "", /no válido/i);
  assert.deepEqual(second.reads, []);
  assert.deepEqual(second.writes, []);
});

test("frozen valid captures are accepted, while restored and fallback mutations never alter future loads or fixtures", () => {
  const frozen = freezeGraph(settledLedger());
  const bytes = serializeGymFinanceDemoState(frozen);
  const restored = restoreGymFinanceDemoState(bytes, anchor);
  restored.students[0].nextPaymentDate = "2099-01-01";
  assert.notEqual(restoreGymFinanceDemoState(bytes, anchor).students[0].nextPaymentDate, "2099-01-01");
  const fallback = deserializeGymFinanceDemoState(null, anchor).state;
  fallback.products[0].stock = -999;
  assert.notEqual(deserializeGymFinanceDemoState(null, anchor).state.products[0].stock, -999);
  assert.notEqual(createGymFinanceDemoFixture(anchor).products[0].stock, -999);
});

test("unavailable, incomplete, read, and quota storage failures are actionable generic warnings with no fallback writes", () => {
  assert.match(loadGymFinanceDemoState(null, anchor).warning ?? "", /no está disponible/i);
  assert.match(persistGymFinanceDemoState(null, createGymFinanceDemoFixture(anchor)) ?? "", /no está disponible/i);
  assert.match(loadGymFinanceDemoState({}, anchor).warning ?? "", /No se pudo leer/i);
  assert.match(persistGymFinanceDemoState({}, createGymFinanceDemoFixture(anchor)) ?? "", /No se pudieron guardar/i);
  const blocked = {
    getItem() { throw new Error("private bytes"); },
    setItem() { throw new Error("quota"); },
  };
  assert.match(loadGymFinanceDemoState(blocked, anchor).warning ?? "", /No se pudo leer/i);
  assert.match(persistGymFinanceDemoState(blocked, createGymFinanceDemoFixture(anchor)) ?? "", /No se pudieron guardar/i);
});

test("invalid trusted anchors fail closed rather than returning an invalid fixture as a successful fallback", () => {
  assert.throws(() => deserializeGymFinanceDemoState(null, "not-a-date"), /Invalid trusted GYM finance fixture configuration/);
  assert.throws(() => deserializeGymFinanceDemoState("{bad", "not-a-date"), /Invalid trusted GYM finance fixture configuration/);
});
