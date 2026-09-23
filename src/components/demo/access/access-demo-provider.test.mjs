import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("access provider hydrates once after finance, reads before writes, and owns only its ledger namespace", async () => {
  const [provider, storage, layout, previewLayout] = await Promise.all([
    source("src/components/demo/access/DemoAccessProvider.tsx"),
    source("src/components/demo/access/access-demo-storage.ts"),
    source("src/app/demo/layout.tsx"),
    source("preview/landing/app/demo/layout.tsx"),
  ]);

  assert.match(provider, /if \(!finance\.ready \|\| hydratedRef\.current\) return;/);
  assert.match(provider, /hydratedRef\.current = true;[\s\S]*window\.sessionStorage[\s\S]*loadAccessDemoState\(storage, createAccessDemoFixture\(finance\.state\.anchor\)\)[\s\S]*storageRef\.current = storage;[\s\S]*setReady\(true\);/);
  assert.match(provider, /callbacksRef\.current\?\.cancelPending\(\);/);
  assert.match(provider, /useEffect\(\(\) => \(\) => \{[\s\S]*cancelPending\(\);/);
  assert.match(provider, /resetEpochRef\.current \+= 1;[\s\S]*setResetEpoch/);
  assert.doesNotMatch(provider, /finance\.reset|finance\.callbacks|finance\.saleCallbacks|finance\.revenueCallbacks/);
  assert.match(storage, /ACCESS_DEMO_STORAGE_KEY/);
  assert.doesNotMatch(storage, /wody-box-finance-demo|wody-box-training|turnos/);
  assert.equal((layout.match(/<DemoAccessProvider>/g) ?? []).length, 1);
  assert.equal((previewLayout.match(/<DemoAccessProvider>/g) ?? []).length, 1);
  assert.ok(layout.indexOf("<DemoFinanceProvider>") < layout.indexOf("<DemoAccessProvider>"));
});

test("access reset remounts only access forms while finance reset does not touch access state", async () => {
  const [provider, kiosk, finance] = await Promise.all([
    source("src/components/demo/access/DemoAccessProvider.tsx"),
    source("src/components/demo/access/DemoAccessKiosk.tsx"),
    source("src/components/demo/finance/DemoFinanceProvider.tsx"),
  ]);

  assert.match(kiosk, /<DemoAccessKioskContent key=\{access\.resetEpoch\} \/>/);
  assert.match(provider, /const reset = useCallback\(\(\) => \{[\s\S]*createAccessDemoFixture\(finance\.state\.anchor\)[\s\S]*setResetEpoch/);
  const financeReset = finance.slice(finance.indexOf("const reset = useCallback"), finance.indexOf("const value = useMemo"));
  assert.doesNotMatch(financeReset, /createAccessDemoFixture|persistAccessDemoState|resetAccess|access\.reset/i);
});
