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

function isTypeOnly(declaration) {
  const clause = declaration.importClause;
  if (!clause) return false;
  if (clause.isTypeOnly) return true;
  return Boolean(clause.namedBindings && ts.isNamedImports(clause.namedBindings)
    && !clause.name && clause.namedBindings.elements.every((element) => element.isTypeOnly));
}

function runtimeImports(filePath, content) {
  const imports = [];
  const file = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && !isTypeOnly(node)) {
      imports.push(node.moduleSpecifier.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return imports;
}

async function resolveLocalImport(fromFile, specifier) {
  let base;
  if (specifier.startsWith("@/")) base = path.join(sourceRoot, specifier.slice(2));
  else if (specifier.startsWith(".")) base = path.resolve(path.dirname(fromFile), specifier);
  else return null;
  for (const suffix of ["", ".tsx", ".ts", "/index.tsx", "/index.ts"]) {
    const candidate = `${base}${suffix}`;
    try {
      if ((await stat(candidate)).isFile()) return candidate;
    } catch {
      // Try the next supported extension.
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

test("production retains server-owned Cuotas query, guards, URL filters, and action slots", async () => {
  const [page, view] = await Promise.all([
    source("src/app/[gymSlug]/cuotas/page.tsx"),
    source("src/components/payments/PaymentControlView.tsx"),
  ]);
  for (const expression of [
    "await auth()",
    "isPersonalGym(session.user.gymKind)",
    "role: \"STUDENT\", deletedAt: null",
    "studentOf: { some: { teacherId: session.user.id } }",
    "prisma.teacherStudent.findMany",
    "prisma.gym.findUnique",
    "gymConfig?.kind === \"GYM\"",
    "await searchParams",
    "new URLSearchParams()",
    "query.set(\"status\", filter)",
    "query.set(\"type\", activeType)",
    "<StudentTypeSelect gymKind={gymConfig?.kind} paramName=\"type\" value={activeType} />",
    "<EditStudentButton",
    "<BlockUserButton",
  ]) {
    assert.match(page, new RegExp(expression.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(page, /<PaymentControlView/);
  assert.doesNotMatch(page, /RegisterPayment|registerPayment/);
  assert.doesNotMatch(view, /EditStudentButton|BlockUserButton|RegisterPayment|@\/actions|@prisma|next\/navigation/);
  assert.match(view, /typeControl: ReactNode/);
  assert.match(view, /rowActions\?: Record<string, ReactNode>/);
});

test("root and standalone Cuotas pages use the one safe local adapter", async () => {
  const files = [
    "src/app/demo/admin/pagos/page.tsx",
    "src/app/demo/teacher/pagos/page.tsx",
    "preview/landing/app/demo/admin/pagos/page.tsx",
    "preview/landing/app/demo/teacher/pagos/page.tsx",
  ];
  const values = await Promise.all(files.map(source));
  for (const value of values) {
    assert.match(value, /DemoFeesAdapter/);
    assert.doesNotMatch(value, /RegisterPayment|RegisterPaymentDialog|@\/actions|@prisma/);
  }
  assert.match(values[0], /<DemoNavbar \/>/);
  assert.match(values[1], /<DemoNavbar \/>/);
  assert.doesNotMatch(values[2], /DemoNavbar/);
  assert.doesNotMatch(values[3], /DemoNavbar/);

  const [navbar, layout, adapter, studentTypeView] = await Promise.all([
    source("src/components/DemoNavbar.tsx"),
    source("preview/landing/app/demo/layout.tsx"),
    source("src/components/demo/finance/DemoFeesAdapter.tsx"),
    source("src/components/StudentTypeSelectView.tsx"),
  ]);
  assert.equal((navbar.match(/href: "\/demo\/admin\/pagos", label: "Cuotas"/g) ?? []).length, 1);
  assert.equal((navbar.match(/href: "\/demo\/teacher\/pagos", label: "Cuotas"/g) ?? []).length, 1);
  assert.match(layout, /"\/demo\/admin\/pagos"/);
  assert.match(layout, /"\/demo\/teacher\/pagos"/);
  assert.doesNotMatch(adapter, /disabled title="La edición de perfiles no está disponible/);
  assert.match(adapter, /Datos ficticios\. Podés editar el nombre, bloquear o desbloquear, marcar exenciones de pago y asignar o quitar profes; los cambios quedan solo en esta pestaña y no modifican datos reales\./);
  assert.match(adapter, /gymKind="BOX"/);
  assert.match(studentTypeView, /studentTypeOptions\(gymKind\)/);
});

test("all new standalone routes, layout, views, and adapters recursively exclude operational runtime imports", async () => {
  const { visited, edges } = await runtimeGraph([
    "preview/landing/app/demo/layout.tsx",
    "preview/landing/app/demo/admin/pagos/page.tsx",
    "preview/landing/app/demo/teacher/pagos/page.tsx",
  ]);
  assert.ok([...visited].some((file) => file.endsWith("src/components/demo/finance/DemoFeesAdapter.tsx")));
  assert.ok([...visited].some((file) => file.endsWith("src/components/payments/PaymentControlView.tsx")));
  const forbidden = /(^|\/)(actions|auth|prisma|cache|server)(\/|$)|@prisma/;
  assert.deepEqual(edges.filter(({ specifier }) => forbidden.test(specifier)), []);
});
