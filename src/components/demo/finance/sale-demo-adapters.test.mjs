import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { financeCatalogSaleActors } from "./catalog-sales-contract.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { updateCatalogProduct } from "./catalog-sales-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createFinanceDemoFixture } from "./finance-demo-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { isValidFinanceDemoState, resolveFinanceDemoInitialState } from "./finance-demo-storage.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createSaleDemoCallbackFactory, projectSaleDemoCatalog } from "./sale-demo-adapters.ts";

const today = { today: () => "2030-06-03" };

function factory(initialState = createFinanceDemoFixture("2030-06-03"), overrides = {}) {
  let state = initialState;
  let commits = 0;
  const callback = createSaleDemoCallbackFactory({
    getState: () => state,
    commit: (next) => {
      commits += 1;
      state = next;
    },
    fixedActor: financeCatalogSaleActors.admin,
    datePolicy: today,
    ...overrides,
  });
  return {
    callback,
    get state() { return state; },
    set state(next) { state = next; },
    get commits() { return commits; },
  };
}

function sale(productId = "finance-product-water", quantity = 1, unitAmount = 15, options = {}) {
  return [productId, quantity, unitAmount, {
    soldAtStr: "2030-06-03",
    paymentMethod: "EFECTIVO",
    ...options,
  }];
}

test("sale catalog exposes active current DTOs to known Caja staff only", () => {
  const state = createFinanceDemoFixture("2030-06-03");
  const initial = projectSaleDemoCatalog(state, financeCatalogSaleActors.admin);
  assert.deepEqual(initial[0], {
    id: "finance-product-water",
    code: 1,
    description: "Agua mineral",
    salePrice: 15,
    stock: 12,
    categoryName: "Bebidas",
  });
  for (const actor of [
    financeCatalogSaleActors.admin,
    financeCatalogSaleActors.unprivilegedAdmin,
    financeCatalogSaleActors.teacher,
  ]) assert.equal(projectSaleDemoCatalog(state, actor).length, 2);
  for (const actor of [
    { id: "unknown", role: "ADMIN" },
    { id: financeCatalogSaleActors.unprivilegedAdmin.id, role: "ADMIN", canViewRevenue: true },
    { id: financeCatalogSaleActors.teacher.id, role: "STUDENT" },
    { id: financeCatalogSaleActors.admin.id, role: "ADMIN", gymKind: "PERSONAL" },
  ]) assert.deepEqual(projectSaleDemoCatalog(state, actor), []);

  const deleted = { ...state, products: state.products.map((product) => product.id === "finance-product-water" ? { ...product, deletedAt: state.anchor } : product) };
  assert.equal(projectSaleDemoCatalog(deleted, financeCatalogSaleActors.admin).some((product) => product.id === "finance-product-water"), false);
});

test("sale callback validates the display boundary and commits atomic stock snapshots", async () => {
  const fixture = factory();
  for (const unitAmount of [-1, Number.NaN, Infinity, 1.001]) {
    const before = fixture.state;
    assert.deepEqual(await fixture.callback(...sale("finance-product-water", 1, unitAmount)), { success: false, error: "El importe unitario no es válido." });
    assert.equal(fixture.state, before);
  }
  assert.deepEqual(await fixture.callback(...sale("finance-product-water", 1, 0)), { success: true });
  assert.deepEqual(await fixture.callback(...sale("finance-product-water", 1, 1.1, { paymentMethod: "TRANSFERENCIA" })), { success: true });
  assert.deepEqual(await fixture.callback(...sale("finance-product-water", 0, 1)), { success: false, error: "La cantidad no es válida." });
  assert.deepEqual(await fixture.callback(...sale("finance-product-water", 1.5, 1)), { success: false, error: "La cantidad no es válida." });
  assert.deepEqual(await fixture.callback(...sale("finance-product-water", 2_147_483_648, 1)), { success: false, error: "La cantidad no es válida." });
  assert.deepEqual(await fixture.callback(...sale("finance-product-water", 2, 9_999_999_999.99)), { success: false, error: "El importe total no es válido." });
  assert.deepEqual(fixture.state.sales.map((record) => [record.unitAmountCents, record.totalAmountCents, record.paymentMethod]), [
    [0, 0, "EFECTIVO"], [110, 110, "TRANSFERENCIA"],
  ]);
  assert.equal(fixture.state.products.find((product) => product.id === "finance-product-water")?.stock, 10);

  const beforeManualStock = fixture.state;
  const manual = updateCatalogProduct(beforeManualStock, {
    id: "manual-stock", actor: financeCatalogSaleActors.admin, productId: "finance-product-water", stock: 99,
  });
  assert.equal(manual.result.success, true);
  fixture.state = manual.state;
  assert.deepEqual(await fixture.callback(...sale("finance-product-water", 100, 1.1, { paymentMethod: "TARJETA" })), { success: true });
  assert.equal(fixture.state.products.find((product) => product.id === "finance-product-water")?.stock, -1);
  assert.equal(fixture.state.sales.at(-1)?.totalAmountCents, 11_000, "negative projected stock is a warning, never a block");

  const changedPrice = updateCatalogProduct(fixture.state, {
    id: "change-price", actor: financeCatalogSaleActors.admin, productId: "finance-product-water", priceCents: 4_200,
  });
  fixture.state = changedPrice.state;
  assert.equal(fixture.state.sales[1]?.unitAmountCents, 110, "sale snapshots survive later product price edits");
});

