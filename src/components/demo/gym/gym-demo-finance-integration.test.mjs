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
  assert.match(fees, /editar el nombre, bloquear o desbloquear, marcar exenciones de pago y asignar o quitar profes/);
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
// profileLinks defaults to [] (not undefined): the real GymDemoProfileState.links field is a
// non-optional array by type, so every call site gets a value that satisfies that guarantee unless
// it deliberately opts into something else.
async function feesAdapterHarness({ actorId, profileStudents, financeState, commandCallbacksByActor = null, profileLinks = [] }) {
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
  // Records every call the wrapper makes to the raw factory callback, so a caller can inspect
  // exactly what arguments (including the 5th, gymTeacherStudentLinks) reached it.
  const rawPaymentCalls = [];
  const rawPaymentCallback = Object.assign(
    async (...args) => { rawPaymentCalls.push(args); return { success: true }; },
    { cancelPendingDuplicate },
  );
  const paymentCallbacks = new Map([[actorId, rawPaymentCallback]]);
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
    "./DemoGymProfileProvider": { useDemoGymProfile: () => ({ profileState: { students: profileStudents, links: profileLinks }, commandCallbacks }) },
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
    rawPaymentCalls,
    rawPaymentCallback,
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
 * Proves DemoGymFeesAdapter itself (not just the pure projection module in isolation) threads
 * profileState.links into both projectGymFinanceFeesData and projectGymFinancePaymentStudentSelection:
 * a bridge link change must move the real rendered Cuotas rows and the real payment picker together.
 */
test("DemoGymFeesAdapter threads the profile bridge's teacher-student links into the real Cuotas scoping and the real payment picker, and they agree", async () => {
  const financeState = createGymFinanceDemoFixture();
  const secondaryTeacher = directory.GYM_DEMO_SECONDARY_TEACHER_ID;

  // Canonically unassigned: an empty bridge link set leaves the secondary teacher with zero
  // students, same as the canonical directory does for them. (The pure `undefined` ->
  // canonical-fallback contract this used to lean on is tested directly, without needing the
  // adapter, in gym-finance-demo-projection.test.mjs's "real adapter-built bridge link snapshot at
  // first load" test — profileState.links is a non-optional array by type in the real app, so this
  // adapter never actually omits it.)
  const withoutLinks = await feesAdapterHarness({ actorId: secondaryTeacher, profileStudents: [], financeState, profileLinks: [] });
  assert.deepEqual(withoutLinks.paymentControlProps()?.rows.map((row) => row.id), []);
  assert.deepEqual(withoutLinks.registerPaymentProps()?.students.map((student) => student.id), []);

  // Adding a bridge link must make the same student appear on BOTH surfaces.
  const added = await feesAdapterHarness({
    actorId: secondaryTeacher,
    profileStudents: [],
    financeState,
    profileLinks: [{ teacherId: secondaryTeacher, studentId: directory.GYM_DEMO_GENERAL_STUDENT_ID }],
  });
  assert.deepEqual(added.paymentControlProps()?.rows.map((row) => row.id), [directory.GYM_DEMO_GENERAL_STUDENT_ID]);
  assert.deepEqual(added.registerPaymentProps()?.students.map((student) => student.id), [directory.GYM_DEMO_GENERAL_STUDENT_ID]);

  // Removing a canonical link (primary teacher, empty bridge link set) must remove that student
  // from BOTH surfaces even though the canonical directory still links them.
  const primaryTeacher = directory.GYM_DEMO_PRIMARY_TEACHER_ID;
  const removed = await feesAdapterHarness({ actorId: primaryTeacher, profileStudents: [], financeState, profileLinks: [] });
  assert.deepEqual(removed.paymentControlProps()?.rows.map((row) => row.id), []);
  assert.deepEqual(removed.registerPaymentProps()?.students.map((student) => student.id), []);

  // A link naming an id other than the acting teacher grants that teacher nothing. Redundantly
  // rejected: isActiveGymTeacherOrAdmin excludes "not-a-real-teacher" first (it does not resolve to
  // an active TEACHER/ADMIN at all), and the downstream `link.teacherId === actor.id` match would
  // exclude it too (it is not secondaryTeacher's id). This does not isolate or prove either check
  // alone — see the comment on isActiveGymTeacherOrAdmin in finance-demo-policy.ts for why no test
  // in this codebase can isolate it.
  const linkForSomeoneElse = await feesAdapterHarness({
    actorId: secondaryTeacher,
    profileStudents: [],
    financeState,
    profileLinks: [{ teacherId: "not-a-real-teacher", studentId: directory.GYM_DEMO_GENERAL_STUDENT_ID }],
  });
  assert.deepEqual(linkForSomeoneElse.paymentControlProps()?.rows.map((row) => row.id), []);
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
    // Unrelated to what this test proves (actor-scoped callbacks/isAdmin), but the row must exist
    // in this teacher's scope at all: a bridge link is required now that profileLinks defaults to
    // an empty (not canonical-fallback) set.
    profileLinks: [{ teacherId: directory.GYM_DEMO_PRIMARY_TEACHER_ID, studentId: directory.GYM_DEMO_GENERAL_STUDENT_ID }],
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
  // Unrelated to what this test proves (the React key), but the row must exist in this teacher's
  // scope at all: a bridge link is required now that profileLinks defaults to an empty set.
  const teacher = await feesAdapterHarness({
    actorId: directory.GYM_DEMO_PRIMARY_TEACHER_ID, profileStudents: [], financeState,
    profileLinks: [{ teacherId: directory.GYM_DEMO_PRIMARY_TEACHER_ID, studentId: directory.GYM_DEMO_GENERAL_STUDENT_ID }],
  });

  const studentId = directory.GYM_DEMO_GENERAL_STUDENT_ID;
  const adminKey = admin.rowActionsKey(studentId);
  const teacherKey = teacher.rowActionsKey(studentId);
  assert.ok(adminKey, "the row-action element must carry a React key");
  assert.ok(teacherKey);
  assert.notEqual(adminKey, teacherKey, "the same student's row must get a different key under a different actor, so a persona switch remounts it and discards local edit/error state");
  assert.equal(adminKey, `${directory.GYM_DEMO_ADMIN_ID}:${studentId}`);
  assert.equal(teacherKey, `${directory.GYM_DEMO_PRIMARY_TEACHER_ID}:${studentId}`);
});

/**
 * The assignment pool a row offers must be exactly the active canonical TEACHER/ADMIN profiles —
 * the same predicate the core (gym-demo-profile-core.ts's activeTeacherIds) and
 * finance-demo-policy.ts's isActiveGymTeacherOrAdmin already enforce, so the UI never offers an
 * option the core would reject. This is the row's assignedTeachers/availableTeachers props, not
 * the source text, and it is the one property of the restored control no other test in this file
 * checks directly.
 */
test("DemoGymFeesAdapter's assignment pool for a row is exactly the active canonical TEACHER/ADMIN profiles, never a STUDENT", async () => {
  const financeState = createGymFinanceDemoFixture();
  const admin = await feesAdapterHarness({
    actorId: directory.GYM_DEMO_ADMIN_ID, profileStudents: [], financeState, profileLinks: [],
  });
  const row = admin.rowActionsProps(directory.GYM_DEMO_GENERAL_STUDENT_ID);
  assert.ok(row, "row must be present for ADMIN");
  assert.deepEqual(row.assignedTeachers, [], "no links: nobody assigned yet");
  const availableIds = row.availableTeachers.map((t) => t.id).sort();
  assert.deepEqual(availableIds, [
    directory.GYM_DEMO_ADMIN_ID,
    directory.GYM_DEMO_PRIMARY_TEACHER_ID,
    directory.GYM_DEMO_SECONDARY_TEACHER_ID,
  ].sort(), "must be exactly the active canonical TEACHER/ADMIN profiles");
  assert.ok(!availableIds.includes(directory.GYM_DEMO_GENERAL_STUDENT_ID), "a STUDENT must never appear in the teacher pool");
});

/**
 * Proves the adapter half of the redesigned fix: DemoGymFeesAdapter wraps the raw payment
 * callback so RegisterPaymentSectionView's onRegisterPayment always passes THIS render's
 * profileState.links as the 5th argument to the real factory call — a plain parameter, not a
 * separate "remember to sync first" step. The factory-level mechanism (that argument actually
 * reaching canRecordFinancePayment, and that no call can leak state into or rewind another's) is
 * pinned separately in gym-finance-payment-adapters.test.mjs; this proves the wiring that makes it
 * reachable from the UI at all, with the CURRENT render's links, not a stale one.
 */
test("DemoGymFeesAdapter's payment dispatch passes THIS render's profileState.links as the 5th argument to the real payment callback", async () => {
  const financeState = createGymFinanceDemoFixture();
  const links = [{ teacherId: directory.GYM_DEMO_PRIMARY_TEACHER_ID, studentId: directory.GYM_DEMO_GENERAL_STUDENT_ID }];
  const harness = await feesAdapterHarness({
    actorId: directory.GYM_DEMO_ADMIN_ID, profileStudents: [], financeState, profileLinks: links,
  });
  const onRegisterPayment = harness.registerPaymentProps()?.onRegisterPayment;
  assert.equal(typeof onRegisterPayment, "function", "RegisterPaymentSectionView must receive a dispatch function");
  assert.notEqual(onRegisterPayment, harness.rawPaymentCallback, "must be a wrapper, not the raw factory callback itself");

  const options = { paidAtStr: "2030-06-03", paymentMethod: "EFECTIVO", confirmedDuplicate: false };
  const result = await onRegisterPayment(directory.GYM_DEMO_GENERAL_STUDENT_ID, "100", "2030-07-03", options);

  assert.deepEqual(result, { success: true });
  assert.equal(harness.rawPaymentCalls.length, 1);
  assert.deepEqual(
    harness.rawPaymentCalls[0],
    [directory.GYM_DEMO_GENERAL_STUDENT_ID, "100", "2030-07-03", options, links],
    "the real callback must receive the caller's exact 4 arguments plus this render's own links as the 5th",
  );

  // cancelPendingDuplicate does not need link-freshness: it must stay the original, unwrapped
  // reference so cancellation behavior (proven elsewhere) is untouched by this fix.
  assert.equal(harness.registerPaymentProps()?.onCancelPendingDuplicate, harness.rawPaymentCallback.cancelPendingDuplicate);
});

/**
 * The prior link-related tests in this file use profileLinks: [] (empty) or exercise only the
 * scoping/authorization projection, never DemoGymFeesAdapter's own link-to-row mapping
 * (assignedTeacherIdsByStudent, staffById, and the availableTeachers exclusion). All three could
 * regress unobserved: grouping by studentId (a link for the wrong student leaking onto a row),
 * mapping an assigned id to a staff display name (or falling back to the raw id when the id names
 * no known staff member — e.g. a stale/unknown teacherId), and excluding already-assigned ids from
 * the pool a row still offers to assign.
 */
test("DemoGymFeesAdapter maps real bridge links into assignedTeachers/availableTeachers per row: grouped by student, named by staff, excluded from the pool, with a raw-id fallback for an unknown teacher", async () => {
  const financeState = createGymFinanceDemoFixture();
  const links = [
    { teacherId: directory.GYM_DEMO_PRIMARY_TEACHER_ID, studentId: directory.GYM_DEMO_GENERAL_STUDENT_ID },
    { teacherId: directory.GYM_DEMO_SECONDARY_TEACHER_ID, studentId: directory.GYM_DEMO_GENERAL_STUDENT_ID },
    { teacherId: directory.GYM_DEMO_PRIMARY_TEACHER_ID, studentId: directory.GYM_DEMO_PERSONALIZED_STUDENT_ID },
    { teacherId: "not-a-real-teacher", studentId: directory.GYM_DEMO_MUSLIB_STUDENT_ID },
  ];
  const harness = await feesAdapterHarness({
    actorId: directory.GYM_DEMO_ADMIN_ID, profileStudents: [], financeState, profileLinks: links,
  });

  const generalRow = harness.rowActionsProps(directory.GYM_DEMO_GENERAL_STUDENT_ID);
  assert.ok(generalRow, "row must be present for ADMIN");
  assert.deepEqual(
    generalRow.assignedTeachers.map((t) => t.id).sort(),
    [directory.GYM_DEMO_PRIMARY_TEACHER_ID, directory.GYM_DEMO_SECONDARY_TEACHER_ID].sort(),
    "grouped correctly: both of this student's own links, not the other student's link",
  );
  assert.equal(
    generalRow.assignedTeachers.find((t) => t.id === directory.GYM_DEMO_PRIMARY_TEACHER_ID)?.name,
    "Tomás Ríos",
    "an assigned id must be mapped to its staff display name, not left as a bare id",
  );
  const generalAvailableIds = generalRow.availableTeachers.map((t) => t.id);
  assert.ok(!generalAvailableIds.includes(directory.GYM_DEMO_PRIMARY_TEACHER_ID), "an already-assigned teacher must not also appear in availableTeachers");
  assert.ok(!generalAvailableIds.includes(directory.GYM_DEMO_SECONDARY_TEACHER_ID));
  assert.ok(generalAvailableIds.includes(directory.GYM_DEMO_ADMIN_ID), "ADMIN, not assigned to this student, stays available to be assigned");

  const personalizedRow = harness.rowActionsProps(directory.GYM_DEMO_PERSONALIZED_STUDENT_ID);
  assert.ok(personalizedRow, "row must be present for ADMIN");
  assert.deepEqual(
    personalizedRow.assignedTeachers.map((t) => t.id),
    [directory.GYM_DEMO_PRIMARY_TEACHER_ID],
    "this student's own single link only, not the general student's second link leaking across rows",
  );

  const muslibRow = harness.rowActionsProps(directory.GYM_DEMO_MUSLIB_STUDENT_ID);
  assert.ok(muslibRow, "row must be present for ADMIN");
  assert.deepEqual(
    muslibRow.assignedTeachers,
    [{ id: "not-a-real-teacher", name: "not-a-real-teacher" }],
    "a teacherId that names no known staff member falls back to using the raw id as its own display name",
  );
});
