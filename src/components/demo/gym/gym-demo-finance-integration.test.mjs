import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { parseDemoRevenueFilters } from "../finance/revenue-demo-contract.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import * as gymFinanceProjection from "../finance/gym-finance-demo-projection.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createGymFinanceDemoFixture } from "../finance/gym-finance-demo-fixtures.ts";
import * as directory from "../scenarios/gym-demo-directory.ts";

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

test("financial presentation keeps readiness, failures, warnings, empty scope, and active profile controls explicit", async () => {
  const [fees, cash, products] = await Promise.all([
    source("src/components/demo/gym/DemoGymFeesAdapter.tsx"),
    source("src/components/demo/gym/DemoGymCashAdapter.tsx"),
    source("src/components/demo/gym/DemoGymProductsAdapter.tsx"),
  ]);
  assert.match(fees, /Preparando cuotas de demostración/);
  assert.match(fees, /No tenés alumnos asignados/);
  assert.match(fees, /editar el nombre, bloquear o desbloquear y marcar exenciones de pago/);
  assert.match(cash, /Preparando caja de demostración/);
  assert.match(cash, /Datos de demostración guardados solo en esta pestaña/);
  assert.match(products, /Preparando catálogo de demostración/);
  for (const sourceText of [fees, cash, products]) assert.match(sourceText, /finance\.warning/);
});

/**
 * Renders the real DemoGymFeesAdapter.tsx through a CJS-require-mock harness, same shape as
 * gym-demo-provider.test.mjs's DemoGymTrainingRoute harness: only the providers and leaf view
 * components are mocked, while the projection module and directory are the real, unmocked
 * implementations. Captures the actual props PaymentControlView and RegisterPaymentSectionView
 * receive, so assertions are about rendered behavior, not source text.
 *
 * `DemoGymFeeRowActions` (also real/unmocked — it lives inside DemoGymFeesAdapter.tsx) is captured
 * shallowly instead of invoked: once the module has loaded, the jsx implementation is swapped to
 * intercept calls whose `type` is the module's own `DemoGymFeeRowActions` export and return
 * `{ type: "DemoGymFeeRowActions", props }` instead of running it. This exposes exactly the props
 * DemoGymFeesAdapter computed for each row (studentId, isAdmin, callbacks, blockedAt, ...) so the
 * adapter's own wiring — actor-scoped callback lookup, isAdmin derivation, per-row blockedAt
 * sourcing — can be asserted directly, the same way paymentControlProps()/registerPaymentProps()
 * already expose PaymentControlView's/RegisterPaymentSectionView's props.
 */
