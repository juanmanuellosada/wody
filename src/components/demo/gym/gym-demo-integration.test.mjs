import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import ts from "typescript";
import test from "node:test";

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

async function transpiledModule(path, mocks) {
  const compiled = ts.transpileModule(await source(path), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const commonjsModule = { exports: {} };
  const require = (specifier) => {
    if (!(specifier in mocks)) throw new Error(`Unexpected module: ${specifier}`);
    return mocks[specifier];
  };
  // Controlled CJS evaluation exercises the component/classifier branch without a DOM or Next runtime.
  new Function("require", "exports", "module", compiled)(require, commonjsModule.exports, commonjsModule);
  return commonjsModule.exports;
}

const routes = [
  ["admin/page.tsx", "gym-admin", "ADMIN", "staff"],
  ["admin/rms/page.tsx", "gym-admin-rms", "ADMIN", "rms"],
  ["teacher/page.tsx", "gym-teacher", "TEACHER", "staff"],
  ["teacher/rms/page.tsx", "gym-teacher-rms", "TEACHER", "rms"],
  ["student/page.tsx", "gym-student", "STUDENT", "student"],
  ["student/rms/page.tsx", "gym-student-rms", "STUDENT", "rms"],
  ["student/wod/page.tsx", "gym-student-wod", "STUDENT", "student-wod"],
];

const financeRoutes = [
  ["admin/pagos/page.tsx", "gym-admin-pagos", "ADMIN", "fees"],
  ["admin/caja/page.tsx", "gym-admin-caja", "ADMIN", "cash"],
  ["admin/productos/page.tsx", "gym-admin-productos", "ADMIN", "products"],
  ["teacher/pagos/page.tsx", "gym-teacher-pagos", "TEACHER", "fees"],
  ["teacher/caja/page.tsx", "gym-teacher-caja", "TEACHER", "cash"],
];

test("GYM adds the bounded twelve-route inventory to root and Preview", async () => {
  assert.equal(await pageCount("src/app/demo"), 42);
  assert.equal(await pageCount("preview/landing/app/demo"), 42);
  for (const [leaf, key, role, screen] of routes) {
    const [rootPage, previewPage] = await Promise.all([
      source(`src/app/demo/gym/${leaf}`), source(`preview/landing/app/demo/gym/${leaf}`),
    ]);
    for (const page of [rootPage, previewPage]) {
      assert.match(page, /SharedDemoGymTrainingRoute/);
      assert.match(page, new RegExp(`routeKey="${key}"`));
      assert.match(page, new RegExp(`routeRole="${role}"`));
      assert.match(page, new RegExp(`screen="${screen}"`));
    }
  }
  for (const [leaf, key, role, screen] of financeRoutes) {
    const [rootPage, previewPage] = await Promise.all([
      source(`src/app/demo/gym/${leaf}`), source(`preview/landing/app/demo/gym/${leaf}`),
    ]);
    for (const page of [rootPage, previewPage]) {
      assert.match(page, /SharedDemoGymFinanceRoute/);
      assert.match(page, new RegExp(`routeKey="${key}"`));
      assert.match(page, new RegExp(`routeRole="${role}"`));
      assert.match(page, new RegExp(`screen="${screen}"`));
      assert.match(page, /gym-fixed-(admin|teacher-linked)/);
    }
  }
});

test("trailing-slash hub uses the actual scenario branch and contains the GYM link", async () => {
  let pathname = "/demo/";
  const jsx = (type, props) => ({ type, props: props ?? {} });
  const boxProvider = () => null;
  const gymProvider = () => null;
  const gymProfileProvider = () => null;
  const gymAccessProvider = () => null;
  const personalProvider = () => null;
  const navbar = () => null;
  const scenarios = await transpiledModule("src/components/demo/scenarios/DemoScenarioProviders.tsx", {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "next/navigation": { usePathname: () => pathname },
    "@/components/DemoNavbar": { DemoNavbar: navbar },
    "@/components/demo/access/DemoAccessProvider": { DemoAccessProvider: boxProvider },
    "@/components/demo/finance/DemoFinanceProvider": { DemoFinanceProvider: boxProvider },
    "@/components/demo/personal/DemoPersonalProvider": { DemoPersonalProvider: personalProvider },
    "@/components/demo/training/DemoTrainingProvider": { DemoTrainingProvider: boxProvider },
    "@/components/demo/gym/DemoGymProvider": { DemoGymProvider: gymProvider },
    "@/components/demo/gym/DemoGymProfileProvider": { DemoGymProfileProvider: gymProfileProvider },
    "@/components/demo/gym/DemoGymFinanceProvider": { DemoGymFinanceProvider: gymProvider },
    "@/components/demo/gym/DemoGymAccessProvider": { DemoGymAccessProvider: gymAccessProvider },
  });
  const expected = new Map([
    ["/demo", "BOX"], ["/demo/", "BOX"], ["/demo/admin/", "BOX"], ["/demo/teacher/rms/", "BOX"], ["/demo/student/wod/", "BOX"],
    ["/demo/gym/teacher/", "GYM"], ["/demo/personal/student/", "PERSONAL"],
    ["/demo/gymnasium", null], ["/demo/personalized", null], ["/demo/adminx", null], ["/demo//", null],
  ]);
  for (const [path, scenario] of expected) assert.equal(scenarios.scenarioForPathname(path), scenario, path);
  assert.equal(scenarios.DemoScenarioProviders({ children: "hub" }).type, boxProvider);
  pathname = "/demo/gym/admin/";
  const gymTree = scenarios.DemoScenarioProviders({ children: "gym" });
  assert.equal(gymTree.type, gymProvider);
  assert.equal(gymTree.props.children.type, gymProfileProvider);
  assert.equal(gymTree.props.children.props.children.type, gymProvider);
  assert.equal(gymTree.props.children.props.children.props.children.type, gymAccessProvider);
  assert.equal(gymTree.props.children.props.children.props.children.props.children[0].type, navbar);
  pathname = null;
  assert.equal(scenarios.DemoScenarioProviders({ children: "none" }), null);

  const Link = () => null;
  const overview = await transpiledModule("src/components/demo/training/DemoTrainingOverview.tsx", {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "next/link": { default: Link },
  });
  const rendered = overview.DemoTrainingOverview();
  const stack = [rendered];
  let gymLink = null;
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== "object") continue;
    if (node.type === Link && node.props.href === "/demo/gym/admin") gymLink = node;
    const children = node.props?.children;
    if (Array.isArray(children)) stack.push(...children);
    else stack.push(children);
  }
  assert.equal(gymLink?.props.children?.[0]?.props?.children, "Gimnasio");
});

