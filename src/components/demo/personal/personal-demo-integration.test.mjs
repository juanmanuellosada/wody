import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { getTodayArgentina, toInputDate } from "../../../lib/dates.ts";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = new URL("../../../../", import.meta.url);
const projectRoot = fileURLToPath(root);
const sourceRoot = path.join(projectRoot, "src");
const source = (path) => readFile(new URL(path, root), "utf8");

function renderRmFormView(sourceText, props) {
  const executable = sourceText
    .replace('import { useState, useTransition } from "react";\n', "")
    .replace('import { Button } from "@/components/ui/Button";\n', "")
    .replace('import { Input } from "@/components/ui/Input";\n', "")
    .replace('import { DatePicker } from "@/components/ui/DatePicker";\n', "")
    .replace('import { toInputDate } from "@/lib/dates";\n', "")
    .replace('import type { GymTerms } from "@/lib/gym-terms";\n', "")
    .replace(/^import[^\n]*\n/gm, "")
    .replace("export function RmFormView", "function RmFormView");
  const output = ts.transpileModule(executable, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.None,
      jsx: ts.JsxEmit.React,
      jsxFactory: "h",
    },
  }).outputText;
  const h = (type, props, ...children) => ({ type, props, children });
  const component = new Function(
    "useState",
    "useTransition",
    "Button",
    "Input",
    "DatePicker",
    "getTodayArgentina",
    "toInputDate",
    "h",
    "exports",
    `${output}\nreturn exports.RmFormView ?? RmFormView;`,
  )(
    (value) => [value, () => {}],
    () => [false, () => {}],
    () => null,
    () => null,
    function DatePicker() { return null; },
    getTodayArgentina,
    toInputDate,
    h,
    {},
  );
  return component(props);
}

