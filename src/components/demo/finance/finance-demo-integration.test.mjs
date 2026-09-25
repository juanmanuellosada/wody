import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { projectFinancePaymentStudents } from "./finance-demo-adapters.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { selectFeeStudents } from "./fees-contract.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { demoFeeIdentities } from "./fees-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createFinanceDemoFixture, registerFinancePayment } from "./finance-demo-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { getTodayArgentina, toInputDate } from "../../../lib/dates.ts";

const root = new URL("../../../../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

async function pageCount(directory) {
  let count = 0;
  for (const entry of await readdir(new URL(directory, root), { withFileTypes: true })) {
    if (entry.isDirectory()) count += await pageCount(`${directory}/${entry.name}`);
    if (entry.isFile() && entry.name === "page.tsx") count += 1;
  }
  return count;
}

test("Argentina date policy keeps a UTC-midnight payment prefill valid for the local reducer", () => {
  const RealDate = globalThis.Date;
  class OctoberFirstUtc extends RealDate {
    constructor(...args) {
      super(args.length === 0 ? "2026-10-01T01:30:00.000Z" : args[0]);
    }
  }
  globalThis.Date = OctoberFirstUtc;
  try {
    const argentinaDate = toInputDate(getTodayArgentina());
    assert.equal(argentinaDate, "2026-09-30");
    const transition = registerFinancePayment(createFinanceDemoFixture(argentinaDate), {
      id: "midnight-payment",
      commandId: "midnight-command",
      actor: { id: "finance-admin", role: "ADMIN" },
      studentId: "fee-student-juan",
      amountInput: "100",
      paidAt: argentinaDate,
      nextPaymentDate: "2026-10-30",
      paymentMethod: "EFECTIVO",
      confirmedDuplicate: false,
    }, argentinaDate);
    assert.equal(transition.result.success, true, "the Argentina-date prefill is not rejected as future");
  } finally {
    globalThis.Date = RealDate;
  }
});

test("Caja routes use the actual local callback and scope teacher picker before payment projection", async () => {
  const [adapter, rootAdmin, rootTeacher, previewAdmin, previewTeacher] = await Promise.all([
    source("src/components/demo/finance/DemoCashAdapter.tsx"),
    source("src/app/demo/admin/caja/page.tsx"),
    source("src/app/demo/teacher/caja/page.tsx"),
    source("preview/landing/app/demo/admin/caja/page.tsx"),
    source("preview/landing/app/demo/teacher/caja/page.tsx"),
  ]);

  assert.match(adapter, /selectFeeStudents\(finance\.state\.students, identity\)/);
  assert.match(adapter, /projectFinancePaymentStudents\(finance\.state\)\.filter/);
  assert.match(adapter, /onRegisterPayment=\{callback\}/);
  assert.match(adapter, /onCancelPendingDuplicate=\{callback\.cancelPendingDuplicate\}/);
  assert.match(adapter, /datePolicy=\{\{ today: \(\) => finance\.today \}\}/);
  assert.match(adapter, /Datos ficticios guardados solo en esta pestaña/);
  assert.match(adapter, /no genera recibos, cobros ni checkout reales/);
  assert.doesNotMatch(adapter, /demo=\{true\}|RevenuePanel/);
  assert.match(adapter, /NewSaleButtonView/);
  assert.match(adapter, /expenseAction=\{role === "ADMIN" \? <DemoExpenseAction \/> : null\}/);
  assert.match(adapter, /role === "ADMIN" && <DemoRevenueAdapter \/>/);
  for (const [page, role] of [[rootAdmin, "ADMIN"], [rootTeacher, "TEACHER"], [previewAdmin, "ADMIN"], [previewTeacher, "TEACHER"]]) {
    assert.match(page, /DemoCashAdapter/);
    assert.match(page, new RegExp(`role="${role}"`));
    assert.doesNotMatch(page, /RegisterPaymentDialog|RegisterPaymentSection/);
  }
  assert.match(rootAdmin, /<DemoNavbar \/>/);
  assert.match(rootTeacher, /<DemoNavbar \/>/);
  assert.doesNotMatch(previewAdmin, /DemoNavbar/);
  assert.doesNotMatch(previewTeacher, /DemoNavbar/);
});

test("teacher projection cannot expose foreign fictional students while reducer scope remains independently revalidated", () => {
  const state = createFinanceDemoFixture("2030-06-03");
  const visibleIds = new Set(selectFeeStudents(state.students, demoFeeIdentities.teacher).map((student) => student.id));
  const picker = projectFinancePaymentStudents(state).filter((student) => visibleIds.has(student.id));
  assert.deepEqual(picker.map((student) => student.name), [
    "Juan Pérez", "María García", "Lucas Rodríguez", "Camila Suárez", "Valentina Ruiz",
  ]);
  assert.equal(picker.some((student) => student.name === "Sofía López" || student.name === "Tomás Fernández"), false);
  assert.equal(picker.find((student) => student.id === "fee-student-camila")?.lastAmount, null);
});

test("Caja shell keeps production action slots and static exports retain bounded demo pages plus named admin access routes", async () => {
  const [shell, production, navbar, overview, previewLayout, rootKiosk, rootHistory, previewKiosk, previewHistory, rootPages, previewPages] = await Promise.all([
    source("src/components/caja/CajaShell.tsx"),
    source("src/app/[gymSlug]/caja/page.tsx"),
    source("src/components/DemoNavbar.tsx"),
    source("src/components/demo/training/DemoTrainingOverview.tsx"),
    source("preview/landing/app/demo/layout.tsx"),
    source("src/app/demo/admin/ingresos/page.tsx"),
    source("src/app/demo/admin/ingresos/historial/page.tsx"),
    source("preview/landing/app/demo/admin/ingresos/page.tsx"),
    source("preview/landing/app/demo/admin/ingresos/historial/page.tsx"),
    pageCount("src/app/demo"),
    pageCount("preview/landing/app/demo"),
  ]);
  assert.match(shell, /quotaAction\?: ReactNode/);
  assert.match(shell, /saleAction\?: ReactNode/);
  assert.match(shell, /expenseAction\?: ReactNode/);
  assert.match(production, /<CajaShell/);
  assert.match(production, /saleAction=\{<NewSaleButton products=\{productCatalog\} size="lg" \/>\}/);
  assert.match(production, /expenseAction=\{showRevenue \? <RegisterExpenseButton size="lg" \/> : null\}/);
  assert.match(production, /quotaAction=\{paymentStudents\.length > 0 \? <RegisterPaymentButton students=\{paymentStudents\} size="lg" \/> : null\}/);
  for (const route of ["/demo/admin/caja", "/demo/teacher/caja"]) {
    assert.match(navbar, new RegExp(`href: "${route}"`));
    assert.match(previewLayout, new RegExp(`"${route}"`));
  }
  assert.match(overview, /href: "\/demo\/admin\/caja", label: "Caja"/);
  assert.match(previewLayout, /"\/demo\/admin\/ingresos"/);
  assert.match(previewLayout, /"\/demo\/admin\/ingresos\/historial"/);
  for (const page of [rootKiosk, previewKiosk]) assert.match(page, /DemoAccessKiosk/);
  for (const page of [rootHistory, previewHistory]) assert.match(page, /DemoAccessHistory/);
  assert.doesNotMatch(previewLayout, /\/demo\/(teacher|student)\/ingresos/);
  assert.equal(rootPages, 38, "the existing 19 BOX pages, five PERSONAL student pages, and fourteen GYM pages retain the bounded demo inventory");
  assert.equal(previewPages, 38, "the existing 19 Preview BOX pages, five PERSONAL student pages, and fourteen GYM pages retain the bounded demo inventory");
});