test("sale core independently rejects stale products and invalid or future Argentina dates", async () => {
  const fixture = factory();
  const before = fixture.state;
  assert.deepEqual(await fixture.callback(...sale("missing", 1, 1)), { success: false, error: "Producto no encontrado." });
  assert.equal(fixture.state, before);
  assert.deepEqual(await fixture.callback(...sale("finance-product-water", 1, 1, { soldAtStr: "2030-06-04" })), { success: false, error: "La fecha de la venta no puede ser futura." });
  assert.deepEqual(await fixture.callback(...sale("finance-product-water", 1, 1, { soldAtStr: "2030-02-30" })), { success: false, error: "La venta no es válida." });
  for (const paymentMethod of ["EFECTIVO", "TRANSFERENCIA", "TARJETA", "MERCADO_PAGO"]) {
    assert.deepEqual(await fixture.callback(...sale("finance-product-wrist-wraps", 1, 1, { paymentMethod })), { success: true });
  }
  assert.equal(fixture.state.sales.length, 4);
});

test("IDs are reserved, failures are immutable, repeated settled sales remain valid, and reentry debits once", async () => {
  let sequence = 0;
  const fixture = factory(createFinanceDemoFixture("2030-06-03"), {
    nextId: (kind) => `${kind}-test-${++sequence}`,
  });
  const invalid = await fixture.callback(...sale("missing", 1, 1));
  assert.deepEqual(invalid, { success: false, error: "Producto no encontrado." });
  assert.equal(fixture.commits, 0);
  const first = fixture.callback(...sale());
  const sameInFlight = fixture.callback(...sale());
  const otherInFlight = fixture.callback(...sale("finance-product-wrist-wraps"));
  assert.equal(first, sameInFlight, "the same logical callback shares its pending result");
  assert.deepEqual(await otherInFlight, { success: false, error: "Hay una venta en curso. Esperá un momento." });
  assert.deepEqual(await first, { success: true });
  assert.deepEqual(await fixture.callback(...sale()), { success: true }, "a later identical sale is a new legitimate record");
  assert.equal(fixture.commits, 2);
  assert.deepEqual(fixture.state.sales.map((record) => record.id), ["sale-test-3", "sale-test-5"], "failed allocations remain reserved for the factory lifetime");
});

test("sales preserve the validated v2 payment, due, catalog, and historical graph across storage restore", async () => {
  const state = createFinanceDemoFixture("2030-06-03", {
    fictionalSeedPayments: [{
      studentId: "fee-student-juan",
      amountCents: 4_000,
      paidAt: "2030-06-02",
      nextPaymentDate: "2030-07-02",
      paymentMethod: "MERCADO_PAGO",
      recordedById: financeCatalogSaleActors.admin.id,
    }],
  });
  const beforePayments = state.payments.map((payment) => ({ ...payment }));
  const beforeStudents = state.students.map((student) => ({ ...student, assignedTeachers: [...student.assignedTeachers] }));
  const fixture = factory(state);
  assert.deepEqual(await fixture.callback(...sale()), { success: true });
  assert.deepEqual(fixture.state.payments, beforePayments);
  assert.deepEqual(fixture.state.students, beforeStudents);
  assert.equal(isValidFinanceDemoState(fixture.state), true);
  const restored = resolveFinanceDemoInitialState(JSON.stringify(fixture.state), createFinanceDemoFixture("2030-01-01"));
  assert.equal(restored.warning, null);
  assert.deepEqual(restored.state, fixture.state, "v2 storage retains payment, due, catalog, stock, and sales data together");
});

test("restored sale IDs are collision-checked without parsing persisted suffixes", async () => {
  const base = createFinanceDemoFixture("2030-06-03");
  const state = {
    ...base,
    sales: [{
      id: "sale-sale-local-1",
      commandId: "sale-command-local-1",
      productId: "finance-product-water",
      quantity: 1,
      unitAmountCents: 100,
      totalAmountCents: 100,
      paymentMethod: "EFECTIVO",
      soldAt: "2030-06-03",
      recordedById: financeCatalogSaleActors.admin.id,
    }],
  };
  const fixture = factory(state);
  assert.deepEqual(await fixture.callback(...sale()), { success: true });
  assert.deepEqual(fixture.state.sales.at(-1)?.id, "sale-sale-local-2");
  assert.deepEqual(fixture.state.sales.at(-1)?.commandId, "sale-command-local-2");
});

test("execution reads current state and reset cancels a scheduled sale without stale commit", async () => {
  const fixture = factory();
  const pending = fixture.callback(...sale("finance-product-water", 1, 15));
  fixture.state = {
    ...fixture.state,
    products: fixture.state.products.map((product) => product.id === "finance-product-water" ? { ...product, stock: 1, priceCents: 999_999 } : product),
  };
  assert.deepEqual(await pending, { success: true });
  assert.equal(fixture.state.products.find((product) => product.id === "finance-product-water")?.stock, 0, "execution reads stock at commit time");
  assert.equal(fixture.state.sales[0]?.unitAmountCents, 1_500, "submitted unit snapshot stays independent from current product price");

  const resetFixture = factory();
  const resetPending = resetFixture.callback(...sale());
  resetFixture.callback.cancelPendingSale();
  assert.deepEqual(await resetPending, { success: false, error: "La venta fue restablecida antes de registrarse." });
  assert.equal(resetFixture.commits, 0);
});
