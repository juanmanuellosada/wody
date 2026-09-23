import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { financeCatalogSaleActors } from "./catalog-sales-contract.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createFinanceDemoFixture } from "./finance-demo-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { serializeFinanceDemoState } from "./finance-demo-storage.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { projectDemoRevenue } from "./revenue-demo-projection.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { deleteDemoPayment, deleteDemoSale, updateDemoPayment, updateDemoSale } from "./revenue-demo-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { parseDemoRevenueFilters } from "./revenue-demo-contract.ts";

const admin = financeCatalogSaleActors.admin;
const unprivilegedAdmin = financeCatalogSaleActors.unprivilegedAdmin;
const teacher = financeCatalogSaleActors.teacher;
const today = "2025-03-15";

function sale(id, productId, totalAmountCents, soldAt, paymentMethod = "EFECTIVO", recordedById = admin.id) {
  return {
    id,
    commandId: `${id}-command`,
    productId,
    quantity: 1,
    unitAmountCents: totalAmountCents,
    totalAmountCents,
    paymentMethod,
    soldAt,
    recordedById,
  };
}

function payment(id, studentId, amountCents, paidAt, paymentMethod = "EFECTIVO") {
  return {
    id,
    commandId: `${id}-command`,
    studentId,
    amountCents,
    paidAt,
    nextPaymentDate: "2025-04-01",
    paymentMethod,
    recordedById: admin.id,
  };
}

function expense(id, amountCents, spentAt) {
  return { id, amountCents, description: `Expense ${id}`, spentAt, recordedById: admin.id };
}

function reportState() {
  const base = createFinanceDemoFixture(today);
  return {
    ...base,
    payments: [
      payment("payment-current", "fee-student-lucas", 10_000, "2025-03-10"),
      payment("payment-previous", "fee-student-juan", 4_000, "2025-02-01"),
    ],
    sales: [
      sale("sale-current", "finance-product-water", 600, "2025-03-10"),
      sale("sale-previous", "finance-product-wrist-wraps", 500, "2025-02-01"),
    ],
    expenses: [expense("expense-current", 400, "2025-03-10"), expense("expense-previous", 1_000, "2025-02-01")],
  };
}

function assertReport(result) {
  assert.equal(result.success, true, result.success ? "" : result.error);
  return result;
}

test("filter parser retains Caja query names, independent month fallbacks, and rejects calendar or range errors", () => {
  assert.deepEqual(parseDemoRevenueFilters({}, today), {
    ok: true,
    filters: { revenueView: "alumnos", from: "2025-03-01", to: "2025-03-31", methods: [], teacherIds: [], studentType: "", categoryId: "" },
  });
  const parsed = parseDemoRevenueFilters({
    revenueView: "mixta",
    statsFrom: "not-a-date",
    statsTo: "2025-03-20",
    statsMethods: "TARJETA,NOPE,TARJETA,EFECTIVO",
    statsTeacherIds: "teacher-a,,teacher-a,teacher-b",
    statsStudentType: "GENERAL",
    statsCategoryId: " category-a ",
    ignoredLegacyFilter: "ignored",
  }, today);
  assert.deepEqual(parsed, {
    ok: true,
    filters: {
      revenueView: "mixta", from: "2025-03-01", to: "2025-03-20",
      methods: ["TARJETA", "TARJETA", "EFECTIVO"], teacherIds: ["teacher-a", "teacher-a", "teacher-b"],
      studentType: "GENERAL", categoryId: "category-a",
    },
  });
  assert.deepEqual(parseDemoRevenueFilters({ statsFrom: "2025-02-30" }, today), { ok: false, error: "El período no es válido." });
  assert.deepEqual(parseDemoRevenueFilters({ statsFrom: "2024-02-29", statsTo: "2024-02-30" }, today), { ok: false, error: "El período no es válido." });
  assert.deepEqual(parseDemoRevenueFilters({ statsFrom: "2025-03-31", statsTo: "2025-03-01" }, today), { ok: false, error: "El período no es válido." });
  assert.deepEqual(parseDemoRevenueFilters({ statsFrom: "0001-01-01", statsTo: "0099-12-31" }, "0096-02-10"), {
    ok: true,
    filters: { revenueView: "alumnos", from: "0001-01-01", to: "0099-12-31", methods: [], teacherIds: [], studentType: "", categoryId: "" },
  });
  assert.deepEqual(parseDemoRevenueFilters({}, "0096-02-10"), {
    ok: true,
    filters: { revenueView: "alumnos", from: "0096-02-01", to: "0096-02-29", methods: [], teacherIds: [], studentType: "", categoryId: "" },
  });
  assert.deepEqual(parseDemoRevenueFilters({}, "0099-02-29"), { ok: false, error: "La fecha actual no es válida." });
});

