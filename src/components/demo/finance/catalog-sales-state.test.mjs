import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { financeCatalogSaleActors } from "./catalog-sales-contract.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import {
  canManageCatalog,
  canReadCatalog,
  createCatalogCategory,
  createCatalogProduct,
  deleteCatalogCategory,
  registerCatalogSale,
  softDeleteCatalogProduct,
  updateCatalogCategory,
  updateCatalogProduct,
} from "./catalog-sales-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createFinanceDemoFixture } from "./finance-demo-state.ts";

const today = "2030-06-03";
const admin = financeCatalogSaleActors.admin;
const teacher = financeCatalogSaleActors.teacher;
const unprivilegedAdmin = financeCatalogSaleActors.unprivilegedAdmin;

function productCommand(overrides = {}) {
  return {
    id: "product-new",
    actor: admin,
    description: "Barra proteica",
    categoryId: "finance-category-drinks",
    priceCents: 4_250,
    stock: 8,
    ...overrides,
  };
}

function saleCommand(overrides = {}) {
  return {
    id: "sale-1",
    commandId: "sale-command-1",
    actor: teacher,
    productId: "finance-product-water",
    quantity: 2,
    unitAmountCents: 1_500,
    paymentMethod: "EFECTIVO",
    soldAt: today,
    ...overrides,
  };
}

function expectFailure(state, operation, expected = /./) {
  const transition = operation();
  assert.equal(transition.state, state);
  assert.equal(transition.result.success, false);
  assert.match(transition.result.error, expected);
}

test("catalog policy keeps management with the designated admin while all fixed staff can sell", () => {
  assert.equal(Object.isFrozen(financeCatalogSaleActors), true);
  assert.equal(Object.isFrozen(financeCatalogSaleActors.unprivilegedAdmin), true);
  assert.throws(() => { financeCatalogSaleActors.unprivilegedAdmin.canViewRevenue = true; }, TypeError);
  assert.equal(canManageCatalog({ id: unprivilegedAdmin.id, role: "ADMIN" }), false);
  assert.equal(canManageCatalog(admin), true);
  assert.equal(canManageCatalog(teacher), false);
  assert.equal(canManageCatalog(unprivilegedAdmin), false);
  assert.equal(canReadCatalog(admin), true);
  assert.equal(canReadCatalog(teacher), true);
  assert.equal(canReadCatalog(unprivilegedAdmin), true);

  const state = createFinanceDemoFixture(today);
  for (const actor of [
    { id: teacher.id, role: "ADMIN" },
    { id: unprivilegedAdmin.id, role: "ADMIN", canViewRevenue: true },
    { id: admin.id, role: "ADMIN", gymKind: "PERSONAL" },
    { id: "outside", role: "ADMIN" },
    { id: admin.id, role: "STUDENT" },
  ]) {
    expectFailure(state, () => createCatalogCategory(state, { id: "category-spoof", actor, name: "Suplementos" }), /autorizado/);
  }
  const sale = registerCatalogSale(state, saleCommand({ actor: unprivilegedAdmin }), today);
  assert.equal(sale.result.success, true);
});

test("category and product CRUD enforce closed category relations, active codes, and absolute stock", () => {
  let state = createFinanceDemoFixture(today);
  const category = createCatalogCategory(state, { id: "category-bars", actor: admin, name: " Barras " });
  assert.equal(category.result.success, true);
  state = category.state;
  expectFailure(state, () => createCatalogCategory(state, { id: "category-duplicate", actor: admin, name: "Barras" }), /ya existe/);

  const automatic = createCatalogProduct(state, productCommand({ categoryId: "category-bars" }));
  assert.deepEqual(automatic.result, { success: true, id: "product-new", code: 3 });
  state = automatic.state;
  assert.equal(state.nextProductCode, 4);
  expectFailure(state, () => createCatalogProduct(state, productCommand({ id: "product-duplicate", code: 3 })), /[Yy]a existe/);
  state = updateCatalogProduct(state, { id: "edit-stock", actor: admin, productId: "product-new", stock: -7 }).state;
  assert.equal(state.products.find((product) => product.id === "product-new")?.stock, -7, "stock edits are absolute, not sale-log reconciliation");

  const removed = softDeleteCatalogProduct(state, { id: "delete-product", actor: admin, productId: "product-new", deletedAt: today });
  assert.equal(removed.result.success, true);
  state = removed.state;
  expectFailure(state, () => deleteCatalogCategory(state, { id: "delete-category", actor: admin, categoryId: "category-bars" }), /productos asociados/);
  const reused = createCatalogProduct(state, productCommand({ id: "product-reused-code", categoryId: "category-bars", code: 3 }));
  assert.equal(reused.result.success, true, "soft deletion releases only the active unique code");

  const renamed = updateCatalogCategory(reused.state, { id: "rename-category", actor: admin, categoryId: "category-bars", name: " Barras de proteína " });
  assert.equal(renamed.state.categories.find((item) => item.id === "category-bars")?.name, "Barras de proteína");
  expectFailure(renamed.state, () => updateCatalogCategory(renamed.state, { id: "duplicate-category", actor: admin, categoryId: "category-bars", name: " Bebidas " }), /ya existe/);
});

