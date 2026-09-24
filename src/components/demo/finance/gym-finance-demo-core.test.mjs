import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { getGymDemoActorToken, GYM_DEMO_ADMIN_ID, GYM_DEMO_PRIMARY_TEACHER_ID, GYM_DEMO_SECONDARY_TEACHER_ID } from "../scenarios/gym-demo-directory.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createGymFinanceDemoFixture, getGymFinancePeople } from "./gym-finance-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createFinanceDemoFixture, registerFinancePayment } from "./finance-demo-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createCatalogCategory, createCatalogProduct, deleteCatalogCategory, getCatalogProducts, registerCatalogSale, softDeleteCatalogProduct, updateCatalogCategory, updateCatalogProduct } from "./catalog-sales-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { registerFinanceExpense } from "./expense-demo-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { updateDemoPayment, updateDemoSale } from "./revenue-demo-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { projectDemoRevenue } from "./revenue-demo-projection.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { isValidGymFinanceDemoState } from "./finance-demo-storage.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { actorMatchesFinanceState, canManageFinanceCatalog, canReadFinanceRevenue, resolveFinanceDemoActor } from "./finance-demo-policy.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { updateFinanceExpense, deleteFinanceExpense } from "./expense-demo-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { deleteDemoPayment, deleteDemoSale } from "./revenue-demo-state.ts";

const anchor = "2030-06-03";
const admin = getGymDemoActorToken(GYM_DEMO_ADMIN_ID);
const tomas = getGymDemoActorToken(GYM_DEMO_PRIMARY_TEACHER_ID);
const nora = getGymDemoActorToken(GYM_DEMO_SECONDARY_TEACHER_ID);

function payment(actor, studentId, id = "gym-payment") {
  return { id, commandId: `${id}-command`, actor, studentId, amountInput: "1234,56", paidAt: anchor, nextPaymentDate: "2030-07-03", paymentMethod: "EFECTIVO", confirmedDuplicate: false };
}

const NO_AUTHORIZATION = { success: false, error: "No autorizado." };

function financeOperations(actor) {
  return [
    ["payment", (state) => registerFinancePayment(state, payment(actor, "gym-fixed-student-general", "cross-payment"))],
    ["create-category", (state) => createCatalogCategory(state, { id: "cross-category", actor, name: "Nueva" })],
    ["update-category", (state) => updateCatalogCategory(state, { id: "cross-category-update", actor, categoryId: "gym-finance-category-accessories", name: "Nueva" })],
    ["delete-category", (state) => deleteCatalogCategory(state, { id: "cross-category-delete", actor, categoryId: "gym-finance-category-accessories" })],
    ["create-product", (state) => createCatalogProduct(state, { id: "cross-product", actor, description: "Nuevo", categoryId: "gym-finance-category-accessories", priceCents: 100, stock: 1 })],
    ["update-product", (state) => updateCatalogProduct(state, { id: "cross-product-update", actor, productId: "gym-finance-product-band", description: "Nuevo" })],
    ["delete-product", (state) => softDeleteCatalogProduct(state, { id: "cross-product-delete", actor, productId: "gym-finance-product-band", deletedAt: anchor })],
    ["sale", (state) => registerCatalogSale(state, { id: "cross-sale", commandId: "cross-sale-command", actor, productId: "gym-finance-product-band", quantity: 1, unitAmountCents: 100, paymentMethod: "EFECTIVO", soldAt: anchor }, anchor)],
    ["create-expense", (state) => registerFinanceExpense(state, { id: "cross-expense", actor, description: "Insumos", amountCents: 100, spentAt: anchor }, anchor)],
    ["update-expense", (state) => updateFinanceExpense(state, { actor, expenseId: "cross-expense", description: "Insumos" })],
    ["delete-expense", (state) => deleteFinanceExpense(state, { actor, expenseId: "cross-expense" })],
    ["update-payment", (state) => updateDemoPayment(state, { actor, paymentId: "cross-payment", amountCents: 100 })],
    ["delete-payment", (state) => deleteDemoPayment(state, { actor, paymentId: "cross-payment" })],
    ["update-sale", (state) => updateDemoSale(state, { actor, saleId: "cross-sale", quantity: 1, unitAmountCents: 100 })],
    ["delete-sale", (state) => deleteDemoSale(state, { actor, saleId: "cross-sale" })],
    ["catalog-projection", (state) => getCatalogProducts(state, actor), true],
    ["revenue-projection", (state) => projectDemoRevenue(state, actor, {}, anchor)],
  ];
}

