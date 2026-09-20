import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("finance provider hydrates before exposing callbacks and preserves its storage boundary", async () => {
  const [provider, storage, rootLayout, previewLayout] = await Promise.all([
    source("src/components/demo/finance/DemoFinanceProvider.tsx"),
    source("src/components/demo/finance/finance-demo-storage.ts"),
    source("src/app/demo/layout.tsx"),
    source("preview/landing/app/demo/layout.tsx"),
  ]);

  assert.match(provider, /useEffect\(\(\) => \{[\s\S]*window\.sessionStorage[\s\S]*loadFinanceDemoState\(storage, createFinanceDemoFixture\(nextToday\)\)[\s\S]*window\.setTimeout[\s\S]*setReady\(true\);[\s\S]*return \(\) => window\.clearTimeout\(timer\);[\s\S]*\}, \[commit\]\);/);
  assert.match(provider, /callbacks: ready \? callbacks : null/);
  assert.doesNotMatch(provider, /localStorage|setItem\(".*actor|actor.*sessionStorage/);
  assert.match(provider, /persistFinanceDemoState\(storageRef\.current, next\)/);
  assert.match(storage, /FINANCE_DEMO_STORAGE_KEY = "wody-box-finance-demo-v1"/);
  assert.doesNotMatch(storage, /wody-box-training|turnos/);
  assert.equal((rootLayout.match(/<DemoFinanceProvider>/g) ?? []).length, 1);
  assert.equal((previewLayout.match(/<DemoFinanceProvider>/g) ?? []).length, 1);
});

test("finance-only reset cancels confirmation bindings and rebuilds fixtures from Argentina today", async () => {
  const [provider, cash] = await Promise.all([
    source("src/components/demo/finance/DemoFinanceProvider.tsx"),
    source("src/components/demo/finance/DemoCashAdapter.tsx"),
  ]);
  assert.match(provider, /callbacks\?\.ADMIN\.cancelPendingDuplicate\(\);/);
  assert.match(provider, /callbacks\?\.TEACHER\.cancelPendingDuplicate\(\);/);
  assert.match(provider, /const nextToday = argentinaToday\(\);[\s\S]*createFinanceDemoFixture\(nextToday\)/);
  assert.match(cash, /Solo se restablecen las cuotas/);
  assert.doesNotMatch(provider, /setState\(\(previous\)/);
});