test("reports retain integer-cent totals and same-millisecond previous ranges", () => {
  const state = reportState();
  const students = assertReport(projectDemoRevenue(state, admin, { revenueView: "alumnos", statsFrom: "2025-03-01", statsTo: "2025-03-31" }, today));
  assert.equal(students.view, "alumnos");
  assert.deepEqual(students.metrics, { totalCents: 10_000, count: 1, totalChange: 150, countChange: 0 });
  assert.deepEqual(students.paymentHistory.map((row) => row.paidAt), ["2025-03-10T00:00:00.000Z"]);

  const products = assertReport(projectDemoRevenue(state, admin, { revenueView: "productos", statsFrom: "2025-03-01", statsTo: "2025-03-31" }, today));
  assert.equal(products.view, "productos");
  assert.deepEqual(products.metrics, { totalCents: 600, count: 1, totalChange: 20, countChange: 0 });

  const mixed = assertReport(projectDemoRevenue(state, admin, { revenueView: "mixta", statsFrom: "2025-03-01", statsTo: "2025-03-31" }, today));
  assert.equal(mixed.view, "mixta");
  assert.equal(mixed.metrics.grossIncome.totalCents, 10_600);
  assert.equal(mixed.metrics.grossIncome.totalChange, 136);
  assert.equal(mixed.metrics.net.totalCents, 10_200);
  assert.equal(mixed.metrics.net.totalChange, 191);

  const longState = { ...state, payments: [...state.payments, payment("payment-jan29", "fee-student-juan", 1_000, "2025-01-29")] };
  const longRange = assertReport(projectDemoRevenue(longState, admin, { revenueView: "alumnos", statsFrom: "2025-03-01", statsTo: "2025-03-31" }, today));
  assert.equal(longRange.metrics.totalChange, 100, "previous range is Jan 29 through Feb 28, not February only");
});

test("view-specific filters preserve the live mixed-report asymmetry and historical relations", () => {
  const base = reportState();
  const state = {
    ...base,
    products: base.products.map((product) => product.id === "finance-product-water"
      ? { ...product, categoryId: "finance-category-accessories", deletedAt: "2025-03-11" }
      : product),
  };
  const query = {
    revenueView: "mixta", statsFrom: "2025-03-01", statsTo: "2025-03-31", statsMethods: "EFECTIVO",
    statsTeacherIds: "finance-teacher-carlos,finance-teacher-ana", statsStudentType: "GENERAL", statsCategoryId: "finance-category-drinks",
  };
  const mixed = assertReport(projectDemoRevenue(state, admin, query, today));
  assert.equal(mixed.view, "mixta");
  assert.equal(mixed.metrics.payments.totalCents, 10_000, "mixed cards ignore teacher/type");
  assert.equal(mixed.metrics.sales.totalCents, 600, "mixed cards ignore category");
  assert.equal(mixed.metrics.expenses.totalCents, 400, "methods never filter expenses");
  assert.equal(mixed.paymentHistory.length, 1, "mixed payment history applies teacher/type");
  assert.equal(mixed.saleHistory.length, 1, "mixed sale history does not apply category");
  assert.equal(mixed.saleHistory[0].categoryName, "Accesorios", "history resolves current category even for a soft-deleted product");
  assert.equal(mixed.saleHistory[0].recordedByName, "Administración demo");

  const products = assertReport(projectDemoRevenue(state, admin, { ...query, revenueView: "productos" }, today));
  assert.equal(products.view, "productos");
  assert.equal(products.metrics.totalCents, 0, "category filters only Productos");
});

