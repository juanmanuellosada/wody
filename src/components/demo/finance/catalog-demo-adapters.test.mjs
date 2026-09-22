import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { financeCatalogSaleActors } from "./catalog-sales-contract.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createCatalogDemoCallbackFactory, projectCatalogDemoManagement } from "./catalog-demo-adapters.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createFinanceDemoFixture } from "./finance-demo-state.ts";

const anchor = "2030-06-03";
const admin = financeCatalogSaleActors.admin;

function createFactory(state, overrides = {}) {
  let commits = 0;
  const callbacks = createCatalogDemoCallbackFactory({
    getState: () => state,
    commit: (next) => {
      commits += 1;
      state = next;
    },
    actor: admin,
    ...overrides,
  });
  return {
    callbacks,
    get state() { return state; },
    get commits() { return commits; },
  };
}

function productInput(overrides = {}) {
  return {
    description: "Barra proteica",
    categoryId: "finance-category-drinks",
    salePrice: 1.1,
    stock: -3,
    ...overrides,
  };
}

test("catalog callbacks map the extracted view contracts and commit only complete successful transitions", async () => {
  const fixture = createFactory(createFinanceDemoFixture(anchor));
  const beforeInvalid = fixture.state;
  assert.deepEqual(
    await fixture.callbacks.createProduct(productInput({ salePrice: 1.001 })),
    { success: false, error: "El precio no es válido." },
  );
  assert.equal(fixture.state, beforeInvalid);
  assert.equal(fixture.commits, 0);

  assert.deepEqual(
    await fixture.callbacks.createCategory(" Suplementos "),
    { success: true, category: { id: "catalog-category-local-1", name: "Suplementos" } },
  );
  assert.deepEqual(
    await fixture.callbacks.createProduct(productInput({ categoryId: "catalog-category-local-1", salePrice: 0, stock: -2 })),
    { success: true, code: 3 },
  );
  const product = fixture.state.products.find((item) => item.id === "catalog-product-local-1");
  assert.deepEqual(
    { priceCents: product?.priceCents, stock: product?.stock },
    { priceCents: 0, stock: -2 },
    "zero prices and negative absolute stock cross the view boundary unchanged",
  );

  assert.deepEqual(
    await fixture.callbacks.updateProduct("catalog-product-local-1", productInput({ categoryId: "catalog-category-local-1", salePrice: 1.1, stock: -7, code: 33 })),
    { success: true },
  );
  assert.deepEqual(
    { priceCents: fixture.state.products.find((item) => item.id === "catalog-product-local-1")?.priceCents, stock: fixture.state.products.find((item) => item.id === "catalog-product-local-1")?.stock },
    { priceCents: 110, stock: -7 },
    "the 1.1 JavaScript representation is accepted as 110 cents without rounding a third decimal",
  );
  assert.deepEqual(await fixture.callbacks.deleteProduct("catalog-product-local-1"), { success: true });
  assert.equal(fixture.state.products.find((item) => item.id === "catalog-product-local-1")?.deletedAt, anchor);

  const beforeCategoryDelete = fixture.state;
  assert.match((await fixture.callbacks.deleteCategory("catalog-category-local-1")).error, /productos asociados/);
  assert.equal(fixture.state, beforeCategoryDelete, "category deletion remains blocked by a soft-deleted product");
  assert.equal(fixture.commits, 4);
});

test("factory reads the current validated v2 state, rejects permission spoofing, and exposes active DTOs only", async () => {
  const state = createFinanceDemoFixture(anchor);
  const spoofedAdmin = { id: financeCatalogSaleActors.unprivilegedAdmin.id, role: "ADMIN", canViewRevenue: true };
  for (const actor of [financeCatalogSaleActors.teacher, financeCatalogSaleActors.unprivilegedAdmin, spoofedAdmin, { id: "unknown", role: "ADMIN" }]) {
    assert.equal(projectCatalogDemoManagement(state, actor), null);
  }
  assert.equal(projectCatalogDemoManagement({ ...state, version: 1 }, admin), null, "v1 or arbitrary fallback state cannot project management data");

  const unauthorized = createFactory(state, { actor: spoofedAdmin });
  assert.deepEqual(await unauthorized.callbacks.createCategory("No permitida"), { success: false, error: "No autorizado." });
  assert.equal(unauthorized.commits, 0);

  const fixture = createFactory(state);
  assert.deepEqual(await fixture.callbacks.deleteProduct("finance-product-water"), { success: true });
  const management = projectCatalogDemoManagement(fixture.state, admin);
  assert.equal(management?.products.some((product) => product.id === "finance-product-water"), false);
  assert.deepEqual(management?.categories, state.categories, "category DTOs carry no management capability fields");
});

test("reserved IDs survive failed commands and restored active or deleted records without modifying payments", async () => {
  let state = createFinanceDemoFixture(anchor);
  state = {
    ...state,
    products: [...state.products, {
      id: "catalog-product-local-1",
      code: 9,
      description: "Producto archivado",
      categoryId: "finance-category-drinks",
      priceCents: 100,
      stock: 0,
      deletedAt: anchor,
    }],
  };
  const initialPayments = state.payments.map((payment) => ({ ...payment }));
  const fixture = createFactory(state);
  assert.match((await fixture.callbacks.createProduct(productInput({ categoryId: "missing" }))).error, /Categoría no encontrada/);
  assert.deepEqual(
    await fixture.callbacks.createProduct(productInput()),
    { success: true, code: 3 },
  );
  assert.ok(fixture.state.products.some((product) => product.id === "catalog-product-local-3"), "the failed local-2 reservation and deleted persisted local-1 are never reused by this factory");
  assert.deepEqual(fixture.state.payments, initialPayments, "catalog commits preserve payment data exactly");

  const restored = createFactory(fixture.state);
  assert.deepEqual(await restored.callbacks.createProduct(productInput({ description: "Producto restaurado" })), { success: true, code: 4 });
  assert.ok(restored.state.products.some((product) => product.id === "catalog-product-local-2"), "a new factory may use an unpersisted failed ID but checks every restored active and deleted ID");

  const exhausted = createFactory(restored.state, { nextId: () => { throw new Error("exhausted"); } });
  const beforeExhaustion = restored.state;
  assert.deepEqual(
    await exhausted.callbacks.createCategory("Sin ID"),
    { success: false, error: "No se pudo asignar un identificador local del catálogo." },
  );
  assert.equal(exhausted.state, beforeExhaustion, "allocator exhaustion is an immutable business failure");
});