test("automatic codes resync from active maximum after a collision without changing manual-code semantics", () => {
  let state = createFinanceDemoFixture(today);
  state = createCatalogProduct(state, productCommand({ id: "manual-three", code: 3 })).state;
  const recovered = createCatalogProduct(state, productCommand({ id: "recovered-auto" }));
  assert.deepEqual(recovered.result, { success: true, id: "recovered-auto", code: 4 });
  assert.equal(recovered.state.nextProductCode, 5);

  state = createCatalogProduct(createFinanceDemoFixture(today), productCommand({ id: "manual-high", code: 99 })).state;
  const ordinaryAuto = createCatalogProduct(state, productCommand({ id: "auto-after-high" }));
  assert.deepEqual(ordinaryAuto.result, { success: true, id: "auto-after-high", code: 3 });
  assert.equal(ordinaryAuto.state.nextProductCode, 4, "manual codes do not advance the counter before a collision");

  const withDeletedHigh = softDeleteCatalogProduct(
    createCatalogProduct(createFinanceDemoFixture(today), productCommand({ id: "manual-deleted-high", code: 99 })).state,
    { id: "delete-high", actor: admin, productId: "manual-deleted-high", deletedAt: today },
  ).state;
  const recoveredWithoutDeleted = createCatalogProduct(
    createCatalogProduct(withDeletedHigh, productCommand({ id: "manual-three-again", code: 3 })).state,
    productCommand({ id: "auto-after-deleted-high" }),
  );
  assert.deepEqual(recoveredWithoutDeleted.result, { success: true, id: "auto-after-deleted-high", code: 4 });

  const exhausted = { ...createFinanceDemoFixture(today), nextProductCode: 2_147_483_647 };
  expectFailure(exhausted, () => createCatalogProduct(exhausted, productCommand({ id: "overflow-auto" })), /contador/);
});

test("sales atomically snapshot money and decrement stock without blocking zero or negative inventory", () => {
  const state = createFinanceDemoFixture(today);
  const registered = registerCatalogSale(state, saleCommand({ quantity: 12, unitAmountCents: 0 }), today);
  assert.deepEqual(registered.result, { success: true, id: "sale-1", idempotent: false, stockWarning: true });
  assert.equal(registered.state.products.find((product) => product.id === "finance-product-water")?.stock, 0);
  assert.deepEqual(registered.state.sales[0], {
    id: "sale-1",
    commandId: "sale-command-1",
    productId: "finance-product-water",
    quantity: 12,
    unitAmountCents: 0,
    totalAmountCents: 0,
    paymentMethod: "EFECTIVO",
    soldAt: today,
    recordedById: teacher.id,
  });

  const afterEdit = updateCatalogProduct(registered.state, { id: "edit-product", actor: admin, productId: "finance-product-water", description: "Agua editada", priceCents: 9_999 }).state;
  const afterDelete = softDeleteCatalogProduct(afterEdit, { id: "delete-water", actor: admin, productId: "finance-product-water", deletedAt: today }).state;
  assert.deepEqual(afterDelete.sales, registered.state.sales, "sales retain only persisted monetary snapshots");

  const replay = registerCatalogSale(afterDelete, saleCommand({ quantity: 12, unitAmountCents: 0 }), today);
  assert.deepEqual(replay.result, { success: true, id: "sale-1", idempotent: true });
  assert.equal(replay.state, afterDelete, "a deleted product keeps exact sale-command replay history");
  expectFailure(registered.state, () => registerCatalogSale(registered.state, saleCommand({ quantity: 2 }), today), /identificador del comando/);
});

test("invalid sales never partially change stock or history, including integer and decimal boundaries", () => {
  const state = createFinanceDemoFixture(today);
  for (const command of [
    saleCommand({ quantity: 0 }),
    saleCommand({ quantity: 1.5 }),
    saleCommand({ quantity: 2_147_483_648 }),
    saleCommand({ unitAmountCents: -1 }),
    saleCommand({ unitAmountCents: 1_000_000_000_000 }),
    saleCommand({ quantity: 2_147_483_647, unitAmountCents: 999_999_999_999 }),
    saleCommand({ paymentMethod: "CHEQUE" }),
    saleCommand({ soldAt: "2030-06-04" }),
    saleCommand({ productId: "missing" }),
  ]) {
    expectFailure(state, () => registerCatalogSale(state, command, today));
  }
  const underflow = {
    ...state,
    products: state.products.map((product) => product.id === "finance-product-water" ? { ...product, stock: -2_147_483_648 } : product),
  };
  expectFailure(underflow, () => registerCatalogSale(underflow, saleCommand({ quantity: 1 }), today), /stock/);
});