test("monthly points stay sparse, percentage math supports negative prior net, and aggregation never loses cents", () => {
  const base = createFinanceDemoFixture(today);
  const sparse = {
    ...base,
    payments: [payment("jan", "fee-student-juan", 100, "2025-01-02"), payment("mar", "fee-student-juan", 300, "2025-03-02")],
    sales: [],
    expenses: [],
  };
  const students = assertReport(projectDemoRevenue(sparse, admin, { revenueView: "alumnos", statsFrom: "2025-01-01", statsTo: "2025-03-31" }, today));
  assert.equal(students.view, "alumnos");
  assert.deepEqual(students.evolution.map((point) => point.month), ["2025-01", "2025-03"]);

  const negativePrior = {
    ...base,
    payments: [payment("current", "fee-student-juan", 100, "2025-03-02")],
    sales: [],
    expenses: [expense("old", 200, "2025-02-02")],
  };
  const mixed = assertReport(projectDemoRevenue(negativePrior, admin, { revenueView: "mixta", statsFrom: "2025-03-01", statsTo: "2025-03-31" }, today));
  assert.equal(mixed.view, "mixta");
  assert.equal(mixed.metrics.net.totalChange, -150, "net percentage keeps the negative prior denominator");
  assert.equal(mixed.metrics.expenses.totalChange, -100);
  const deeperNegative = {
    ...base,
    payments: [],
    sales: [],
    expenses: [expense("current-negative", 900, "2025-03-02"), expense("prior-negative", 200, "2025-02-02")],
  };
  const negativeBoth = assertReport(projectDemoRevenue(deeperNegative, admin, { revenueView: "mixta", statsFrom: "2025-03-01", statsTo: "2025-03-31" }, today));
  assert.equal(negativeBoth.view, "mixta");
  assert.equal(negativeBoth.metrics.net.totalChange, 350, "signed previous net remains the percentage denominator");

  const overflow = {
    ...base,
    payments: Array.from({ length: 10_000 }, (_, index) => payment(`overflow-${index}`, "fee-student-juan", 999_999_999_999, "2025-03-02")),
  };
  assert.deepEqual(projectDemoRevenue(overflow, admin, { revenueView: "alumnos", statsFrom: "2025-03-01", statsTo: "2025-03-31" }, today), {
    success: false,
    error: "No se puede calcular el informe financiero con importes fuera de rango.",
  });
});

test("report authorization resolves the frozen roster before reading a financial graph", () => {
  const guarded = new Proxy({}, { get() { throw new Error("state must not be read"); } });
  for (const actor of [unprivilegedAdmin, teacher, { id: "finance-student", role: "STUDENT", canViewRevenue: true }, { id: "finance-access", role: "ACCESS", canViewRevenue: true }, { id: "outside", role: "ADMIN", canViewRevenue: true }, { ...admin, canViewRevenue: false }, { ...admin, role: "TEACHER" }, { ...admin, gymKind: "PERSONAL" }]) {
    assert.deepEqual(projectDemoRevenue(guarded, actor, {}, today), { success: false, error: "No autorizado." });
  }
  const hostileActor = new Proxy({}, {
    get(_target, property) {
      assert.equal(property, "id", "the frozen resolver reads only its first identity property before failing closed");
      throw new Error("hostile actor getter");
    },
    getPrototypeOf() { throw new Error("unused prototype trap"); },
  });
  assert.deepEqual(projectDemoRevenue(guarded, hostileActor, {}, today), { success: false, error: "No autorizado." });
  let deniedStateReads = 0;
  const matchingPrototypeTrap = new Proxy({ id: admin.id, role: "ADMIN", canViewRevenue: true, gymKind: "BOX" }, {
    getPrototypeOf() { throw new Error("actor prototype"); },
  });
  const deniedState = new Proxy({}, { get() { deniedStateReads += 1; throw new Error("denied actor must not read state"); } });
  assert.deepEqual(projectDemoRevenue(deniedState, matchingPrototypeTrap, {}, today), { success: false, error: "No autorizado." });
  assert.equal(deniedStateReads, 0);
  assert.throws(() => projectDemoRevenue(guarded, admin, {}, today), /state must not be read/, "authorized state failures are not masked by the actor boundary");
  assert.deepEqual(projectDemoRevenue(reportState(), admin, { statsFrom: "2025-02-30" }, today), { success: false, error: "El período no es válido." });
});