function hostileState(namespace, { preserveHeaders = false, ...options } = {}, base = createGymFinanceDemoFixture(anchor)) {
  const counts = { root: { get: 0, ownKeys: 0, descriptor: 0, prototype: 0 }, nested: 0 };
  const trap = (value) => new Proxy(value, {
    get() { counts.nested += 1; throw new Error("cross-namespace nested get"); },
    ownKeys() { counts.nested += 1; throw new Error("cross-namespace nested keys"); },
    getOwnPropertyDescriptor() { counts.nested += 1; throw new Error("cross-namespace nested descriptor"); },
    getPrototypeOf() { counts.nested += 1; throw new Error("cross-namespace nested prototype"); },
  });
  const state = {};
  for (const key of Reflect.ownKeys(base)) {
    const descriptor = Object.getOwnPropertyDescriptor(base, key);
    if (!descriptor) continue;
    if (["students", "payments", "categories", "products", "sales", "expenses"].includes(key) && "value" in descriptor) descriptor.value = trap(descriptor.value);
    Object.defineProperty(state, key, descriptor);
  }
  if (!preserveHeaders) Object.defineProperty(state, "namespace", { configurable: true, enumerable: true, writable: true, value: namespace });
  return {
    counts,
    state: new Proxy(state, {
      get(target, key, receiver) { counts.root.get += 1; return Reflect.get(target, key, receiver); },
      ownKeys(target) { counts.root.ownKeys += 1; return Reflect.ownKeys(target); },
      getOwnPropertyDescriptor(target, key) { counts.root.descriptor += 1; return Reflect.getOwnPropertyDescriptor(target, key); },
      getPrototypeOf(target) { counts.root.prototype += 1; return Reflect.getPrototypeOf(target); },
      ...options,
    }),
  };
}

function assertDeniedOutput(output, state, catalogProjection, label) {
  if (catalogProjection) assert.deepEqual(output, [], label);
  else if (!("result" in output)) assert.deepEqual(output, NO_AUTHORIZATION, label);
  else {
    assert.deepEqual(output.result, NO_AUTHORIZATION, label);
    assert.equal(output.state, state, `${label} preserves the original state`);
  }
}

function assertDeniedOperation(operation, state, catalogProjection, label) {
  assertDeniedOutput(operation(state), state, catalogProjection, label);
}

test("all 17 GYM finance entry points reject foreign namespaces with complete valid commands before nested reads", () => {
  for (const namespace of ["wody-box-finance-demo", "wody-personal-finance-demo", "unknown-finance-demo"]) {
    for (const [name, operation, catalogProjection] of financeOperations(admin)) {
      const { state, counts } = hostileState(namespace);
      assertDeniedOperation(operation, state, catalogProjection, `${name}/${namespace}`);
      assert.equal(counts.root.get, 0, `${name}/${namespace} root get`);
      assert.equal(counts.nested, 0, `${name}/${namespace} nested read`);
    }
  }
});

