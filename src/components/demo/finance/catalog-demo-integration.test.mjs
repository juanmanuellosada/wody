import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const projectRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const sourceRoot = path.join(projectRoot, "src");
const source = (relativePath) => readFile(path.join(projectRoot, relativePath), "utf8");

function isTypeOnly(declaration) {
  const clause = declaration.importClause;
  if (!clause) return false;
  if (clause.isTypeOnly) return true;
  return Boolean(clause.namedBindings && ts.isNamedImports(clause.namedBindings)
    && !clause.name && clause.namedBindings.elements.every((element) => element.isTypeOnly));
}

function runtimeImports(filePath, content) {
  const file = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const imports = [];
  function visit(node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && !isTypeOnly(node)) {
      imports.push(node.moduleSpecifier.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return imports;
}

async function resolveLocalImport(fromFile, specifier) {
  let base;
  if (specifier.startsWith("@/")) base = path.join(sourceRoot, specifier.slice(2));
  else if (specifier.startsWith(".")) base = path.resolve(path.dirname(fromFile), specifier);
  else return null;
  for (const suffix of ["", ".tsx", ".ts", "/index.tsx", "/index.ts"]) {
    try {
      const candidate = `${base}${suffix}`;
      if ((await stat(candidate)).isFile()) return candidate;
    } catch {
      // Try the next supported extension.
    }
  }
  return null;
}

async function runtimeGraph(entries) {
  const pending = entries.map((entry) => path.join(projectRoot, entry));
  const visited = new Set();
  const edges = [];
  while (pending.length) {
    const file = pending.pop();
    if (!file || visited.has(file)) continue;
    visited.add(file);
    const content = await readFile(file, "utf8");
    for (const specifier of runtimeImports(file, content)) {
      edges.push({ from: path.relative(projectRoot, file), specifier });
      const local = await resolveLocalImport(file, specifier);
      if (local) pending.push(local);
    }
  }
  return { visited, edges };
}

function containsIdentifier(node, identifier) {
  let found = false;
  function visit(current) {
    if (ts.isIdentifier(current) && current.text === identifier) found = true;
    ts.forEachChild(current, visit);
  }
  visit(node);
  return found;
}

function hasCommittedCategoryLookup(node) {
  let found = false;
  function visit(current) {
    if (ts.isCallExpression(current)
      && ts.isPropertyAccessExpression(current.expression)
      && current.expression.name.text === "some"
      && ts.isPropertyAccessExpression(current.expression.expression)
      && current.expression.expression.name.text === "categories"
      && ts.isIdentifier(current.expression.expression.expression)
      && current.expression.expression.expression.text === "management") found = true;
    ts.forEachChild(current, visit);
  }
  visit(node);
  return found;
}

function hasInlineCategorySuccessBranch(root) {
  let found = false;
  function includesSetter(node) {
    let setterFound = false;
    function findSetter(current) {
      if (ts.isCallExpression(current) && ts.isIdentifier(current.expression) && current.expression.text === "setInlineCategoryId") setterFound = true;
      ts.forEachChild(current, findSetter);
    }
    findSetter(node);
    return setterFound;
  }
  function visit(node) {
    if (ts.isIfStatement(node)
      && ts.isPropertyAccessExpression(node.expression)
      && ts.isIdentifier(node.expression.expression)
      && node.expression.expression.text === "result"
      && node.expression.name.text === "success"
      && includesSetter(node.thenStatement)) found = true;
    ts.forEachChild(node, visit);
  }
  visit(root);
  return found;
}

function catalogAdapterSchedulingContract(content) {
  const file = ts.createSourceFile("DemoCatalogAdapter.tsx", content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let committedLookup = null;
  let managerKey = null;
  let managerViewKey = null;
  let productViewKey = null;
  let inlineSuccessSetter = null;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      if (node.name.text === "hasCommittedInlineCategory") committedLookup = node.initializer;
      if (node.name.text === "managerKey") managerKey = node.initializer;
    }
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && ts.isIdentifier(node.tagName)) {
      const key = node.attributes.properties.find((attribute) => ts.isJsxAttribute(attribute) && attribute.name.text === "key");
      if (node.tagName.text === "CategoryManagerView") managerViewKey = key?.initializer;
      if (node.tagName.text === "ProductListView") productViewKey = key?.initializer;
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "setInlineCategoryId") {
      inlineSuccessSetter = node.arguments[0] ?? null;
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return { committedLookup, managerKey, managerViewKey, productViewKey, inlineSuccessSetter };
}

test("catalog routes mount only the designated local adapter and static allowlists include the admin route", async () => {
  const [rootPage, previewPage, navbar, hub, layout, css] = await Promise.all([
    source("src/app/demo/admin/productos/page.tsx"),
    source("preview/landing/app/demo/admin/productos/page.tsx"),
    source("src/components/DemoNavbar.tsx"),
    source("src/components/demo/training/DemoTrainingOverview.tsx"),
    source("preview/landing/app/demo/layout.tsx"),
    source("preview/landing/app/globals.css"),
  ]);

  assert.match(rootPage, /<DemoNavbar \/>/);
  assert.match(rootPage, /<DemoCatalogAdapter \/>/);
  assert.doesNotMatch(rootPage, /ProductListView|ProductList|CategoryManager|@\/actions|@prisma/);
  assert.match(previewPage, /<DemoCatalogAdapter \/>/);
  assert.doesNotMatch(previewPage, /DemoNavbar|ProductListView|@\/actions|@prisma/);
  assert.equal((navbar.match(/href: "\/demo\/admin\/productos", label: "Productos"/g) ?? []).length, 1);
  assert.doesNotMatch(navbar, /href: "\/demo\/teacher\/productos"/);
  assert.match(hub, /href: "\/demo\/admin\/productos", label: "Productos"/);
  assert.match(layout, /"\/demo\/admin\/productos"/);
  for (const view of ["ProductListView", "ProductDialogView", "CategoryManagerView"]) {
    assert.match(css, new RegExp(`@source ".*${view}\\.tsx";`));
  }
});

test("catalog adapter keeps local presentation, sibling refresh, reset epoch, and recursive standalone imports operationally isolated", async () => {
  const [adapter, provider] = await Promise.all([
    source("src/components/demo/finance/DemoCatalogAdapter.tsx"),
    source("src/components/demo/finance/DemoFinanceProvider.tsx"),
  ]);
  assert.match(adapter, /import \{ ProductListView \} from "@\/components\/products\/ProductListView"/);
  assert.match(adapter, /import \{ CategoryManagerView \} from "@\/components\/products\/CategoryManagerView"/);
  assert.doesNotMatch(adapter, /ProductList"|ProductDialog"|CategoryManager"|@\/actions|@prisma/);
  const scheduling = catalogAdapterSchedulingContract(adapter);
  const adapterAst = ts.createSourceFile("DemoCatalogAdapter.tsx", adapter, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal(hasInlineCategorySuccessBranch(adapterAst), true, "failed inline creation cannot change the manager identity");
  assert.ok(scheduling.committedLookup && hasCommittedCategoryLookup(scheduling.committedLookup));
  assert.ok(scheduling.committedLookup && containsIdentifier(scheduling.committedLookup, "inlineCategoryId"));
  assert.ok(scheduling.managerKey && containsIdentifier(scheduling.managerKey, "hasCommittedInlineCategory"));
  assert.ok(scheduling.managerKey && containsIdentifier(scheduling.managerKey, "resetEpoch"));
  assert.ok(scheduling.managerViewKey && containsIdentifier(scheduling.managerViewKey, "managerKey"));
  assert.ok(scheduling.productViewKey && containsIdentifier(scheduling.productViewKey, "resetEpoch"));
  assert.ok(scheduling.inlineSuccessSetter && containsIdentifier(scheduling.inlineSuccessSetter, "result"));
  assert.match(adapter, /onClick=\{finance\.reset\}/);
  assert.match(adapter, /Solo se restablecen el catálogo, las cuotas y los pagos ficticios/);
  assert.doesNotMatch(adapter, /managerRefreshEpoch|setTimeout|router\.refresh/);
  assert.match(provider, /catalogCallbacks: ready \? catalogCallbacks : null/);
  assert.match(provider, /createCatalogDemoCallbackFactory\(\{[\s\S]*actor: financeCatalogSaleActors\.admin/);
  assert.match(provider, /resetEpochRef\.current \+= 1;\s*setResetEpoch\(resetEpochRef\.current\);/s);

  const { visited, edges } = await runtimeGraph([
    "preview/landing/app/demo/layout.tsx",
    "preview/landing/app/demo/admin/productos/page.tsx",
  ]);
  for (const expected of [
    "src/components/demo/finance/DemoCatalogAdapter.tsx",
    "src/components/products/ProductListView.tsx",
    "src/components/products/ProductDialogView.tsx",
    "src/components/products/CategoryManagerView.tsx",
    "src/components/demo/finance/DemoFinanceProvider.tsx",
  ]) assert.ok([...visited].some((file) => file.endsWith(expected)), `${expected} is reachable from the static route`);
  const forbidden = /(^|\/)(actions|auth|prisma|cache|server)(\/|$)|@\/actions|@prisma/;
  assert.deepEqual(edges.filter(({ specifier }) => forbidden.test(specifier)), []);
});