function findDatePickerValue(element) {
  if (element.type?.name === "DatePicker") return element.props.value;
  for (const child of element.children ?? []) {
    if (typeof child === "object" && child !== null) {
      const found = findDatePickerValue(child);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

async function pageCount(directory) {
  let count = 0;
  for (const entry of await readdir(new URL(directory, root), { withFileTypes: true })) {
    if (entry.isDirectory()) count += await pageCount(`${directory}/${entry.name}`);
    if (entry.isFile() && entry.name === "page.tsx") count += 1;
  }
  return count;
}

const personalPages = [
  ["personal/student/page.tsx", "DemoPersonalTrainingRoute"],
  ["personal/student/rms/page.tsx", "DemoPersonalRms"],
  ["personal/student/timers/page.tsx", "TimersClient"],
  ["personal/student/beneficios/page.tsx", "DemoBeneficiosView"],
  ["personal/student/suscripcion/page.tsx", "DemoPersonalBilling"],
];

test("RM new-form initialization uses Argentina today and preserves supplied dates", async () => {
  const form = await source("src/components/RmFormView.tsx");
  assert.match(form, /import \{ getTodayArgentina, toInputDate \} from "@\/lib\/dates";/);
  assert.match(form, /const todayStr = toInputDate\(getTodayArgentina\(\)\);/);

  const RealDate = globalThis.Date;
  class ArgentinaRolloverDate extends RealDate {
    constructor(...args) {
      super(args.length === 0 ? "2026-10-01T01:30:00.000Z" : args[0]);
    }
  }
  class ArgentinaMiddayDate extends RealDate {
    constructor(...args) {
      super(args.length === 0 ? "2026-10-01T15:00:00.000Z" : args[0]);
    }
  }
  const baseProps = {
    terms: { rm: "RM", rms: "RMs" },
    onCreateRm: async () => ({ success: true }),
    onUpdateRm: async () => ({ success: true }),
  };

  try {
    globalThis.Date = ArgentinaRolloverDate;
    assert.equal(toInputDate(getTodayArgentina()), "2026-09-30");
    assert.equal(findDatePickerValue(renderRmFormView(form, baseProps)), "2026-09-30");
    assert.equal(
      findDatePickerValue(renderRmFormView(form, { ...baseProps, defaultDate: "2024-02-29" })),
      "2024-02-29",
    );
    assert.equal(
      findDatePickerValue(renderRmFormView(form, { ...baseProps, editId: "rm-1", defaultDate: "2023-12-31" })),
      "2023-12-31",
    );

    globalThis.Date = ArgentinaMiddayDate;
    assert.equal(toInputDate(getTodayArgentina()), "2026-10-01");
    assert.equal(findDatePickerValue(renderRmFormView(form, baseProps)), "2026-10-01");
  } finally {
    globalThis.Date = RealDate;
  }
});

test("root and Preview retain 19 BOX demo pages, five PERSONAL routes, and seventeen GYM routes", async () => {
  const [rootCount, previewCount, rootHub, previewHub, navbar, previewLayout] = await Promise.all([
    pageCount("src/app/demo"),
    pageCount("preview/landing/app/demo"),
    source("src/app/demo/page.tsx"),
    source("preview/landing/app/demo/page.tsx"),
    source("src/components/DemoNavbar.tsx"),
    source("preview/landing/app/demo/layout.tsx"),
  ]);
  assert.equal(rootCount, 41);
  assert.equal(previewCount, 41);
  assert.match(rootHub, /DemoTrainingOverview/);
  assert.match(previewHub, /DemoTrainingOverview/);
  for (const href of ["/demo/personal/student", "/demo/personal/student/rms", "/demo/personal/student/timers", "/demo/personal/student/beneficios", "/demo/personal/student/suscripcion"]) {
    assert.match(navbar, new RegExp(`href: "${href}"`));
    assert.match(previewLayout, new RegExp(`"${href}"`));
  }
  assert.match(navbar, /scenario\?: "PERSONAL" \| "GYM"/);
  assert.match(navbar, /Volver al BOX/);
  assert.doesNotMatch(navbar, /\/demo\/personal\/(admin|teacher|caja|ingresos|turnos|productos)/);
  for (const [leaf, component] of personalPages) {
    const [rootPage, previewPage] = await Promise.all([
      source(`src/app/demo/${leaf}`),
      source(`preview/landing/app/demo/${leaf}`),
    ]);
    assert.match(rootPage, new RegExp(component));
    assert.match(previewPage, new RegExp(component));
    assert.doesNotMatch(rootPage, /DemoNavbar/);
    assert.doesNotMatch(previewPage, /DemoNavbar/);
  }
});

async function resolveLocalImport(fromFile, specifier) {
  const base = specifier.startsWith("@/")
    ? path.join(sourceRoot, specifier.slice(2))
    : specifier.startsWith(".")
      ? path.resolve(path.dirname(fromFile), specifier)
      : null;
  if (!base) return null;
  for (const suffix of ["", ".tsx", ".ts", ".js", "/index.tsx", "/index.ts"]) {
    try {
      const candidate = `${base}${suffix}`;
      if ((await stat(candidate)).isFile()) return candidate;
    } catch {
      // Try the next supported module extension.
    }
  }
  return null;
}

async function localRuntimeGraph(entries) {
  const pending = entries.map((entry) => path.join(projectRoot, entry));
  const edges = [];
  const visited = new Set();
  while (pending.length) {
    const file = pending.pop();
    if (!file || visited.has(file)) continue;
    visited.add(file);
    const content = await readFile(file, "utf8");
    for (const line of content.split("\n")) {
      if (/^\s*import\s+type\b/.test(line)) continue;
      const match = line.match(/from\s+["']([^"']+)["']/);
      if (!match) continue;
      const specifier = match[1];
      edges.push(specifier);
      const local = await resolveLocalImport(file, specifier);
      if (local) pending.push(local);
    }
  }
  return edges;
}

test("PERSONAL runtime graph excludes actions, auth, Prisma, checkout and network edges", async () => {
  const edges = await localRuntimeGraph([
    "src/components/demo/personal/DemoPersonalTrainingRoute.tsx",
    "src/components/demo/personal/DemoPersonalRms.tsx",
    "src/components/demo/personal/DemoPersonalBilling.tsx",
  ]);
  const forbidden = /(^|\/)(actions|auth|prisma|server|cache)(\/|$)|checkout|mercadopago|https?:\/\//i;
  assert.deepEqual(edges.filter((edge) => forbidden.test(edge)), []);
});

test("PERSONAL WodManager boundary accepts only the canonical self target before invoking adapters", async () => {
  const route = await source("src/components/demo/personal/DemoPersonalTrainingRoute.tsx");
  const ownerConstant = route.match(/const PERSONAL_OWNER_ID = "personal-student-owner";/);
  const helperSource = route.match(/export function personalSelfTarget[\s\S]*?\n}\n/);
  assert.ok(ownerConstant, "the canonical owner is fixed in this route");
  assert.ok(helperSource, "the target boundary helper is exported for focused runtime verification");
  const helperScript = ts.transpileModule(
    `${ownerConstant[0]}\n${helperSource[0].replace("export function", "function")}return personalSelfTarget;`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const personalSelfTarget = new Function(helperScript)();
  assert.deepEqual(personalSelfTarget({ type: "STUDENT", studentId: "personal-student-owner" }), { type: "STUDENT", studentId: "personal-student-owner" });
  for (const target of [
    undefined,
    { type: "STUDENT", studentId: "foreign-student" },
    { type: "GROUP", groupId: "group-1" },
    { type: "ALL" },
    { type: "PERSONALIZED" },
    { type: "MUSCULACION_LIBRE", studentId: "personal-student-owner" },
  ]) assert.equal(personalSelfTarget(target), null);

  assert.match(route, /export function personalSelfTarget\(target: WodTarget \| undefined\): PersonalTrainingWodTarget \| null/);
  assert.match(route, /target\?\.type !== "STUDENT" \|\| target\.studentId !== PERSONAL_OWNER_ID/);
  assert.match(route, /onCreateWod=\{\(date, title, content, target\) => \{[\s\S]*personalSelfTarget\(target\)[\s\S]*trainingCallbacks\.onCreateWod[\s\S]*Promise\.resolve\(invalidRoutineTarget\(\)\)/);
  assert.match(route, /onUpdateWod=\{\(wodId, title, content, date, target\) => \{[\s\S]*personalSelfTarget\(target\)[\s\S]*trainingCallbacks\.onUpdateWod[\s\S]*Promise\.resolve\(invalidRoutineTarget\(\)\)/);
  assert.match(route, /if \(target === undefined\) return trainingCallbacks\.onCopyWod\(sourceWodId, targetDate\);/);
  assert.match(route, /onCopyWod=\{\(sourceWodId, targetDate, target\) => \{[\s\S]*personalSelfTarget\(target\)[\s\S]*trainingCallbacks\.onCopyWod[\s\S]*Promise\.resolve\(invalidRoutineTarget\(\)\)/);
  assert.doesNotMatch(route, /target as typeof lockedTarget|as unknown|@ts-ignore/);
});

test("scenario selection is pathname-only and never mounts BOX providers for PERSONAL", async () => {
  const [providers, rootLayout, previewLayout] = await Promise.all([
    source("src/components/demo/scenarios/DemoScenarioProviders.tsx"),
    source("src/app/demo/layout.tsx"),
    source("preview/landing/app/demo/layout.tsx"),
  ]);
  assert.match(providers, /usePathname/);
  assert.match(providers, /pathname === "\/demo\/personal" \|\| pathname\.startsWith\("\/demo\/personal\/"\)/);
  assert.match(providers, /if \(pathname === null\) return null/);
  const personalBranchStart = providers.indexOf('if (scenario === "PERSONAL") {');
  const boxBranchStart = providers.indexOf("\n  return (\n    <DemoTrainingProvider>", personalBranchStart);
  assert.ok(personalBranchStart >= 0 && boxBranchStart > personalBranchStart, "PERSONAL precedes the BOX provider branch");
  const personalBranch = providers.slice(personalBranchStart, boxBranchStart);

  assert.match(personalBranch, /<DemoPersonalProvider>[\s\S]*<DemoNavbar scenario="PERSONAL" \/>/);
  assert.doesNotMatch(personalBranch, /Demo(?:Training|Finance|Access)Provider/);
  assert.equal((providers.match(/<DemoTrainingProvider>/g) ?? []).length, 1);
  assert.equal((providers.match(/<DemoFinanceProvider>/g) ?? []).length, 1);
  assert.equal((providers.match(/<DemoAccessProvider>/g) ?? []).length, 1);
  assert.match(providers, /<DemoTrainingProvider>\s*<DemoFinanceProvider>\s*<DemoAccessProvider>\{children\}<\/DemoAccessProvider>\s*<\/DemoFinanceProvider>\s*<\/DemoTrainingProvider>/);
  assert.equal((rootLayout.match(/<DemoScenarioProviders\b/g) ?? []).length, 1);
  assert.equal((previewLayout.match(/<DemoScenarioProviders\b/g) ?? []).length, 1);
  assert.match(rootLayout, /<DemoScenarioProviders rootPersonalNavigation>/);
  assert.match(previewLayout, /<DemoScenarioProviders>/);
  assert.doesNotMatch(providers, /useSearchParams|localStorage|sessionStorage|@\/actions|@\/lib\/(auth|prisma)|fetch\s*\(/);
});
