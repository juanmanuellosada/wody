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

function runtimeImports(filePath, content) {
  const file = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const imports = [];
  function visit(node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && !node.importClause?.isTypeOnly) imports.push(node.moduleSpecifier.text);
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
      // Try the next extension.
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

test("both Caja roles mount the reusable sale action with current catalog, fresh Argentina date policy, and reset identity", async () => {
  const [adapter, provider, css] = await Promise.all([
    source("src/components/demo/finance/DemoCashAdapter.tsx"),
    source("src/components/demo/finance/DemoFinanceProvider.tsx"),
    source("preview/landing/app/globals.css"),
  ]);
  assert.match(adapter, /import \{ NewSaleButtonView \} from "@\/components\/sales\/NewSaleButtonView"/);
  assert.match(adapter, /projectSaleDemoCatalog\(finance\.state, identity\)/);
  assert.match(adapter, /saleAction=\{\([\s\S]*<NewSaleButtonView[\s\S]*key=\{finance\.resetEpoch\}[\s\S]*products=\{saleCatalog\}[\s\S]*datePolicy=\{finance\.saleDatePolicy\}[\s\S]*onRegisterSale=\{saleCallback\}/);
  assert.match(provider, /fixedActor: financeCatalogSaleActors\.admin[\s\S]*datePolicy: saleDatePolicy/);
  assert.match(provider, /fixedActor: financeCatalogSaleActors\.teacher[\s\S]*datePolicy: saleDatePolicy/);
  assert.match(provider, /saleCallbacks\?\.ADMIN\.cancelPendingSale\(\);/);
  assert.match(provider, /saleCallbacks\?\.TEACHER\.cancelPendingSale\(\);/);
  assert.match(provider, /saleCallbacks: ready \? saleCallbacks : null/);
  assert.match(css, /@source ".*NewSaleButtonView\.tsx";/);
  assert.match(css, /@source ".*NewSaleDialogView\.tsx";/);
});

test("static Caja graph reaches only reusable presentation and local adapters, never production operations", async () => {
  const { visited, edges } = await runtimeGraph([
    "src/app/demo/admin/caja/page.tsx",
    "src/app/demo/teacher/caja/page.tsx",
    "preview/landing/app/demo/admin/caja/page.tsx",
    "preview/landing/app/demo/teacher/caja/page.tsx",
  ]);
  for (const expected of [
    "src/components/demo/finance/DemoCashAdapter.tsx",
    "src/components/demo/finance/DemoFinanceProvider.tsx",
    "src/components/demo/finance/sale-demo-adapters.ts",
    "src/components/sales/NewSaleButtonView.tsx",
    "src/components/sales/NewSaleDialogView.tsx",
    "src/components/caja/CajaShell.tsx",
  ]) assert.ok([...visited].some((file) => file.endsWith(expected)), `${expected} is reachable from Caja`);
  const forbidden = /(^|\/)(actions|auth|prisma|cache|server)(\/|$)|@\/actions|@prisma/;
  assert.deepEqual(edges.filter(({ specifier }) => forbidden.test(specifier)), []);
});

test("sale view retains its error shape and deliberately omits history, revenue, expense, checkout, cancellation, and editing controls", async () => {
  const [adapter, button, dialog] = await Promise.all([
    source("src/components/demo/finance/DemoCashAdapter.tsx"),
    source("src/components/sales/NewSaleButtonView.tsx"),
    source("src/components/sales/NewSaleDialogView.tsx"),
  ]);
  assert.match(button, /<NewSaleDialogView/);
  assert.match(dialog, /if \(!result\.success\) \{\s*setError\(result\.error\);\s*\} else \{\s*onClose\(\);/s);
  assert.match(dialog, /!isPending && onClose\(\)/);
  assert.doesNotMatch(adapter, /SaleHistory|RevenuePanel|RegisterExpense|cancelSale|updateSale|deleteSale/);
});
