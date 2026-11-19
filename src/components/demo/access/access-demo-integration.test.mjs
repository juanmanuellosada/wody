import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("admin ingress mounts the shared kiosk, keeps the static legacy view unmounted, and exposes a nested history route", async () => {
  const [rootPage, previewPage, rootHistory, previewHistory] = await Promise.all([
    source("src/app/demo/admin/ingresos/page.tsx"),
    source("preview/landing/app/demo/admin/ingresos/page.tsx"),
    source("src/app/demo/admin/ingresos/historial/page.tsx"),
    source("preview/landing/app/demo/admin/ingresos/historial/page.tsx"),
  ]);

  for (const page of [rootPage, previewPage]) {
    assert.match(page, /DemoAccessKiosk/);
    assert.doesNotMatch(page, /DemoIngresosView|demoIngresosData|estado/);
  }
  for (const page of [rootHistory, previewHistory]) assert.match(page, /DemoAccessHistory/);
});

test("demo access adapters use only shared presentation and preserve functional manual callbacks", async () => {
  const [kiosk, history, navbar, previewLayout] = await Promise.all([
    source("src/components/demo/access/DemoAccessKiosk.tsx"),
    source("src/components/demo/access/DemoAccessHistory.tsx"),
    source("src/components/DemoNavbar.tsx"),
    source("preview/landing/app/demo/layout.tsx"),
  ]);

  assert.match(kiosk, /AccessKioskView/);
  assert.match(kiosk, /onDecideCheckin=\{callbacks\.decideCheckin\}/);
  assert.match(kiosk, /onLookupForKiosk=\{callbacks\.lookupForKiosk\}/);
  assert.match(kiosk, /onCreateManualCheckin=\{callbacks\.createManualCheckin\}/);
  assert.match(kiosk, /QR simulado — no operativo/);
  assert.match(kiosk, /setTimeout\(\(\) => setToast\(null\), 3000\)/);
  assert.doesNotMatch(kiosk, /\bKioskView\b|@\/actions\/access|\/api\/ingresos|qrcode|zxing|getUserMedia|camera|permission|fetch\s*\(/i);
  assert.match(history, /AccessHistoryTable/);
  assert.match(history, /decidedBy: row\.decidedByName === null \? null : \{ name: row\.decidedByName \}/);
  assert.match(history, /row\.user === null/);
  assert.match(navbar, /href === "\/demo\/admin\/ingresos"[\s\S]*pathname\.startsWith\("\/demo\/admin\/ingresos\/"\)/);
  assert.match(previewLayout, /"\/demo\/admin\/ingresos"/);
  assert.match(previewLayout, /"\/demo\/admin\/ingresos\/historial"/);
});

test("finance roster bridge is stable, detached, and synchronous for access callbacks", async () => {
  const [finance, provider] = await Promise.all([
    source("src/components/demo/finance/DemoFinanceProvider.tsx"),
    source("src/components/demo/access/DemoAccessProvider.tsx"),
  ]);

  assert.match(finance, /const getAccessStudents = useCallback\(\(\): readonly FinanceStudent\[\] => \([\s\S]*stateRef\.current\.students\.map/);
  assert.match(finance, /assignedTeachers: student\.assignedTeachers\.map\(\(teacher\) => \(\{ \.\.\.teacher \}\)\)/);
  assert.match(finance, /getAccessStudents,/);
  assert.match(provider, /getStudents: finance\.getAccessStudents/);
});