test("GYM is pathname-gated, has its three ledgers, and preserves other scenario providers", async () => {
  const [provider, scenarios, navbar, layout, trainingStorage, fixedStorage, rmStorage] = await Promise.all([
    source("src/components/demo/gym/DemoGymProvider.tsx"),
    source("src/components/demo/scenarios/DemoScenarioProviders.tsx"),
    source("src/components/DemoNavbar.tsx"),
    source("preview/landing/app/demo/layout.tsx"),
    source("src/components/demo/training/gym-training-demo-storage.ts"),
    source("src/components/demo/training/gym-fixed-demo-storage.ts"),
    source("src/components/demo/training/demo-rm-storage.ts"),
  ]);
  assert.match(trainingStorage, /wody-gym-training-demo-v1/);
  assert.match(fixedStorage, /wody-gym-fixed-routines-demo-v1/);
  assert.match(rmStorage, /wody-gym-rms-demo-v1/);
  assert.match(provider, /GYM_RM_OWNER_IDS[\s\S]*GYM_DEMO_MUSLIB_STUDENT_ID/);
  assert.match(provider, /for \(const actorId of staffIds\)/);
  assert.match(provider, /for \(const ownerId of GYM_RM_OWNER_IDS\)/);
  assert.match(provider, /const restoredTraining[\s\S]*const restoredFixed[\s\S]*const restoredRms[\s\S]*setReady\(true\)/);
  assert.match(provider, /resetDatedTraining[\s\S]*persistGymTrainingDemoState/);
  assert.match(provider, /resetFixedRoutines[\s\S]*persistGymFixedDemoState/);
  assert.match(provider, /resetRms[\s\S]*gymRmStorage\.persist/);
  assert.match(scenarios, /pathname === "\/demo\/gym" \|\| pathname\.startsWith\("\/demo\/gym\/"\)/);
  assert.match(scenarios, /pathname === "\/demo\/admin"[\s\S]*pathname\.startsWith\("\/demo\/student\/"\)[\s\S]*return "BOX"/);
  assert.match(scenarios, /if \(scenario === null\) return null/);
  assert.match(scenarios, /<DemoGymProvider>\s*<DemoGymProfileProvider>\s*<DemoGymFinanceProvider>\s*<DemoGymAccessProvider><DemoNavbar scenario="GYM" \/>\{children\}<\/DemoGymAccessProvider>\s*<\/DemoGymFinanceProvider>\s*<\/DemoGymProfileProvider>\s*<\/DemoGymProvider>/);
  assert.match(navbar, /gymRoleLinks/);
  assert.match(layout, /"\/demo\/student\/wod"/);
  for (const route of routes) assert.match(layout, new RegExp(`"/demo/gym/${route[0].replace("/page.tsx", "")}"`.replace("/admin/rms", "/admin/rms").replace("/teacher/rms", "/teacher/rms").replace("/student/rms", "/student/rms").replace("/student/wod", "/student/wod").replace("/admin", "/admin").replace("/teacher", "/teacher").replace("/student", "/student")));
  for (const route of financeRoutes) assert.match(layout, new RegExp(`"/demo/gym/${route[0].replace("/page.tsx", "")}"`));
});

const turnosRoutes = [
  ["admin", "ADMIN"],
  ["teacher", "TEACHER"],
  ["student", "STUDENT"],
];

test("GYM turnos entries mount GymBookingDemo without an extra navbar or main wrapper", async () => {
  for (const [role, initialRole] of turnosRoutes) {
    const [rootPage, previewPage] = await Promise.all([
      source(`src/app/demo/gym/${role}/turnos/page.tsx`),
      source(`preview/landing/app/demo/gym/${role}/turnos/page.tsx`),
    ]);
    for (const page of [rootPage, previewPage]) {
      assert.match(page, /export const metadata: Metadata/);
      assert.match(page, new RegExp(`<GymBookingDemo initialRole="${initialRole}"`));
      assert.doesNotMatch(page, /DemoNavbar/);
      assert.doesNotMatch(page, /<main\b/);
    }
  }
});

test("demo navigation has one GYM turnos link for each role, positioned like its BOX and access siblings", async () => {
  const [navbar, layout] = await Promise.all([
    source("src/components/DemoNavbar.tsx"),
    source("preview/landing/app/demo/layout.tsx"),
  ]);
  for (const [role] of turnosRoutes) {
    const href = `href: "/demo/gym/${role}/turnos", label: "Turnos"`;
    assert.equal(navbar.split(href).length - 1, 1, `${role} has one GYM Turnos entry`);
    assert.equal((layout.match(new RegExp(`"/demo/gym/${role}/turnos"`, "g")) ?? []).length, 1, `${role} Preview supportedRoutes has one GYM turnos entry`);
  }
});
