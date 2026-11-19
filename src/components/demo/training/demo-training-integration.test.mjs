import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const projectRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const sourceRoot = path.join(projectRoot, "src");

async function source(relativePath) {
  return readFile(path.join(projectRoot, relativePath), "utf8");
}

function parse(filePath, content) {
  return ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function typeOnly(declaration) {
  const clause = declaration.importClause;
  if (!clause) return false;
  if (clause.isTypeOnly) return true;
  return Boolean(clause.namedBindings && ts.isNamedImports(clause.namedBindings)
    && !clause.name && clause.namedBindings.elements.every((element) => element.isTypeOnly));
}

function runtimeImports(filePath, content) {
  const imports = [];
  function visit(node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && !typeOnly(node)) {
      imports.push(node.moduleSpecifier.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(parse(filePath, content));
  return imports;
}

async function resolveLocalImport(fromFile, specifier) {
  let base;
  if (specifier.startsWith("@/")) base = path.join(sourceRoot, specifier.slice(2));
  else if (specifier.startsWith(".")) base = path.resolve(path.dirname(fromFile), specifier);
  else return null;
  for (const suffix of ["", ".tsx", ".ts", ".js", "/index.tsx", "/index.ts"]) {
    const candidate = `${base}${suffix}`;
    try {
      if ((await stat(candidate)).isFile()) return candidate;
    } catch {
      // Try the next extension.
    }
  }
  return null;
}

async function runtimeGraph(entries) {
  const pending = entries.map((entry) => path.join(projectRoot, entry));
  const visited = new Set();
  const edges = [];
  while (pending.length) {
    const file = pending.pop();
    if (!file || visited.has(file)) continue;
    visited.add(file);
    const content = await readFile(file, "utf8");
    for (const specifier of runtimeImports(file, content)) {
      edges.push({ from: path.relative(projectRoot, file), specifier });
      const local = await resolveLocalImport(file, specifier);
      if (local) pending.push(local);
    }
  }
  return { visited, edges };
}

const routeEntries = [
  ["admin", "page.tsx", "admin-home", "ADMIN", "a1", "staff"],
  ["admin", "rms/page.tsx", "admin-rms", "ADMIN", "a1", "rms"],
  ["teacher", "page.tsx", "teacher-home", "TEACHER", "t1", "staff"],
  ["teacher", "rms/page.tsx", "teacher-rms", "TEACHER", "t1", "rms"],
  ["student", "page.tsx", "student-home", "STUDENT", "s1", "student"],
  ["student", "wod/page.tsx", "student-wod", "STUDENT", "s1", "student-wod"],
  ["student", "rms/page.tsx", "student-rms", "STUDENT", "s1", "rms"],
];

test("root and standalone export the complete safe training route inventory", async () => {
  for (const [role, leaf, routeKey, routeRole, routeActorId, screen] of routeEntries) {
    const rootPath = `src/app/demo/${role}/${leaf}`;
    const previewPath = `preview/landing/app/demo/${role}/${leaf}`;
    const [root, preview] = await Promise.all([source(rootPath), source(previewPath)]);
    for (const value of [root, preview]) {
      assert.match(value, /DemoTrainingRoute/);
      assert.match(value, new RegExp(`routeKey="${routeKey}"`));
      assert.match(value, new RegExp(`routeRole="${routeRole}"`));
      assert.match(value, new RegExp(`routeActorId="${routeActorId}"`));
      assert.match(value, new RegExp(`screen="${screen}"`));
      assert.doesNotMatch(value, /WodManagerClient|RmsClient|GroupManager\b|DemoRms/);
    }
  }

  const [rootLayout, previewLayout, rootEntry, previewEntry] = await Promise.all([
    source("src/app/demo/layout.tsx"),
    source("preview/landing/app/demo/layout.tsx"),
    source("src/app/demo/page.tsx"),
    source("preview/landing/app/demo/page.tsx"),
  ]);
  assert.equal((rootLayout.match(/<DemoScenarioProviders rootPersonalNavigation>/g) ?? []).length, 1);
  assert.equal((previewLayout.match(/<DemoScenarioProviders>/g) ?? []).length, 1);
  assert.match(rootEntry, /DemoTrainingOverview/);
  assert.match(previewEntry, /DemoTrainingOverview/);
  assert.doesNotMatch(rootEntry, /BoxBookingDemo/);
  assert.doesNotMatch(previewEntry, /BoxBookingDemo/);
});

test("training route initialization is ready-gated, route-keyed, and never resets navigation", async () => {
  const route = await source("src/components/demo/training/DemoTrainingRoute.tsx");
  assert.match(route, /if \(!ready \|\| initializedRoutes\.current\.has\(routeKey\)\) return/);
  assert.match(route, /initializedRoutes\.current\.add\(routeKey\);\s*selectActor\(routeActorId\)/s);
  assert.match(route, /initializedRouteKey === routeKey/);
  assert.match(route, /projections\.selectedActor\.role === routeRole/);
  assert.match(route, /function resetForRoute\(\) \{\s*reset\(\);\s*selectActor\(routeActorId\)/s);
  assert.doesNotMatch(route, /reset\(\)[\s\S]*useEffect/);
  assert.match(route, /selectedWodId\s*\? projections\.student\.wods\.find/);
  assert.match(route, /selectedWod \?\? projections\.student\.wods\[0\] \?\? null/);
  assert.doesNotMatch(route, /useSearchParams|searchParams/);
});

test("the complete training runtime graph remains local and includes click-only sharing", async () => {
  const { visited, edges } = await runtimeGraph([
    "src/components/demo/training/DemoTrainingRoute.tsx",
    "src/components/demo/training/DemoTrainingOverview.tsx",
    "src/components/wod/StudentWodDetailView.tsx",
  ]);
  assert.ok([...visited].some((file) => file.endsWith("src/components/wod/ShareWodButton.tsx")));
  assert.ok([...visited].some((file) => file.endsWith("src/components/ShareRmButton.tsx")));
  assert.ok(edges.some((edge) => edge.specifier === "modern-screenshot"));
  const forbidden = /(^|\/)(actions|auth|prisma|cache|server)(\/|$)/;
  assert.deepEqual(edges.filter(({ specifier }) => forbidden.test(specifier)), []);
});

test("student detail presentation is shared while the production query and guards stay server-owned", async () => {
  const [production, detail, history] = await Promise.all([
    source("src/app/[gymSlug]/dashboard/athlete/wod/page.tsx"),
    source("src/components/wod/StudentWodDetailView.tsx"),
    source("src/components/wod/WodHistory.tsx"),
  ]);
  for (const expression of ["await auth()", "prisma.teacherStudent.findMany", "prisma.user.findUnique", "prisma.gym.findUnique", "prisma.wod.findFirst", "prisma.wod.findMany", "redirect(athletePath)", "await searchParams"]) {
    assert.match(production, new RegExp(expression.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(production, /<StudentWodDetailView/);
  assert.match(production, /shareAction=/);
  assert.match(detail, /shareAction\?: React\.ReactNode/);
  assert.match(detail, /backHref\?: string/);
  assert.match(detail, /onBack\?: \(\) => void/);
  assert.match(history, /onSelectWod\?: \(wodId: string\) => void/);
  assert.match(history, /href=\{`\$\{wodPath\}\?id=\$\{wod\.id\}`\}/);
});

test("supported standalone links and root legacy links resolve to exported demo pages", async () => {
  const [navbar, layout] = await Promise.all([
    source("src/components/DemoNavbar.tsx"),
    source("preview/landing/app/demo/layout.tsx"),
  ]);
  assert.match(navbar, /supportedRoutes\?: string\[\]/);
  assert.match(navbar, /href: "\/demo\/admin\/rms", label: "Mis RMs"/);
  const routes = [
    "/demo/admin", "/demo/admin/rms", "/demo/admin/turnos", "/demo/admin/pagos",
    "/demo/teacher", "/demo/teacher/rms", "/demo/teacher/turnos", "/demo/teacher/pagos",
    "/demo/student", "/demo/student/rms", "/demo/student/turnos", "/demo/student/beneficios",
    "/demo/personal/student", "/demo/personal/student/rms", "/demo/personal/student/suscripcion",
  ];
  for (const route of routes) assert.match(layout, new RegExp(`"${route}"`));
  assert.match(navbar, /if \(pathname === "\/demo" \|\| pathname === "\/demo\/"\) return null/);
});
