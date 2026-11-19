import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
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

function visit(node, callback) {
  callback(node);
  ts.forEachChild(node, (child) => visit(child, callback));
}

function interfacePropertyNames(filePath, content, interfaceName) {
  const properties = new Set();
  visit(parse(filePath, content), (node) => {
    if (ts.isInterfaceDeclaration(node) && node.name.text === interfaceName) {
      for (const member of node.members) {
        if (ts.isPropertySignature(member) && member.name) properties.add(member.name.getText());
      }
    }
  });
  return properties;
}

function callArguments(filePath, content, name) {
  const calls = [];
  visit(parse(filePath, content), (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === name) {
      calls.push(node.arguments.map((argument) => argument.getText()));
    }
  });
  return calls;
}

function importBindingsAreTypeOnly(importDeclaration) {
  const clause = importDeclaration.importClause;
  if (!clause) return false;
  if (clause.isTypeOnly) return true;
  if (clause.name || !clause.namedBindings || !ts.isNamedImports(clause.namedBindings)) return false;
  return clause.namedBindings.elements.every((specifier) => specifier.isTypeOnly);
}

function runtimeModuleSpecifiers(filePath, content) {
  const specifiers = [];
  visit(parse(filePath, content), (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && !importBindingsAreTypeOnly(node)) {
      specifiers.push(node.moduleSpecifier.text);
    }
    if (
      ts.isCallExpression(node)
      && node.expression.kind === ts.SyntaxKind.ImportKeyword
      && node.arguments.length === 1
      && ts.isStringLiteral(node.arguments[0])
    ) specifiers.push(node.arguments[0].text);
  });
  return specifiers;
}

async function resolveLocalImport(fromFile, specifier) {
  let basePath;
  if (specifier.startsWith("@/")) basePath = path.join(sourceRoot, specifier.slice(2));
  else if (specifier.startsWith(".")) basePath = path.resolve(path.dirname(fromFile), specifier);
  else return null;

  for (const suffix of ["", ".tsx", ".ts", ".jsx", ".js", ".mjs", "/index.tsx", "/index.ts", "/index.js"]) {
    const candidate = `${basePath}${suffix}`;
    try {
      if ((await stat(candidate)).isFile()) return candidate;
    } catch {
      // Try the next source extension.
    }
  }
  return null;
}

async function runtimeLocalGraph(entryPaths) {
  const pending = entryPaths.map((entry) => path.join(projectRoot, entry));
  const visited = new Set();
  const edges = [];
  while (pending.length > 0) {
    const filePath = pending.pop();
    if (!filePath || visited.has(filePath)) continue;
    visited.add(filePath);
    const content = await readFile(filePath, "utf8");
    for (const specifier of runtimeModuleSpecifiers(filePath, content)) {
      edges.push({ from: path.relative(projectRoot, filePath), specifier });
      const local = await resolveLocalImport(filePath, specifier);
      if (local) pending.push(local);
    }
  }
  return { edges, visited };
}

test("fixed-routine manager keeps its public live DTO and binds exact server action callbacks", async () => {
  const managerPath = "src/components/fixed-routine/FixedRoutineManager.tsx";
  const [manager, contracts] = await Promise.all([
    source(managerPath),
    source("src/components/fixed-routine/fixed-routine-view-contracts.ts"),
  ]);

  assert.deepEqual(
    interfacePropertyNames(managerPath, manager, "FixedRoutineManagerProps"),
    new Set(["muslibStudents", "renewalRoutines"]),
  );
  assert.match(contracts, /export type FixedRoutineResult\s*=\s*\| \{ success: true; id\?: string \}\s*\| \{ success: false; error: string \}/);
  assert.match(contracts, /renewAt: Date;/);
  assert.match(manager, /from "@\/actions\/fixed-routine"/);
  assert.match(manager, /createFixedRoutine=\{createFixedRoutine\}/);
  assert.match(manager, /updateFixedRoutine=\{updateFixedRoutine\}/);
  assert.match(manager, /deleteFixedRoutine=\{deleteFixedRoutine\}/);
});

