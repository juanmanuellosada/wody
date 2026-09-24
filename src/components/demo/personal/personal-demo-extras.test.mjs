import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = new URL("../../../../", import.meta.url);
const projectRoot = fileURLToPath(root);
const sourceRoot = path.join(projectRoot, "src");
const source = (file) => readFile(new URL(file, root), "utf8");

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
  return { edges };
}

test("Preview packages byte-identical production timer audio assets", async () => {
  for (const name of ["tick", "phase", "go", "complete"]) {
    const [production, preview] = await Promise.all([
      readFile(new URL(`public/sounds/${name}.wav`, root)),
      readFile(new URL(`preview/landing/public/sounds/${name}.wav`, root)),
    ]);
    assert.ok(production.length > 44, `${name}: nonempty WAV payload`);
    assert.equal(production.toString("ascii", 0, 4), "RIFF");
    assert.equal(production.toString("ascii", 8, 12), "WAVE");
    assert.deepEqual(preview, production, `${name}: Preview must reuse unchanged audio`);
  }
});

test("PERSONAL timers and benefits reuse non-operational presentations with isolated navigation", async () => {
  const [rootTimers, previewTimers, rootBenefits, previewBenefits, navbar, previewLayout, providers, benefitsView, fixtures, timerSource, soundSource, graph] = await Promise.all([
    source("src/app/demo/personal/student/timers/page.tsx"),
    source("preview/landing/app/demo/personal/student/timers/page.tsx"),
    source("src/app/demo/personal/student/beneficios/page.tsx"),
    source("preview/landing/app/demo/personal/student/beneficios/page.tsx"),
    source("src/components/DemoNavbar.tsx"),
    source("preview/landing/app/demo/layout.tsx"),
    source("src/components/demo/scenarios/DemoScenarioProviders.tsx"),
    source("src/components/demo/DemoBeneficiosView.tsx"),
    source("src/components/demo/demo-benefits-fixtures.ts"),
    source("src/components/timers/TimersClient.tsx"),
    source("src/components/timers/sounds.ts"),
    localRuntimeGraph([
      "src/app/demo/personal/student/timers/page.tsx",
      "preview/landing/app/demo/personal/student/timers/page.tsx",
    ]),
  ]);

  for (const page of [rootTimers, previewTimers]) {
    assert.match(page, /import \{ TimersClient \}/);
    assert.match(page, /<TimersClient \/>/);
    assert.match(page, /robots: \{ index: false, follow: false \}/);
    assert.doesNotMatch(page, /DemoNavbar|auth|redirect|@\/actions|@\/lib\/(auth|prisma)/i);
    assert.equal((page.match(/<main\b/g) ?? []).length, 1);
  }
  for (const page of [rootBenefits, previewBenefits]) {
    assert.match(page, /import \{ DemoBeneficiosView \}/);
    assert.match(page, /import \{ demoBenefitsFixtures \}/);
    assert.match(page, /<DemoBeneficiosView coupons=\{demoBenefitsFixtures\} \/>/);
    assert.match(page, /robots: \{ index: false, follow: false \}/);
    assert.doesNotMatch(page, /DemoNavbar|auth|redirect|@\/actions|@\/lib\/(auth|prisma)/i);
    assert.equal((page.match(/<main\b/g) ?? []).length, 1);
  }

  const personalRoutes = [
    "/demo/personal/student",
    "/demo/personal/student/rms",
    "/demo/personal/student/timers",
    "/demo/personal/student/beneficios",
    "/demo/personal/student/suscripcion",
  ];
  for (const href of personalRoutes) {
    assert.match(navbar, new RegExp(`href: "${href}"`));
    assert.match(previewLayout, new RegExp(`"${href}"`));
  }
  assert.equal((navbar.match(/href: "\/demo\/personal\/student(?:[^\"]*)"/g) ?? []).length, 5);
  assert.match(providers, /if \(scenario === "PERSONAL"\) \{[\s\S]*?<DemoPersonalProvider>[\s\S]*?\{children\}[\s\S]*?<\/DemoPersonalProvider>/);
  const personalBranch = providers.slice(providers.indexOf('if (scenario === "PERSONAL") {'), providers.indexOf("\n  return (\n    <DemoTrainingProvider>"));
  assert.doesNotMatch(personalBranch, /Demo(?:Training|Finance|Access)Provider/);

  assert.match(benefitsView, /disabled/);
  assert.match(benefitsView, /no se generan códigos ni descuentos reales/);
  assert.match(fixtures, /Explicitly fictional examples/);
  assert.doesNotMatch(fixtures, /redeem|issue.*code|generate.*code/i);

  const forbiddenEdges = /(^|\/)(actions|auth|prisma|server|cache)(\/|$)|checkout|mercadopago|https?:\/\//i;
  assert.deepEqual(graph.edges.filter((edge) => forbiddenEdges.test(edge)), []);
  assert.match(soundSource, /new Audio\("\/sounds\//);
  assert.match(soundSource, /navigator\.vibrate/);
  assert.doesNotMatch(`${timerSource}\n${soundSource}`, /fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|localStorage|sessionStorage|indexedDB|@\/actions|@\/lib\/(auth|prisma)/);
});
