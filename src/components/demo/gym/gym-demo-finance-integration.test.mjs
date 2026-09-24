import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { parseDemoRevenueFilters } from "../finance/revenue-demo-contract.ts";

const root = new URL("../../../../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");
const routePairs = [
  ["admin/pagos/page.tsx", "gym-admin-pagos", "ADMIN", "gym-fixed-admin", "fees"],
  ["admin/caja/page.tsx", "gym-admin-caja", "ADMIN", "gym-fixed-admin", "cash"],
  ["admin/productos/page.tsx", "gym-admin-productos", "ADMIN", "gym-fixed-admin", "products"],
  ["teacher/pagos/page.tsx", "gym-teacher-pagos", "TEACHER", "gym-fixed-teacher-linked", "fees"],
  ["teacher/caja/page.tsx", "gym-teacher-caja", "TEACHER", "gym-fixed-teacher-linked", "cash"],
];

async function routeElement(path) {
  const compiled = ts.transpileModule(await source(path), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const route = () => null;
  const commonjsModule = { exports: {} };
  new Function("require", "exports", "module", compiled)(
    (specifier) => {
      if (specifier === "react/jsx-runtime") return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
      if (specifier === "@/components/demo/gym/DemoGymFinanceRoute") return { SharedDemoGymFinanceRoute: route };
      if (specifier === "next") return {};
      throw new Error(`Unexpected module: ${specifier}`);
    }, commonjsModule.exports, commonjsModule,
  );
  return { route, element: Object.values(commonjsModule.exports).find((value) => typeof value === "function" && value.name !== "")() };
}

test("each GYM financial root/Preview pair emits the same route-shell contract", async () => {
  for (const [leaf, key, role, actorId, screen] of routePairs) {
    const [rootRoute, previewRoute] = await Promise.all([
      routeElement(`src/app/demo/gym/${leaf}`), routeElement(`preview/landing/app/demo/gym/${leaf}`),
    ]);
    for (const candidate of [rootRoute, previewRoute]) {
      assert.equal(candidate.element.type, candidate.route);
      assert.deepEqual(candidate.element.props, { routeKey: key, routeRole: role, routeActorId: actorId, screen });
    }
  }
});

async function revenuePanelHarness(initialUrl, role = "ADMIN") {
  const compiled = ts.transpileModule(await source("src/components/demo/gym/DemoGymCashAdapter.tsx"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  let url = initialUrl;
  const calls = { projections: 0, replaces: [] };
  const token = Object.freeze({});
  const component = (name) => Object.assign(() => null, { displayName: name });
  const components = Object.fromEntries([
    "CajaShell", "RegisterExpenseButtonView", "ExpenseHistorySectionView", "MixtaHistoryTabsView", "PaymentFiltersView", "RevenueFiltersView",
    "AlumnosRevenueView", "MixtaRevenueView", "ProductosRevenueView", "RevenuePanelView", "RevenueViewSelectorView", "PaymentHistorySectionView",
    "RegisterPaymentSectionView", "NewSaleButtonView", "SaleHistorySectionView", "Button",
  ].map((name) => [name, component(name)]));
  const parse = parseDemoRevenueFilters;
  const project = (_state, _token, query, today) => {
    calls.projections += 1;
    const parsed = parse(query, today);
    assert.equal(parsed.ok, true, "invalid report URLs must not reach financial projection");
    const metric = { totalCents: 0, count: 0, previousTotalCents: 0, previousCount: 0, totalChange: null, countChange: null };
    if (parsed.filters.revenueView === "alumnos") return { success: true, view: "alumnos", metrics: metric, evolution: [], paymentHistory: [], filterOptions: { teachers: [], categories: [] } };
    if (parsed.filters.revenueView === "productos") return { success: true, view: "productos", metrics: metric, evolution: [], saleHistory: [], filterOptions: { teachers: [], categories: [] } };
    return { success: true, view: "mixta", metrics: { payments: metric, sales: metric, expenses: metric, grossIncome: metric, net: metric }, evolution: [], paymentHistory: [], saleHistory: [], expenseHistory: [], filterOptions: { teachers: [], categories: [] } };
  };
  const callbacks = { registerExpense: async () => ({ success: true }), updateExpense: async () => ({ success: true }), deleteExpense: async () => ({ success: true }), updatePayment: async () => ({ success: true }), deletePayment: async () => ({ success: true }), updateSale: async () => ({ success: true }), deleteSale: async () => ({ success: true }) };
  const commonjsModule = { exports: {} };
  new Function("require", "exports", "module", compiled)(
    (specifier) => {
      if (specifier === "react") return { useEffect: () => {}, useMemo: (factory) => factory() };
      if (specifier === "react/jsx-runtime") return { jsx: (type, props) => ({ type, props: props ?? {} }), jsxs: (type, props) => ({ type, props: props ?? {} }) };
      if (specifier === "next/navigation") return { usePathname: () => "/demo/gym/admin/caja", useRouter: () => ({ replace: (next) => { calls.replaces.push(next); url = next.includes("?") ? next.slice(next.indexOf("?")) : ""; } }), useSearchParams: () => new URLSearchParams(url) };
      if (specifier === "@/components/caja/CajaShell") return { CajaShell: components.CajaShell };
      if (specifier === "@/components/expenses/RegisterExpenseButtonView") return { RegisterExpenseButtonView: components.RegisterExpenseButtonView };
      if (specifier === "@/components/expenses/ExpenseHistorySectionView") return { ExpenseHistorySectionView: components.ExpenseHistorySectionView };
      if (specifier === "@/components/finance/MixtaHistoryTabsView") return { MixtaHistoryTabsView: components.MixtaHistoryTabsView };
      if (specifier === "@/components/finance/PaymentFiltersView") return { PaymentFiltersView: components.PaymentFiltersView };
      if (specifier === "@/components/finance/RevenueFiltersView") return { RevenueFiltersView: components.RevenueFiltersView };
      if (specifier === "@/components/finance/RevenuePanelView") return { AlumnosRevenueView: components.AlumnosRevenueView, MixtaRevenueView: components.MixtaRevenueView, ProductosRevenueView: components.ProductosRevenueView, RevenuePanelView: components.RevenuePanelView };
      if (specifier === "@/components/finance/RevenueViewSelectorView") return { RevenueViewSelectorView: components.RevenueViewSelectorView };
      if (specifier === "@/components/payments/PaymentHistorySectionView") return { PaymentHistorySectionView: components.PaymentHistorySectionView };
      if (specifier === "@/components/payments/RegisterPaymentSectionView") return { RegisterPaymentSectionView: components.RegisterPaymentSectionView };
      if (specifier === "@/components/sales/NewSaleButtonView") return { NewSaleButtonView: components.NewSaleButtonView };
      if (specifier === "@/components/sales/SaleHistorySectionView") return { SaleHistorySectionView: components.SaleHistorySectionView };
      if (specifier === "@/components/ui/Button") return { Button: components.Button };
      if (specifier === "@/components/demo/finance/gym-sale-demo-adapters") return { projectGymSaleDemoCatalog: () => ({ success: true, products: [] }) };
      if (specifier === "@/components/demo/finance/gym-finance-demo-projection") return { projectGymFinancePaymentStudentSelection: () => ({ success: true, students: [] }) };
      if (specifier === "@/components/demo/finance/revenue-demo-projection") return { projectDemoRevenue: project };
      if (specifier === "@/components/demo/finance/revenue-demo-contract") return { parseDemoRevenueFilters: parse };
      if (specifier === "@/components/demo/scenarios/gym-demo-directory") return { getGymDemoActorToken: () => token };
      if (specifier === "./DemoGymProvider") return { useDemoGym: () => ({ ready: true, selectedActor: { id: "gym-fixed-admin", role } }) };
      if (specifier === "./DemoGymFinanceProvider") return { useDemoGymFinance: () => ({ ready: true, state: {}, today: "2030-06-03", paymentCallbacks: new Map(), saleCallbacks: new Map(), revenueCallbacks: new Map([["gym-fixed-admin", callbacks]]), saleDatePolicy: {}, expenseDatePolicy: {}, reset: () => {}, warning: null }) };
      if (specifier === "./DemoGymFeesAdapter") return { Warning: components.Button };
      throw new Error(`Unexpected module: ${specifier}`);
    }, commonjsModule.exports, commonjsModule,
  );
  function find(node, type) {
    if (!node || typeof node !== "object") return null;
    if (node.type === type) return node;
    const children = node.props?.children;
    for (const child of Array.isArray(children) ? children : [children]) {
      const found = find(child, type);
      if (found) return found;
    }
    return null;
  }
  function alert(node) {
    if (!node || typeof node !== "object") return null;
    if (node.props?.role === "alert") return node;
    const children = node.props?.children;
    for (const child of Array.isArray(children) ? children : [children]) {
      const found = alert(child);
      if (found) return found;
    }
    return null;
  }
  return { calls, components, render: () => commonjsModule.exports.AdminRevenuePanel(), setUrl: (next) => { url = next; }, find, alert };
}

test("invalid GYM revenue periods retain the requested view and BOX-compatible recovery controls without projection", async () => {
  const harness = await revenuePanelHarness("?revenueView=mixta&statsFrom=2030-02-30&statsTo=2030-06-30");
  const invalidMixta = harness.render();
  assert.equal(harness.calls.projections, 0);
  assert.equal(invalidMixta.props.selector?.props.view, "mixta");
  const mixtaControls = harness.find(invalidMixta, harness.components.RevenueFiltersView);
  assert.equal(mixtaControls?.props.current.from, "2030-06-01");
  assert.equal(harness.alert(invalidMixta)?.props.children.includes("El período no es válido."), true);
  mixtaControls.props.onFromChange("2030-06-01");
  assert.equal(harness.calls.replaces.at(-1), "/demo/gym/admin/caja?revenueView=mixta&statsFrom=2030-06-01&statsTo=2030-06-30");
  const recovered = harness.render();
  assert.equal(harness.calls.projections, 1);
  assert.ok(harness.find(recovered, harness.components.MixtaRevenueView));
  assert.equal(harness.alert(recovered), null);

  harness.setUrl("?revenueView=alumnos&statsFrom=2030-02-30");
  const invalidAlumnos = harness.render();
  assert.equal(harness.calls.projections, 1);
  assert.ok(harness.find(invalidAlumnos, harness.components.PaymentFiltersView));
  harness.setUrl("?revenueView=productos&statsFrom=2030-02-30");
  const invalidProductos = harness.render();
  assert.equal(harness.calls.projections, 1);
  assert.ok(harness.find(invalidProductos, harness.components.RevenueFiltersView));
  harness.setUrl("?revenueView=desconocida");
  const unknownView = harness.render();
  assert.equal(unknownView.props.selector?.props.view, "alumnos");

  const teacher = await revenuePanelHarness("?revenueView=mixta&statsFrom=2030-02-30", "TEACHER");
  assert.equal(teacher.render(), null);
  assert.equal(teacher.calls.projections, 0);
});

test("GYM finance uses its isolated provider, canonical identity tokens, and no BOX operational graph", async () => {
  const [scenarios, route, fees, cash, products, navbar, layout] = await Promise.all([
    source("src/components/demo/scenarios/DemoScenarioProviders.tsx"),
    source("src/components/demo/gym/DemoGymFinanceRoute.tsx"),
    source("src/components/demo/gym/DemoGymFeesAdapter.tsx"),
    source("src/components/demo/gym/DemoGymCashAdapter.tsx"),
    source("src/components/demo/gym/DemoGymProductsAdapter.tsx"),
    source("src/components/DemoNavbar.tsx"),
    source("preview/landing/app/demo/layout.tsx"),
  ]);
  assert.match(scenarios, /<DemoGymProvider>\s*<DemoGymProfileProvider>\s*<DemoGymFinanceProvider><DemoNavbar scenario="GYM"/);
  for (const sourceText of [route, fees, cash, products]) {
    assert.match(sourceText, /getGymDemoActorToken/);
    assert.doesNotMatch(sourceText, /DemoFinanceProvider|DemoCashAdapter|DemoFeesAdapter|DemoCatalogAdapter|DemoRevenueAdapter|wody-box-finance/);
  }
  assert.match(route, /Same-role navigation retains the selected persona/);
  assert.match(route, /payment\?\.cancelPending\(\)[\s\S]*catalog\?\.cancelPending\(\)[\s\S]*sale\?\.cancelPending\(\)[\s\S]*revenue\?\.cancelPending\(\)/);
  assert.match(route, /\$\{actor\.id\}:\$\{finance\.resetEpoch\}/);
  assert.match(fees, /projectGymFinanceFeesData[\s\S]*projectGymFinancePaymentStudentSelection/);
  assert.match(fees, /gymKind="GYM"/);
  assert.match(cash, /projectGymSaleDemoCatalog[\s\S]*projectGymFinancePaymentStudentSelection/);
  assert.match(cash, /actor\.role !== "ADMIN" \|\| !token/);
  assert.match(cash, /useSearchParams\(\)[\s\S]*parseDemoRevenueFilters[\s\S]*router\.replace/);
  assert.match(cash, /PaymentFiltersView[\s\S]*RevenueFiltersView[\s\S]*PaymentHistorySectionView[\s\S]*SaleHistorySectionView/);
  assert.match(cash, /onClick=\{finance\.reset\}/);
  assert.match(products, /actor\.role === "ADMIN"[\s\S]*projectGymCatalogDemoManagement/);
  assert.match(products, /\$\{actor\.id\}:\$\{finance\.resetEpoch\}/);
  for (const path of ["/demo/gym/admin/pagos", "/demo/gym/admin/caja", "/demo/gym/admin/productos", "/demo/gym/teacher/pagos", "/demo/gym/teacher/caja"]) {
    assert.match(navbar, new RegExp(path));
    assert.match(layout, new RegExp(`"${path}"`));
  }
});

test("financial presentation keeps readiness, failures, warnings, empty scope, and deferred profile controls explicit", async () => {
  const [fees, cash, products] = await Promise.all([
    source("src/components/demo/gym/DemoGymFeesAdapter.tsx"),
    source("src/components/demo/gym/DemoGymCashAdapter.tsx"),
    source("src/components/demo/gym/DemoGymProductsAdapter.tsx"),
  ]);
  assert.match(fees, /Preparando cuotas de demostración/);
  assert.match(fees, /No tenés alumnos asignados/);
  assert.match(fees, /edición de perfiles, bloqueos, exenciones y asignaciones se incorporarán con el puente de perfiles/);
  assert.match(cash, /Preparando caja de demostración/);
  assert.match(cash, /Datos de demostración guardados solo en esta pestaña/);
  assert.match(products, /Preparando catálogo de demostración/);
  for (const sourceText of [fees, cash, products]) assert.match(sourceText, /finance\.warning/);
});