test("payment and sale history reducers are fixed-admin, closed, partial, and preserve unrelated snapshots", () => {
  const base = reportState();
  const updatedPayment = updateDemoPayment(base, { actor: unprivilegedAdmin, paymentId: "payment-current", amountCents: 12_345 });
  assert.deepEqual(updatedPayment.result, { success: true, id: "payment-current" });
  assert.equal(updatedPayment.state.payments[0].nextPaymentDate, base.payments[0].nextPaymentDate);
  assert.equal(updatedPayment.state.sales, base.sales);
  assert.equal(updateDemoPayment(base, { actor: teacher, paymentId: "payment-current", amountCents: 1 }).state, base);
  assert.deepEqual(deleteDemoPayment(base, { actor: admin, paymentId: "missing" }).result, { success: false, error: "Pago no encontrado." });
  const deletedPayment = deleteDemoPayment(updatedPayment.state, { actor: admin, paymentId: "payment-current" });
  assert.equal(deletedPayment.state.students, updatedPayment.state.students, "payment deletion does not recalculate dues");

  const editedSale = updateDemoSale(base, { actor: admin, saleId: "sale-current", quantity: 2, unitAmountCents: 700 });
  assert.deepEqual(editedSale.result, { success: true, id: "sale-current" });
  assert.deepEqual(editedSale.state.sales[0], { ...base.sales[0], quantity: 2, unitAmountCents: 700, totalAmountCents: 1_400 });
  assert.equal(editedSale.state.products, base.products, "sale corrections do not reconcile stock");
  assert.deepEqual(updateDemoSale(base, { actor: admin, saleId: "sale-current" }).result, { success: true, id: "sale-current" });
  for (const command of [
    { actor: admin, saleId: "sale-current", quantity: 0 },
    { actor: admin, saleId: "sale-current", unitAmountCents: null },
    { actor: admin, saleId: "sale-current", productId: "finance-product-water" },
  ]) assert.equal(updateDemoSale(base, command).state, base);
  assert.deepEqual(deleteDemoSale(base, { actor: admin, saleId: "missing" }).result, { success: false, error: "Venta no encontrada." });
  const deletedSale = deleteDemoSale(editedSale.state, { actor: unprivilegedAdmin, saleId: "sale-current" });
  assert.deepEqual(deletedSale.result, { success: true, id: "sale-current" });
  assert.equal(deletedSale.state.products, editedSale.state.products);
  assert.doesNotThrow(() => serializeFinanceDemoState(deletedSale.state), "successful transitions retain the closed valid v3 graph");
  const hostileActor = new Proxy({}, { get() { throw new Error("hostile actor getter"); } });
  const matchingPrototypeTrap = new Proxy({ id: admin.id, role: "ADMIN", canViewRevenue: true, gymKind: "BOX" }, {
    getPrototypeOf() { throw new Error("actor prototype"); },
  });
  const hundredState = { ...base, payments: base.payments.map((entry) => entry.id === "payment-current" ? { ...entry, amountCents: 100 } : entry) };
  for (const [state, operation] of [
    [base, () => updateDemoPayment(base, { actor: hostileActor, paymentId: "payment-current", amountCents: 1 })],
    [base, () => deleteDemoPayment(base, { actor: hostileActor, paymentId: "payment-current" })],
    [base, () => updateDemoSale(base, { actor: hostileActor, saleId: "sale-current" })],
    [base, () => deleteDemoSale(base, { actor: hostileActor, saleId: "sale-current" })],
    [hundredState, () => updateDemoPayment(hundredState, { actor: matchingPrototypeTrap, paymentId: "payment-current", amountCents: 1 })],
    [hundredState, () => updateDemoSale(hundredState, { actor: matchingPrototypeTrap, saleId: "sale-current", quantity: 2 })],
  ]) {
    const transition = operation();
    assert.equal(transition.state, state);
    assert.deepEqual(transition.result, { success: false, error: "No autorizado." });
  }
  assert.equal(hundredState.payments.find((entry) => entry.id === "payment-current")?.amountCents, 100);
  assert.equal(hundredState.sales.find((entry) => entry.id === "sale-current")?.quantity, 1);
});

test("known unprivileged sale recorders have a frozen presentation label but cannot project reports", () => {
  const base = reportState();
  const state = {
    ...base,
    sales: base.sales.map((entry) => entry.id === "sale-current" ? { ...entry, recordedById: unprivilegedAdmin.id } : entry),
  };
  const products = assertReport(projectDemoRevenue(state, admin, { revenueView: "productos", statsFrom: "2025-03-01", statsTo: "2025-03-31" }, today));
  assert.equal(products.view, "productos");
  assert.equal(products.saleHistory[0].recordedByName, "Administrador sin acceso a recaudación");
  const mixed = assertReport(projectDemoRevenue(state, admin, { revenueView: "mixta", statsFrom: "2025-03-01", statsTo: "2025-03-31" }, today));
  assert.equal(mixed.view, "mixta");
  assert.equal(mixed.saleHistory[0].recordedByName, "Administrador sin acceso a recaudación");
  assert.deepEqual(projectDemoRevenue(state, unprivilegedAdmin, {}, today), { success: false, error: "No autorizado." });
});

test("year-one previous ranges stay internal Gregorian UTC dates rather than Date.UTC's 1900 offset", () => {
  const result = assertReport(projectDemoRevenue(reportState(), admin, {
    revenueView: "alumnos",
    statsFrom: "0001-01-01",
    statsTo: "0001-01-01",
  }, "0096-02-10"));
  assert.equal(result.view, "alumnos");
  assert.equal(result.metrics.totalCents, 0);
  assert.equal(result.metrics.totalChange, null);
});
