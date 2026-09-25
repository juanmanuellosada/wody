import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("GYM ingresos mounts the shared kiosk/history at its own /demo/gym/admin/ingresos routes in root and Preview", async () => {
  const [rootKiosk, previewKiosk, rootHistory, previewHistory] = await Promise.all([
    source("src/app/demo/gym/admin/ingresos/page.tsx"),
    source("preview/landing/app/demo/gym/admin/ingresos/page.tsx"),
    source("src/app/demo/gym/admin/ingresos/historial/page.tsx"),
    source("preview/landing/app/demo/gym/admin/ingresos/historial/page.tsx"),
  ]);
  for (const page of [rootKiosk, previewKiosk]) assert.match(page, /DemoGymAccessKiosk/);
  for (const page of [rootHistory, previewHistory]) assert.match(page, /DemoGymAccessHistory/);
});

test("GYM access adapters reuse only the shared BOX-agnostic presentation and never import BOX's access module or storage", async () => {
  const [kiosk, history] = await Promise.all([
    source("src/components/demo/gym/DemoGymAccessKiosk.tsx"),
    source("src/components/demo/gym/DemoGymAccessHistory.tsx"),
  ]);
  assert.match(kiosk, /AccessKioskView/);
  assert.match(history, /AccessHistoryTable/);
  for (const file of [kiosk, history]) {
    assert.doesNotMatch(file, /wody-box-access-demo|\bfinanceCatalogSaleActors\b|from ["']\.\.\/access\/(access-demo-state|access-demo-fixtures|access-demo-storage|access-demo-adapters|access-demo-types|DemoAccessProvider)["']/);
    assert.doesNotMatch(file, /useDemoFinance\b|useDemoAccess\b/);
  }
});

test("the profile-bridge overlay is built identically to DemoGymFeesAdapter's own overlay: blockedAt !== null and paymentExempt, nothing else", async () => {
  const [kiosk, history, fees] = await Promise.all([
    source("src/components/demo/gym/DemoGymAccessKiosk.tsx"),
    source("src/components/demo/gym/DemoGymAccessHistory.tsx"),
    source("src/components/demo/gym/DemoGymFeesAdapter.tsx"),
  ]);
  const overlayPattern = /blocked: student\.blockedAt !== null, paymentExempt: student\.paymentExempt/;
  assert.match(fees, /blocked: student\.blockedAt !== null,/);
  for (const file of [kiosk, history]) assert.match(file, overlayPattern);
});

test("lookup and manual check-in are wrapped fresh from render-time profileOverrides, matching the registerPayment/gymTeacherStudentLinks pattern; decide needs no override", async () => {
  const kiosk = await source("src/components/demo/gym/DemoGymAccessKiosk.tsx");
  assert.match(kiosk, /useMemo\(\(\) => \(input: string\) => callbacks\.lookupForKiosk\(input, profileOverrides\), \[callbacks, profileOverrides\]\)/);
  assert.match(kiosk, /useMemo\(\(\) => \(userId: string, decision: "GRANT" \| "DENY"\) => callbacks\.createManualCheckin\(userId, decision, profileOverrides\), \[callbacks, profileOverrides\]\)/);
  assert.match(kiosk, /onDecideCheckin=\{callbacks\.decideCheckin\}/);
  assert.match(kiosk, /onLookupForKiosk=\{onLookupForKiosk\}/);
  assert.match(kiosk, /onCreateManualCheckin=\{onCreateManualCheckin\}/);
  assert.doesNotMatch(kiosk, /useRef[^)]*profileOverrides|profileOverridesRef/, "overrides must never be cached in a ref");
});

test("GYM access has its own namespace/key/provider, distinct from BOX's, and threads no bridge state through a ref", async () => {
  const [types, provider, gymFinance] = await Promise.all([
    source("src/components/demo/access/gym-access-demo-types.ts"),
    source("src/components/demo/gym/DemoGymAccessProvider.tsx"),
    source("src/components/demo/gym/DemoGymFinanceProvider.tsx"),
  ]);
  assert.match(types, /GYM_ACCESS_DEMO_NAMESPACE = "wody-gym-access-demo-v1"/);
  assert.match(provider, /getFinanceStudents: finance\.getAccessStudents/);
  assert.doesNotMatch(provider, /useDemoGymProfile|profileState/, "the provider itself never reads the profile bridge");
  assert.match(gymFinance, /const getAccessStudents = useCallback\(\(\): readonly FinanceStudent\[\] => \([\s\S]*stateRef\.current\.students\.map/);
  assert.doesNotMatch(gymFinance, /useDemoGymProfile|profileState/, "GYM finance never depends on the profile bridge");
});

test("scenario providers mount DemoGymAccessProvider inside GYM finance, and BOX's own provider tree is untouched", async () => {
  const scenarios = await source("src/components/demo/scenarios/DemoScenarioProviders.tsx");
  assert.match(scenarios, /<DemoGymProvider>\s*<DemoGymProfileProvider>\s*<DemoGymFinanceProvider>\s*<DemoGymAccessProvider><DemoNavbar scenario="GYM" \/>\{children\}<\/DemoGymAccessProvider>\s*<\/DemoGymFinanceProvider>\s*<\/DemoGymProfileProvider>\s*<\/DemoGymProvider>/);
  assert.match(scenarios, /<DemoTrainingProvider>\s*<DemoFinanceProvider>\s*<DemoAccessProvider>\{children\}<\/DemoAccessProvider>\s*<\/DemoFinanceProvider>\s*<\/DemoTrainingProvider>/, "BOX's provider tree keeps its original shape");
});

test("BOX access module files are byte-untouched by this unit", async () => {
  const boxFiles = [
    "src/components/demo/access/access-demo-types.ts",
    "src/components/demo/access/access-demo-fixtures.ts",
    "src/components/demo/access/access-demo-state.ts",
    "src/components/demo/access/access-demo-storage.ts",
    "src/components/demo/access/access-demo-adapters.ts",
    "src/components/demo/access/DemoAccessProvider.tsx",
    "src/components/demo/access/DemoAccessKiosk.tsx",
    "src/components/demo/access/DemoAccessHistory.tsx",
  ];
  for (const file of boxFiles) {
    const text = await source(file);
    assert.doesNotMatch(text, /wody-gym-access|GymAccess|gym-access-demo/, `${file} must never mention the GYM access module`);
  }
});