async function feesAdapterHarness({ actorId, profileStudents, financeState, commandCallbacksByActor = null }) {
  const compiled = ts.transpileModule(await source("src/components/demo/gym/DemoGymFeesAdapter.tsx"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  let paymentControlProps = null;
  let registerPaymentProps = null;
  const PaymentControlView = (props) => { paymentControlProps = props; return null; };
  const RegisterPaymentSectionView = (props) => { registerPaymentProps = props; return null; };
  let jsxImpl = (type, props) => typeof type === "function" ? type(props ?? {}) : { type, props: props ?? {} };
  // React's automatic JSX runtime passes the element's `key` as this third argument, separate from
  // `props` (compiled from `jsx(Foo, {...props}, "the-key")`); captured below so the shallow
  // DemoGymFeeRowActions interception can expose the actual React reconciliation key.
  const jsx = (type, props, key) => jsxImpl(type, props, key);
  const actor = directory.getGymDemoProfile(actorId);
  const cancelPendingDuplicate = () => {};
  const paymentCallbacks = new Map([[actorId, Object.assign(async () => ({ success: true }), { cancelPendingDuplicate })]]);
  const gym = { ready: true, selectedActor: actor };
  const finance = { ready: true, state: financeState, today: "2030-06-03", resetEpoch: 0, warning: null, paymentCallbacks };
  const commandCallbacks = commandCallbacksByActor ? new Map(Object.entries(commandCallbacksByActor)) : null;
  const mocks = {
    react: { useState: (initial) => [typeof initial === "function" ? initial() : initial, () => {}], useMemo: (factory) => factory() },
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: Symbol.for("fragment") },
    "@/components/payments/PaymentControlView": { PaymentControlView },
    "@/components/payments/RegisterPaymentSectionView": { RegisterPaymentSectionView },
    "@/components/StudentTypeSelectView": { StudentTypeSelectView: () => null },
    "@/components/ui/Button": { Button: () => null },
    "@/components/ui/ConfirmDialog": { ConfirmDialog: () => null },
    "./DemoGymProfileEditorView": { DemoGymProfileEditorView: () => null },
    // Real, unmocked projection module: this exercises the actual profileOverrides wiring end to
    // end (both projectGymFinanceFeesData and projectGymFinancePaymentStudentSelection), not a stand-in.
    "@/components/demo/finance/gym-finance-demo-projection": gymFinanceProjection,
    "@/components/demo/scenarios/gym-demo-directory": directory,
    "./DemoGymProvider": { useDemoGym: () => gym },
    "./DemoGymFinanceProvider": { useDemoGymFinance: () => finance },
    "./DemoGymProfileProvider": { useDemoGymProfile: () => ({ profileState: { students: profileStudents }, commandCallbacks }) },
  };
  const commonjsModule = { exports: {} };
  const require = (specifier) => { if (!(specifier in mocks)) throw new Error(`Unexpected module: ${specifier}`); return mocks[specifier]; };
  new Function("require", "exports", "module", compiled)(require, commonjsModule.exports, commonjsModule);
  const RowActionsRef = commonjsModule.exports.DemoGymFeeRowActions;
  jsxImpl = (type, props, key) => {
    if (type === RowActionsRef) return { type: "DemoGymFeeRowActions", props: props ?? {}, key };
    return typeof type === "function" ? type(props ?? {}) : { type, props: props ?? {} };
  };
  const element = commonjsModule.exports.DemoGymFeesAdapter();
  return {
    element,
    paymentControlProps: () => paymentControlProps,
    registerPaymentProps: () => registerPaymentProps,
    // Shallow row-actions props keyed by student id, straight from PaymentControlView's own
    // rowActions prop — proves it was actually passed, not dropped.
    rowActionsProps: (studentId) => paymentControlProps?.rowActions?.[studentId]?.props ?? null,
    // The element's own React reconciliation key (not the object-map key, which stays row.id) —
    // proves whether DemoGymFeesAdapter scopes it to the selected actor.
    rowActionsKey: (studentId) => paymentControlProps?.rowActions?.[studentId]?.key ?? null,
  };
}

test("DemoGymFeesAdapter threads the profile bridge overrides into the real Cuotas rows and the real payment picker, and they agree", async () => {
  const editedName = "Paula Editada";
  const editedReason = "Convenio de demostración";
  // Only gym-fixed-student-general is overridden (name, blocked via blockedAt, exempt+reason). Every
  // other finance student (e.g. gym-fixed-student-personalized) is deliberately absent from the
  // profile map: it proves a partial bridge map leaves the untouched students exactly as finance has them.
  const profileStudents = [{
    id: directory.GYM_DEMO_GENERAL_STUDENT_ID,
    name: editedName,
    studentType: "GENERAL",
    canCreateOwnRoutines: false,
    blockedAt: "2030-06-01T00:00:00.000Z",
    paymentExempt: true,
    paymentExemptReason: editedReason,
  }];
  const financeState = createGymFinanceDemoFixture();
  const { element, paymentControlProps, registerPaymentProps } = await feesAdapterHarness({
    actorId: directory.GYM_DEMO_ADMIN_ID, profileStudents, financeState,
  });
  assert.equal(element.type, "main");

  const rows = paymentControlProps()?.rows;
  assert.ok(rows, "PaymentControlView was never rendered with rows");
  const editedRow = rows.find((row) => row.id === directory.GYM_DEMO_GENERAL_STUDENT_ID);
  assert.equal(editedRow?.name, editedName);
  assert.deepEqual(editedRow?.blockStatus, { blocked: true, kind: "manual" });
  assert.equal(editedRow?.paymentExempt, true);
  assert.equal(editedRow?.paymentExemptReason, editedReason);
  // The exempt override must be counted/filtered consistently, not just painted on the row.
  // (gym-fixed-student-muslib is already exempt in the finance fixture; this adds a second.)
  assert.equal(paymentControlProps()?.counts.exempt, 2);
  assert.equal(paymentControlProps()?.activeFilter, "all");

  const students = registerPaymentProps()?.students;
  assert.ok(students, "RegisterPaymentSectionView was never rendered with students");
  const pickerStudent = students.find((student) => student.id === directory.GYM_DEMO_GENERAL_STUDENT_ID);
  // Both surfaces of the same screen must agree: this is the exact contradiction this test exists to catch.
  assert.equal(pickerStudent?.name, editedRow?.name);
  assert.equal(pickerStudent?.paymentExempt, editedRow?.paymentExempt);
  assert.equal(pickerStudent?.paymentExemptReason, editedRow?.paymentExemptReason);

  // A student absent from the profile map (canonically blocked in the finance fixture) stays canonical
  // on both surfaces: the bridge does not blank or override what nobody edited.
  const untouchedRow = rows.find((row) => row.id === directory.GYM_DEMO_PERSONALIZED_STUDENT_ID);
  const untouchedPicker = students.find((student) => student.id === directory.GYM_DEMO_PERSONALIZED_STUDENT_ID);
  assert.equal(untouchedRow?.name, "Irene Soto");
  assert.deepEqual(untouchedRow?.blockStatus, { blocked: true, kind: "manual" });
  assert.equal(untouchedPicker?.name, "Irene Soto");
  assert.equal(untouchedPicker?.paymentExempt, false);
});

/**
 * Proves the adapter-level wiring between DemoGymFeesAdapter and DemoGymFeeRowActions that no
 * other test covers: the isolated DemoGymFeeRowActions tests inject props directly, and the test
 * above stubs commandCallbacks as null and never reads the rowActions prop. Here commandCallbacks
 * is a real, non-null Map with per-actor sentinel objects, so a wrong actor.id lookup returns a
 * different (or absent) object instead of the expected one by reference.
 */
test("DemoGymFeesAdapter wires rowActions with the actor-scoped callbacks, the actor's own isAdmin, and each row's own blockedAt", async () => {
  const profileStudents = [
    {
      id: directory.GYM_DEMO_GENERAL_STUDENT_ID,
      name: "Paula Méndez",
      studentType: "GENERAL",
      canCreateOwnRoutines: false,
      blockedAt: "2030-06-01T00:00:00.000Z",
      paymentExempt: false,
      paymentExemptReason: null,
    },
    {
      id: directory.GYM_DEMO_PERSONALIZED_STUDENT_ID,
      name: "Irene Soto",
      studentType: "PERSONALIZED",
      canCreateOwnRoutines: false,
      blockedAt: null,
      paymentExempt: false,
      paymentExemptReason: null,
    },
  ];
  const financeState = createGymFinanceDemoFixture();
  const adminCallbacks = { marker: "admin-callbacks" };
  const teacherCallbacks = { marker: "teacher-callbacks" };

  const admin = await feesAdapterHarness({
    actorId: directory.GYM_DEMO_ADMIN_ID, profileStudents, financeState,
    commandCallbacksByActor: { [directory.GYM_DEMO_ADMIN_ID]: adminCallbacks, [directory.GYM_DEMO_PRIMARY_TEACHER_ID]: teacherCallbacks },
  });
  assert.ok(admin.paymentControlProps()?.rowActions, "rowActions must reach PaymentControlView");
  const adminGeneralRow = admin.rowActionsProps(directory.GYM_DEMO_GENERAL_STUDENT_ID);
  const adminPersonalizedRow = admin.rowActionsProps(directory.GYM_DEMO_PERSONALIZED_STUDENT_ID);
  assert.equal(adminGeneralRow?.callbacks, adminCallbacks, "must select the currently selected actor's own callbacks object, not another actor's or null");
  assert.equal(adminGeneralRow?.isAdmin, true);
  assert.equal(adminGeneralRow?.blockedAt, "2030-06-01T00:00:00.000Z", "blockedAt must come from this row's own profile record");
  assert.equal(adminPersonalizedRow?.blockedAt, null, "a different row must not reuse another row's blockedAt");

  const teacher = await feesAdapterHarness({
    actorId: directory.GYM_DEMO_PRIMARY_TEACHER_ID, profileStudents, financeState,
    commandCallbacksByActor: { [directory.GYM_DEMO_ADMIN_ID]: adminCallbacks, [directory.GYM_DEMO_PRIMARY_TEACHER_ID]: teacherCallbacks },
  });
  const teacherGeneralRow = teacher.rowActionsProps(directory.GYM_DEMO_GENERAL_STUDENT_ID);
  assert.equal(teacherGeneralRow?.callbacks, teacherCallbacks, "a different actor must get that actor's own callbacks object");
  assert.equal(teacherGeneralRow?.isAdmin, false, "isAdmin must follow the selected actor's own role");
});

/**
 * A row's local edit-modal/pending/error state (owned by DemoGymFeeRowActions) must not survive a
 * persona switch: an editor opened as ADMIN staying open after switching to a TEACHER, or a stale
 * error lingering on the row, is visible in the demo's primary interaction. React only discards a
 * component's local state across a re-render when its `key` prop changes, so this proves the
 * actual contract that guarantees that: the same student's row-action element gets a different
 * React key under a different actor. (finance.resetEpoch is deliberately not part of this key —
 * see the comment at its definition in DemoGymFeesAdapter.tsx.)
 */
test("DemoGymFeeRowActions is keyed by the selected actor, so switching actors discards its local edit/error state", async () => {
  const financeState = createGymFinanceDemoFixture();
  const admin = await feesAdapterHarness({ actorId: directory.GYM_DEMO_ADMIN_ID, profileStudents: [], financeState });
  const teacher = await feesAdapterHarness({ actorId: directory.GYM_DEMO_PRIMARY_TEACHER_ID, profileStudents: [], financeState });

  const studentId = directory.GYM_DEMO_GENERAL_STUDENT_ID;
  const adminKey = admin.rowActionsKey(studentId);
  const teacherKey = teacher.rowActionsKey(studentId);
  assert.ok(adminKey, "the row-action element must carry a React key");
  assert.ok(teacherKey);
  assert.notEqual(adminKey, teacherKey, "the same student's row must get a different key under a different actor, so a persona switch remounts it and discards local edit/error state");
  assert.equal(adminKey, `${directory.GYM_DEMO_ADMIN_ID}:${studentId}`);
  assert.equal(teacherKey, `${directory.GYM_DEMO_PRIMARY_TEACHER_ID}:${studentId}`);
});
