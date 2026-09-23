import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = new URL("../../../../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

async function queryHelpers() {
  const content = await source("src/components/demo/finance/DemoRevenueAdapter.tsx");
  const start = content.indexOf("type QueryValue");
  const end = content.indexOf("function fallbackName");
  const extracted = content.slice(start, end).replaceAll("export function", "function");
  const output = ts.transpileModule(extracted, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText + "\nmodule.exports = { updateDemoPaymentFiltersQuery, updateDemoRevenueFiltersQuery, updateDemoRevenueViewQuery };";
  const compiledModule = { exports: {} };
  vm.runInNewContext(output, { module: compiledModule, URLSearchParams });
  return compiledModule.exports;
}

test("local query helpers preserve each live cleanup rule without navigation or network ownership", async () => {
  const helpers = await queryHelpers();
  const sourceQuery = new URLSearchParams("statsMode=month&statsMonth=3&statsTeacherId=old&statsStudentId=old&statsTeacherIds=old&statsMethods=EFECTIVO&kept=yes");
  assert.equal(
    helpers.updateDemoPaymentFiltersQuery(sourceQuery, { statsTeacherIds: ["teacher-a", "teacher-b"] }).toString(),
    "statsMethods=EFECTIVO&kept=yes&statsTeacherIds=teacher-a%2Cteacher-b",
  );
  assert.equal(
    helpers.updateDemoRevenueFiltersQuery(sourceQuery, { statsCategoryId: "drinks" }).get("statsMode"),
    "month",
    "revenue filters only update the requested key",
  );
  assert.equal(helpers.updateDemoRevenueViewQuery(sourceQuery, "alumnos").has("revenueView"), false);
  assert.equal(helpers.updateDemoRevenueViewQuery(sourceQuery, "mixta").get("revenueView"), "mixta");
});

test("designated Caja mount maps every authorized cents field at the presentation boundary", async () => {
  const [adapter, cash] = await Promise.all([
    source("src/components/demo/finance/DemoRevenueAdapter.tsx"),
    source("src/components/demo/finance/DemoCashAdapter.tsx"),
  ]);
  assert.match(adapter, /if \(!canManageExpenses\(financeCatalogSaleActors\.admin\).*return null;/s);
  assert.match(adapter, /projectDemoRevenue\(finance\.state, financeCatalogSaleActors\.admin, query, finance\.today\)/);
  assert.match(adapter, /total: metric\.totalCents \/ 100, count: metric\.count/);
  assert.match(adapter, /total: metric\.previousTotalCents \/ 100, count: metric\.previousCount/);
  assert.match(adapter, /ingresos: point\.incomeCents \/ 100/);
  assert.match(adapter, /gastos: point\.expenseCents \/ 100/);
  assert.match(adapter, /resultado: point\.netCents \/ 100/);
  assert.match(adapter, /amount: row\.amountCents \/ 100/);
  assert.match(adapter, /unitAmount: row\.unitAmountCents \/ 100/);
  assert.match(adapter, /totalAmount: row\.totalAmountCents \/ 100/);
  assert.match(adapter, /recordedByName: fallbackName\(row\.recordedByName\)/);
  assert.match(adapter, /<RevenuePanelView selector=\{selector\}>/);
  assert.match(adapter, /<MixtaHistoryTabsView/);
  assert.match(adapter, /<AuthorizedDemoRevenueAdapter key=\{finance\.resetEpoch\} \/>/);
  assert.doesNotMatch(adapter, /next\/navigation|RevenuePanel from|ServerRevenuePanel|fetch\(/);
  assert.match(cash, /expenseAction=\{role === "ADMIN" \? <DemoExpenseAction \/> : null\}/);
  assert.match(cash, /role === "ADMIN" && <DemoRevenueAdapter \/>/);
  assert.doesNotMatch(cash, /role === "TEACHER" && <DemoRevenueAdapter/);
});

test("expense entry is remounted only at the finance reset boundary, clearing stale modal state without ledger remounts", async () => {
  const [cash, provider] = await Promise.all([
    source("src/components/demo/finance/DemoCashAdapter.tsx"),
    source("src/components/demo/finance/DemoFinanceProvider.tsx"),
  ]);
  assert.match(cash, /<CajaShell\s+key=\{finance\.resetEpoch\}/);
  assert.equal((cash.match(/key=\{finance\.resetEpoch\}/g) ?? []).length, 2, "only CajaShell and the existing sale action use reset identity");
  assert.doesNotMatch(cash, /key=\{finance\.(?:state|warning|today)/);
  assert.match(provider, /const reset = useCallback\([\s\S]*resetEpochRef\.current \+= 1;\s*setResetEpoch\(resetEpochRef\.current\);/);
  const commitBody = provider.slice(provider.indexOf("const commit = useCallback"), provider.indexOf("useEffect(() =>"));
  assert.doesNotMatch(commitBody, /setResetEpoch/);
});