test("GYM header TOCTOU rejects the second BOX descriptor capture before child traversal", () => {
  for (const [name, operation, catalogProjection] of financeOperations(admin)) {
    const base = createGymFinanceDemoFixture(anchor);
    let headerGets = 0;
    let namespaceDescriptors = 0;
    let versionDescriptors = 0;
    Object.defineProperty(base, "namespace", { configurable: true, enumerable: true, get() { headerGets += 1; throw new Error("header getter must not run"); } });
    Object.defineProperty(base, "version", { configurable: true, enumerable: true, get() { headerGets += 1; throw new Error("header getter must not run"); } });
    const { state, counts } = hostileState("wody-gym-finance-demo", {
      preserveHeaders: true,
      get(target, key) { counts.root.get += 1; throw new Error(`root get ${String(key)}`); },
      getOwnPropertyDescriptor(target, key) {
        counts.root.descriptor += 1;
        if (key === "namespace") return { configurable: true, enumerable: true, writable: true, value: namespaceDescriptors++ === 0 ? "wody-gym-finance-demo" : "wody-box-finance-demo" };
        if (key === "version") return { configurable: true, enumerable: true, writable: true, value: versionDescriptors++ === 0 ? 1 : 3 };
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    }, base);
    // The root key list stays coherent while the second descriptor capture changes only its header values.
    assert.equal(headerGets, 0, `${name} setup does not invoke headers`);
    const output = operation(state);
    if (catalogProjection) assert.deepEqual(output, [], `${name} rejects the changed capture`);
    else if (name === "revenue-projection") assert.deepEqual(output, { success: false, error: "El estado financiero no es válido." }, `${name} reports an invalid captured graph`);
    else {
      assert.deepEqual(output.result, NO_AUTHORIZATION, `${name} rejects the changed capture`);
      assert.equal(output.state, state, `${name} preserves the original proxy after capture failure`);
    }
    assert.equal(headerGets, 0, `${name} never invokes a header getter`);
    assert.equal(counts.root.get, 0, `${name} never gets the source`);
    assert.ok(counts.root.ownKeys > 0, `${name} performs a coherent descriptor capture`);
    assert.equal(counts.nested, 0, `${name} rejects the header before child traversal`);
  }
});

test("all 17 BOX entry points reject a GYM namespace from the header alone, while unknown actors read no state", () => {
  const boxDesignatedAdmin = { id: "finance-admin", role: "ADMIN", canViewRevenue: true, gymKind: "BOX" };
  for (const [name, operation, catalogProjection] of financeOperations(boxDesignatedAdmin)) {
    const { state, counts } = hostileState("wody-gym-finance-demo");
    const output = operation(state);
    assert.equal(counts.root.get, 0, `${name}/BOX-to-GYM root get`);
    assert.equal(counts.root.ownKeys, 0, `${name}/BOX-to-GYM root keys`);
    assert.equal(counts.root.prototype, 0, `${name}/BOX-to-GYM root prototype`);
    assert.equal(counts.nested, 0, `${name}/BOX-to-GYM nested read`);
    assertDeniedOutput(output, state, catalogProjection, `${name}/BOX-to-GYM`);

    const unknown = { id: "unknown-finance-actor", role: "ADMIN", canViewRevenue: true, gymKind: "BOX" };
    const [, unknownOperation, unknownCatalogProjection] = financeOperations(unknown).find(([candidate]) => candidate === name);
    const unknownState = hostileState("wody-gym-finance-demo");
    const unknownOutput = unknownOperation(unknownState.state);
    assert.deepEqual(unknownState.counts.root, { get: 0, ownKeys: 0, descriptor: 0, prototype: 0 }, `${name}/unknown has no root access`);
    assert.equal(unknownState.counts.nested, 0, `${name}/unknown has no nested access`);
    assertDeniedOutput(unknownOutput, unknownState.state, unknownCatalogProjection, `${name}/unknown`);
  }
});

test("GYM revenue report captures validated positive payment, sale, and expense history without source gets", () => {
  let state = createGymFinanceDemoFixture(anchor);
  const recordedPayment = registerFinancePayment(state, payment(admin, state.students[0].id, "report-payment"), anchor);
  assert.deepEqual(recordedPayment.result, { success: true, paymentId: "report-payment", idempotent: false });
  state = recordedPayment.state;
  const recordedSale = registerCatalogSale(state, { id: "report-sale", commandId: "report-sale-command", actor: admin, productId: "gym-finance-product-band", quantity: 1, unitAmountCents: 100, paymentMethod: "EFECTIVO", soldAt: anchor }, anchor);
  assert.deepEqual(recordedSale.result, { success: true, id: "report-sale", idempotent: false, stockWarning: false });
  state = recordedSale.state;
  const recordedExpense = registerFinanceExpense(state, { id: "report-expense", actor: admin, description: "Luz", amountCents: 200, spentAt: anchor }, anchor);
  assert.deepEqual(recordedExpense.result, { success: true, id: "report-expense" });
  state = recordedExpense.state;
  let ownKeys = 0;
  const hostile = new Proxy(state, {
    get() { throw new Error("report source get"); },
    ownKeys(target) { ownKeys += 1; if (ownKeys > 2) throw new Error("third ownKeys"); return Reflect.ownKeys(target); },
  });
  const report = projectDemoRevenue(hostile, admin, { revenueView: "mixta", statsFrom: anchor, statsTo: anchor }, anchor);
  assert.equal(report.success, true);
  assert.equal(ownKeys, 2, "one GYM descriptor capture");
  if (report.success) {
    assert.deepEqual([report.metrics.payments.totalCents, report.metrics.sales.totalCents, report.metrics.expenses.totalCents], [123_456, 100, 200]);
    assert.deepEqual([report.paymentHistory.map((row) => row.id), report.saleHistory.map((row) => row.id), report.expenseHistory.map((row) => row.id)], [["report-payment"], ["report-sale"], ["report-expense"]]);
  }
});

test("GYM finance fixtures derive the independent active and archived matrix from the canonical directory", () => {
  const people = getGymFinancePeople(anchor);
  assert.equal(people.filter((student) => !student.deletedAt).length, 5);
  assert.equal(people.filter((student) => student.deletedAt).length, 1);
  assert.deepEqual(people.map((student) => [student.name, student.nextPaymentDate, student.accountKind, student.email]), [
    ["Paula Méndez", "2030-05-22", "FULL", "gym-fixed-student-general@finance-demo.invalid"],
    ["Irene Soto", "2030-06-06", "FULL", "gym-fixed-student-personalized@finance-demo.invalid"],
    ["Valeria Paz", "2030-06-18", "FULL", "gym-fixed-student-personalized-unlinked@finance-demo.invalid"],
    ["Micaela Torres", "2030-05-04", "FULL", "gym-fixed-student-muslib@finance-demo.invalid"],
    ["León Acosta", anchor, "LITE", null],
    ["Ariel Luna", "2030-04-19", "FULL", "gym-fixed-student-muslib-archived@finance-demo.invalid"],
  ]);
  const state = createGymFinanceDemoFixture(anchor);
  assert.equal(state.namespace, "wody-gym-finance-demo");
  assert.equal(state.version, 1);
  assert.equal(isValidGymFinanceDemoState(state), true);
});

test("GYM tokens use the closed shared policy for payments, catalog, sales, expenses, history, and reports", () => {
  let state = createGymFinanceDemoFixture(anchor);
  const paula = state.students[0].id;
  const valeria = state.students[2].id;
  const recorded = registerFinancePayment(state, payment(tomas, paula), anchor);
  assert.deepEqual(recorded.result, { success: true, paymentId: "gym-payment", idempotent: false });
  state = recorded.state;
  assert.deepEqual(registerFinancePayment(state, payment(nora, paula, "nora-payment"), anchor).result, { success: false, error: "Este alumno no está asignado a vos." });
  assert.deepEqual(registerFinancePayment(state, payment(tomas, valeria, "unlinked-payment"), anchor).result, { success: false, error: "Este alumno no está asignado a vos." });

  const category = createCatalogCategory(state, { id: "gym-category-new", actor: admin, name: "Entrenamiento" });
  assert.equal(category.result.success, true);
  state = category.state;
  const product = createCatalogProduct(state, { id: "gym-product-new", actor: admin, description: "Colchoneta", categoryId: "gym-category-new", priceCents: 5_000, stock: 2 });
  assert.equal(product.result.success, true);
  state = product.state;
  assert.equal(getCatalogProducts(state, tomas).some((entry) => entry.id === "gym-product-new"), true);
  assert.equal(createCatalogCategory(state, { id: "forbidden", actor: tomas, name: "No" }).result.success, false);

  const sale = registerCatalogSale(state, { id: "gym-sale", commandId: "gym-sale-command", actor: tomas, productId: "gym-product-new", quantity: 1, unitAmountCents: 5_000, paymentMethod: "TARJETA", soldAt: anchor }, anchor);
  assert.equal(sale.result.success, true);
  state = sale.state;
  const expense = registerFinanceExpense(state, { id: "gym-expense", actor: admin, amountCents: 250, description: "Limpieza", spentAt: anchor }, anchor);
  assert.equal(expense.result.success, true);
  state = expense.state;
  assert.equal(registerFinanceExpense(state, { id: "forbidden-expense", actor: tomas, amountCents: 1, description: "No", spentAt: anchor }, anchor).result.success, false);

  assert.equal(updateDemoPayment(state, { actor: admin, paymentId: "gym-payment", amountCents: 2_000 }).result.success, true);
  assert.equal(updateDemoSale(state, { actor: admin, saleId: "gym-sale", quantity: 2 }).result.success, true);
  const report = projectDemoRevenue(state, admin, { revenueView: "mixta" }, anchor);
  assert.equal(report.success, true);
  assert.deepEqual(projectDemoRevenue(state, tomas, {}, anchor), { success: false, error: "No autorizado." });
  assert.equal(isValidGymFinanceDemoState(state), true);
});

test("closed GYM snapshots reject hostile/unclosed graphs and policy helpers require resolver brands", () => {
  const state = createGymFinanceDemoFixture(anchor);
  const symbol = structuredClone(state);
  symbol[Symbol("extra")] = true;
  const nonEnumerable = structuredClone(state);
  Object.defineProperty(nonEnumerable, "hidden", { value: true });
  const customPrototype = Object.assign(Object.create({ inherited: true }), state);
  const accessor = structuredClone(state);
  Object.defineProperty(accessor, "anchor", { enumerable: true, get() { throw new Error("must not read"); } });
  const sparse = structuredClone(state);
  sparse.students = new Array(1);
  const cyclic = structuredClone(state);
  cyclic.self = cyclic;
  const revoked = Proxy.revocable(state, {});
  revoked.revoke();
  for (const value of [symbol, nonEnumerable, customPrototype, accessor, sparse, cyclic, revoked.proxy]) {
    assert.doesNotThrow(() => isValidGymFinanceDemoState(value));
    assert.equal(isValidGymFinanceDemoState(value), false);
  }

  const resolved = resolveFinanceDemoActor(admin);
  assert.equal(canManageFinanceCatalog(resolved), true);
  assert.equal(canReadFinanceRevenue(resolved), true);
  const forged = { ...resolved, role: "ADMIN", canViewRevenue: true };
  assert.equal(canManageFinanceCatalog(forged), false);
  assert.equal(actorMatchesFinanceState(forged, state), false);
  assert.equal(canManageFinanceCatalog(new Proxy(resolved, {})), false);
});

test("denied expense and history commands resolve only their actor descriptor before state or fields", () => {
  const state = createGymFinanceDemoFixture(anchor);
  const boxTeacher = { id: "finance-teacher-carlos", role: "TEACHER" };
  const calls = [];
  const command = (kind) => Object.defineProperty({ actor: boxTeacher }, "trap", {
    enumerable: true,
    get() { calls.push(kind); throw new Error("must not read denied command field"); },
  });
  const operations = [
    () => registerFinanceExpense(state, command("register-expense"), anchor),
    () => updateFinanceExpense(state, command("update-expense")),
    () => deleteFinanceExpense(state, command("delete-expense")),
    () => updateDemoPayment(state, command("update-payment")),
    () => deleteDemoPayment(state, command("delete-payment")),
    () => updateDemoSale(state, command("update-sale")),
    () => deleteDemoSale(state, command("delete-sale")),
  ];
  for (const operation of operations) assert.equal(operation().result.success, false);
  assert.deepEqual(calls, []);
});

test("GYM historical archived payments remain valid and reportable while new archived payments stay denied", () => {
  const state = createGymFinanceDemoFixture(anchor);
  const archived = state.students.find((student) => student.deletedAt);
  const historical = {
    ...state,
    payments: [{ id: "archived-payment", commandId: "archived-command", studentId: archived.id, amountCents: 777, paidAt: anchor, nextPaymentDate: anchor, paymentMethod: "EFECTIVO", recordedById: GYM_DEMO_ADMIN_ID }],
  };
  assert.equal(isValidGymFinanceDemoState(historical), true);
  const report = projectDemoRevenue(historical, admin, { revenueView: "alumnos" }, anchor);
  assert.equal(report.success, true);
  if (report.success) {
    assert.equal(report.metrics.totalCents, 777);
    assert.deepEqual(report.paymentHistory.map((row) => row.id), ["archived-payment"]);
  }
  assert.deepEqual(registerFinancePayment(historical, payment(admin, archived.id, "new-archived"), anchor).result, { success: false, error: "Alumno no encontrado." });
});

test("cross-namespace actors, copied tokens, and denied tokens fail before GYM state reads", () => {
  const gymState = createGymFinanceDemoFixture(anchor);
  const boxState = createFinanceDemoFixture(anchor);
  const boxAdmin = { id: "finance-admin", role: "ADMIN" };
  assert.deepEqual(registerFinancePayment(gymState, payment(boxAdmin, gymState.students[0].id), anchor).result, { success: false, error: "No autorizado." });
  assert.deepEqual(registerFinancePayment(boxState, payment(admin, boxState.students[0].id), anchor).result, { success: false, error: "No autorizado." });
  assert.deepEqual(registerFinancePayment(gymState, payment(Object.freeze({}), gymState.students[0].id), anchor).result, { success: false, error: "No autorizado." });
  assert.deepEqual(projectDemoRevenue(gymState, { id: GYM_DEMO_ADMIN_ID, role: "ADMIN" }, {}, anchor), { success: false, error: "No autorizado." });
});
