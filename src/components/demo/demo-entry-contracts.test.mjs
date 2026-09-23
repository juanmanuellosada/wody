import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

const roles = [
  ["admin", "ADMIN"],
  ["teacher", "TEACHER"],
  ["student", "STUDENT"],
];

test("role-specific turnos entries preserve their initial identity contract", async () => {
  for (const [role, initialRole] of roles) {
    const [rootPage, previewPage] = await Promise.all([
      source(`src/app/demo/${role}/turnos/page.tsx`),
      source(`preview/landing/app/demo/${role}/turnos/page.tsx`),
    ]);

    assert.match(rootPage, /export const metadata: Metadata/);
    assert.match(rootPage, /<DemoNavbar \/>/);
    assert.match(rootPage, new RegExp(`<BoxBookingDemo initialRole="${initialRole}"`));
    assert.doesNotMatch(rootPage, /<main\b/);

    assert.match(previewPage, new RegExp(`<BoxBookingDemo initialRole="${initialRole}"`));
    assert.doesNotMatch(previewPage, /DemoNavbar/);
    assert.match(previewPage, /export default function/);
  }
});

test("demo navigation has one turnos link for each role", async () => {
  const navbar = await source("src/components/DemoNavbar.tsx");
  for (const role of roles.map(([role]) => role)) {
    const href = `href: "/demo/${role}/turnos", label: "Turnos"`;
    assert.equal(navbar.split(href).length - 1, 1, `${role} has one Turnos entry`);
  }
});

test("admin access demo has kiosk and history parity without teacher or student ingress routes", async () => {
  const [rootKiosk, previewKiosk, rootHistory, previewHistory, previewLayout] = await Promise.all([
    source("src/app/demo/admin/ingresos/page.tsx"),
    source("preview/landing/app/demo/admin/ingresos/page.tsx"),
    source("src/app/demo/admin/ingresos/historial/page.tsx"),
    source("preview/landing/app/demo/admin/ingresos/historial/page.tsx"),
    source("preview/landing/app/demo/layout.tsx"),
  ]);
  for (const page of [rootKiosk, previewKiosk]) assert.match(page, /DemoAccessKiosk/);
  for (const page of [rootHistory, previewHistory]) assert.match(page, /DemoAccessHistory/);
  assert.equal((previewLayout.match(/"\/demo\/admin\/ingresos"/g) ?? []).length, 1);
  assert.equal((previewLayout.match(/"\/demo\/admin\/ingresos\/historial"/g) ?? []).length, 1);
});

test("demo benefits are local, non-redeemable fixtures without dead social links", async () => {
  const [page, fixture, view, previewPage] = await Promise.all([
    source("src/app/demo/student/beneficios/page.tsx"),
    source("src/components/demo/demo-benefits-fixtures.ts"),
    source("src/components/demo/DemoBeneficiosView.tsx"),
    source("preview/landing/app/demo/student/beneficios/page.tsx"),
  ]);

  assert.doesNotMatch(page, /listCouponsPreview|@\/actions\/coupon|\bfetch\s*\(/);
  assert.match(page, /demoBenefitsFixtures/);
  assert.match(fixture, /import type \{ AvailableCoupon \} from "@\/actions\/coupon"/);
  assert.match(fixture, /export const demoBenefitsFixtures: AvailableCoupon\[\]/);
  assert.doesNotMatch(fixture, /https?:\/\//);

  for (const field of [
    "id",
    "slug",
    "name",
    "description",
    "instagramHandle",
    "instagramUrl",
    "logoKey",
    "rule",
    "pendingCode",
    "blocked",
    "blockedReason",
    "fixedCode",
    "websiteUrl",
    "restrictions",
  ]) {
    assert.match(fixture, new RegExp(`${field}:`));
  }
  assert.equal((fixture.match(/pendingCode: null/g) ?? []).length, 3);
  assert.equal((fixture.match(/fixedCode: null/g) ?? []).length, 3);
  assert.match(view, /Beneficios de demostración; no se generan códigos ni descuentos reales\./);
  assert.match(view, /coupon\.instagramUrl && coupon\.instagramHandle/);
  assert.match(view, /disabled/);
  assert.match(previewPage, /DemoBeneficiosView/);
  assert.doesNotMatch(previewPage, /DemoNavbar/);
});
