import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const projectRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const sourceRoot = path.join(projectRoot, "src");

async function source(relativePath) {
  return readFile(path.join(projectRoot, relativePath), "utf8");
}

function parse(relativePath, content) {
  return ts.createSourceFile(relativePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function walk(node, predicate, found = []) {
  if (predicate(node)) found.push(node);
  ts.forEachChild(node, (child) => walk(child, predicate, found));
  return found;
}

function isTypeOnly(declaration) {
  const clause = declaration.importClause;
  if (!clause) return false;
  if (clause.isTypeOnly) return true;
  return Boolean(clause.namedBindings && ts.isNamedImports(clause.namedBindings)
    && !clause.name && clause.namedBindings.elements.every((element) => element.isTypeOnly));
}

function runtimeImports(filePath, content) {
  return walk(parse(filePath, content), ts.isImportDeclaration)
    .filter((declaration) => ts.isStringLiteral(declaration.moduleSpecifier) && !isTypeOnly(declaration))
    .map((declaration) => declaration.moduleSpecifier.text);
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

test("revenue contracts are client-safe DTOs and retain the public revenue-view alias", async () => {
  const [contracts, selector, panel] = await Promise.all([
    source("src/components/finance/revenue-view-contracts.ts"),
    source("src/components/RevenueViewSelector.tsx"),
    source("src/components/RevenuePanel.tsx"),
  ]);
  assert.match(contracts, /export type RevenueView = "alumnos" \| "productos" \| "mixta"/);
  assert.match(contracts, /export interface RevenueStats/);
  assert.match(contracts, /export interface RevenueNetStats/);
  assert.match(contracts, /export interface RevenueMonthlyPoint/);
  assert.doesNotMatch(contracts, /@prisma|@\/actions|@\/lib\/(?:prisma|payment-stats|finance-stats)|async function|get[A-Z]\w*\(/);
  assert.match(selector, /export type \{ RevenueView \} from "@\/components\/finance\/revenue-view-contracts"/);
  assert.match(panel, /view: RevenueView;/);
});

test("server wrapper retains selected-branch live queries, arguments, and mixed-history distinction", async () => {
  const panel = await source("src/components/RevenuePanel.tsx");
  assert.match(panel, /const \[stats, evolution, history\] = await Promise\.all\(\[\s*getPaymentStats\(filters\),\s*getMonthlyEvolution\(filters\),\s*getPaymentHistory\(filters\),\s*\]\);/s);
  assert.match(panel, /categoryId: activeFilters\.categoryId \|\| undefined,/);
  assert.match(panel, /getSaleStats\(saleFilters\),\s*getSaleMonthlyEvolution\(saleFilters\),\s*getSaleHistory\(saleFilters\),/s);
  assert.match(panel, /const expenseFilters: ExpenseStatsFilters = \{ gymId: filters\.gymId, from: filters\.from, to: filters\.to \};/);
  assert.match(panel, /getNetResultStats\(netFilters\),\s*getNetMonthlyEvolution\(netFilters\),\s*getPaymentHistory\(filters\),\s*getSaleHistory\(saleFilters\),\s*getExpenseHistory\(expenseFilters\),/s);
  assert.match(panel, /view === "alumnos" &&[\s\S]*<AlumnosView filters=\{filters\}/);
  assert.match(panel, /view === "productos" &&[\s\S]*<ProductosView filters=\{filters\}/);
  assert.match(panel, /view === "mixta" && <MixtaView filters=\{filters\}/);
  assert.match(panel, /<RevenuePanelView selector=\{<RevenueViewSelector view=\{view\} \/>\}>/);
});

test("filter wrappers retain URL ownership and each original cleanup rule", async () => {
  const [payment, revenue, selector] = await Promise.all([
    source("src/components/PaymentFilters.tsx"),
    source("src/components/RevenueFilters.tsx"),
    source("src/components/RevenueViewSelector.tsx"),
  ]);
  for (const hook of ["useRouter", "usePathname", "useSearchParams", "useTransition"]) assert.match(payment, new RegExp(hook));
  for (const legacy of ["statsMode", "statsMonth", "statsTeacherId", "statsStudentId", "statsTeacherIds"]) {
    assert.match(payment, new RegExp(`params\\.delete\\("${legacy}"\\)`));
  }
  assert.match(payment, /navigate\(\{ statsTeacherIds: next \}\)/);
  assert.match(payment, /navigate\(\{ statsTeacherIds: \[\] \}\)/);
  assert.match(payment, /router\.push\(qs \? `\$\{pathname\}\?\$\{qs\}` : pathname\)/);
  assert.doesNotMatch(revenue, /statsMode|statsMonth|statsTeacherId|statsStudentId|statsTeacherIds/);
  assert.match(revenue, /navigate\(\{ statsMethods: next \}\)/);
  assert.match(revenue, /navigate\(\{ statsCategoryId: categoryId \}\)/);
  assert.match(selector, /next === "alumnos"\) params\.delete\("revenueView"\)/);
  assert.match(selector, /else params\.set\("revenueView", next\)/);
});

test("presentation views own layout while their runtime graph excludes operational modules", async () => {
  const [panelView, paymentView, revenueView, selectorView, tabsView, graph] = await Promise.all([
    source("src/components/finance/RevenuePanelView.tsx"),
    source("src/components/finance/PaymentFiltersView.tsx"),
    source("src/components/finance/RevenueFiltersView.tsx"),
    source("src/components/finance/RevenueViewSelectorView.tsx"),
    source("src/components/finance/MixtaHistoryTabsView.tsx"),
    runtimeGraph([
      "src/components/finance/RevenuePanelView.tsx",
      "src/components/finance/PaymentFiltersView.tsx",
      "src/components/finance/RevenueFiltersView.tsx",
      "src/components/finance/RevenueViewSelectorView.tsx",
      "src/components/finance/MixtaHistoryTabsView.tsx",
    ]),
  ]);
  assert.match(panelView, /function formatAmount\(value: number\)/);
  assert.match(panelView, /function ChangeIndicator/);
  assert.match(panelView, /function MetricCard/);
  assert.match(panelView, /export function AlumnosRevenueView/);
  assert.match(panelView, /export function ProductosRevenueView/);
  assert.match(panelView, /export function MixtaRevenueView/);
  assert.match(paymentView, /export function PaymentFiltersView/);
  assert.match(revenueView, /export function RevenueFiltersView/);
  assert.match(selectorView, /export function RevenueViewSelectorView/);
  assert.match(tabsView, /tab === "cuotas" && cuotas/);
  assert.match(tabsView, /tab === "ventas" && ventas/);
  assert.match(tabsView, /tab === "gastos" && gastos/);
  const forbidden = /(^|\/)(actions|auth|prisma|cache|server)(\/|$)|@prisma|@\/actions|@\/lib\/(?:prisma|payment-stats|finance-stats)|^next\//;
  assert.deepEqual(graph.edges.filter(({ specifier }) => forbidden.test(specifier)), []);
});

test("live history wrappers retain D2 action adapters and use slots without mounting inactive histories", async () => {
  const [tabs, payment, sale, expense] = await Promise.all([
    source("src/components/MixtaHistoryTabs.tsx"),
    source("src/components/PaymentHistorySection.tsx"),
    source("src/components/SaleHistorySection.tsx"),
    source("src/components/ExpenseHistorySection.tsx"),
  ]);
  assert.match(tabs, /<MixtaHistoryTabsView[\s\S]*cuotas=\{<PaymentHistorySection payments=\{payments\} isAdmin \/>\}[\s\S]*ventas=\{<SaleHistorySection sales=\{sales\} \/>\}[\s\S]*gastos=\{<ExpenseHistorySection expenses=\{expenses\} \/>\}/);
  assert.match(payment, /updateLivePayment: UpdatePaymentCallback = \(paymentId, amount\) => updatePayment\(paymentId, amount\);/);
  assert.match(sale, /updateLiveSale: UpdateSaleCallback = \(saleId, data\) => updateSale\(saleId, data\);/);
  assert.match(expense, /updateLiveExpense: UpdateExpenseCallback = \(expenseId, data\) => updateExpense\(expenseId, data\);/);
});