test("the extracted manager view preserves form state, exact callbacks, dynamic editor, and existing controls", async () => {
  const viewPath = "src/components/fixed-routine/FixedRoutineManagerView.tsx";
  const view = await source(viewPath);

  assert.deepEqual(
    interfacePropertyNames(viewPath, view, "FixedRoutineManagerViewProps"),
    new Set(["muslibStudents", "renewalRoutines", "createFixedRoutine", "updateFixedRoutine", "deleteFixedRoutine", "getDefaultRenewAt"]),
  );
  assert.deepEqual(callArguments(viewPath, view, "createFixedRoutine"), [["form.studentId", "form.title", "form.content", "form.renewAt"]]);
  assert.deepEqual(callArguments(viewPath, view, "updateFixedRoutine"), [["form.routineId", "form.title", "form.content", "form.renewAt"]]);
  assert.deepEqual(callArguments(viewPath, view, "deleteFixedRoutine"), [["routineId"]]);
  assert.match(view, /^"use client";/);
  assert.match(view, /\(\) => import\("@\/components\/ui\/MarkdownEditor"\)\.then\(\(m\) => m\.MarkdownEditor\)/);
  assert.match(view, /ssr: false, loading: \(\) => <div className="h-\[220px\] bg-elev border border-edge animate-pulse" \/>/);
  assert.match(view, /getDefaultRenewAt = getLiveDefaultRenewAt/);
  assert.match(view, /today\.getTime\(\) \+ 30 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(view, /muslibStudents\.length === 0 && renewalRoutines\.length === 0/);
  assert.match(view, /e\.target === e\.currentTarget && !isPending && closeForm\(\)/);
  assert.match(view, /onClick=\{\(\) => \{ handleDelete\(form\.routineId!\); closeForm\(\); \}\}/);
  for (const text of ["Rutinas Fijas", "Rutinas por renovar", "Asignar / Renovar", "Renovar el", "Cancelar", "Eliminar", "Guardar"]) {
    assert.match(view, new RegExp(text));
  }
  assert.doesNotMatch(view, /@\/actions\//);
  assert.doesNotMatch(view, /key=\{(?:muslibStudents|renewalRoutines)/);
});

test("the student page retains its gates, fixed-routine query, server renewal policy, and non-fixed branches", async () => {
  const pagePath = "src/app/[gymSlug]/dashboard/athlete/page.tsx";
  const page = await source(pagePath);

  assert.match(page, /await auth\(\)/);
  assert.match(page, /isPersonalGym\(session\.user\.gymKind\)/);
  assert.match(page, /session\.user\.role !== "STUDENT"/);
  assert.match(page, /await isTrainingModuleEnabled\(gymSlug\)/);
  assert.match(page, /hasAccessControl\(gymSlug\)/);
  assert.match(page, /<CheckinScannerButton gymSlug=\{gymSlug\} \/>/);
  assert.match(page, /student\?\.studentType === "MUSCULACION_LIBRE"/);
  assert.match(page, /prisma\.fixedRoutine\.findFirst\(\{[\s\S]*where: \{ studentId, deletedAt: null \},[\s\S]*orderBy: \{ assignedAt: "desc" \},[\s\S]*id: true,[\s\S]*title: true,[\s\S]*content: true,[\s\S]*renewAt: true,[\s\S]*teacher: \{ select: \{ name: true \} \}/);
  assert.match(page, /Math\.floor\(\(new Date\(activeRoutine\.renewAt\)\.getTime\(\) - getTodayArgentina\(\)\.getTime\(\)\) \/ \(1000 \* 60 \* 60 \* 24\)\)/);
  assert.match(page, /renewalDiffDays !== null && renewalDiffDays <= 7/);
  assert.match(page, /Tu rutina venció — hablá con tu profe para renovarla\./);
  assert.match(page, /Tu rutina vence hoy — hablá con tu profe para renovarla\./);
  assert.match(page, /<FixedRoutineStudentView activeRoutine=\{activeRoutine\} renewalWarning=\{renewalWarning\} \/>/);
  assert.match(page, /teacherIds\.length === 0 && !canCreateOwn/);
  assert.match(page, /prisma\.wod\.findMany/);
  assert.match(page, /<WodHistory wods=\{historyWods\} wodPath=\{wodPath\} terms=\{terms\} \/>/);
  assert.doesNotMatch(page, /<MarkdownRenderer/);
});

test("presentation-only fixed-routine runtime graphs exclude server actions and operational QR code", async () => {
  const { edges, visited } = await runtimeLocalGraph([
    "src/components/fixed-routine/FixedRoutineManagerView.tsx",
    "src/components/fixed-routine/FixedRoutineStudentView.tsx",
  ]);
  assert.ok([...visited].some((filePath) => filePath.endsWith("src/components/ui/MarkdownEditor.tsx")));
  assert.ok([...visited].some((filePath) => filePath.endsWith("src/components/ui/MarkdownRenderer.tsx")));
  const forbidden = /(^|\/)(actions|auth|prisma|api|cache|server)(\/|$)|CheckinScannerButton/;
  assert.deepEqual(edges.filter(({ specifier }) => forbidden.test(specifier)), []);
});
