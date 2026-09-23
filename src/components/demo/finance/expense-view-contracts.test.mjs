import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const projectRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const sourceRoot = path.join(projectRoot, "src");

async function source(relativePath) {
  return readFile(path.join(projectRoot, relativePath), "utf8");
}

function parse(relativePath, content) {
  return ts.createSourceFile(relativePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function walk(node, predicate, found = []) {
  if (predicate(node)) found.push(node);
  ts.forEachChild(node, (child) => walk(child, predicate, found));
  return found;
}

function isTypeOnly(declaration) {
  const clause = declaration.importClause;
  if (!clause) return false;
  if (clause.isTypeOnly) return true;
  return Boolean(clause.namedBindings && ts.isNamedImports(clause.namedBindings)
    && !clause.name && clause.namedBindings.elements.every((element) => element.isTypeOnly));
}

function runtimeImports(filePath, content) {
  return walk(parse(filePath, content), ts.isImportDeclaration)
    .filter((declaration) => ts.isStringLiteral(declaration.moduleSpecifier) && !isTypeOnly(declaration))
    .map((declaration) => declaration.moduleSpecifier.text);
}

async function resolveLocalImport(fromFile, specifier) {
  let base;
  if (specifier.startsWith("@/")) base = path.join(sourceRoot, specifier.slice(2));
  else if (specifier.startsWith(".")) base = path.resolve(path.dirname(fromFile), specifier);
  else return null;
  for (const suffix of ["", ".tsx", ".ts", "/index.tsx", "/index.ts"]) {
    try {
      const candidate = `${base}${suffix}`;
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

async function loadContracts(now) {
  const content = await source("src/components/expenses/expense-view-contracts.ts");
  const output = ts.transpileModule(content, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const compiledModule = { exports: {} };
  vm.runInNewContext(output, { module: compiledModule, exports: compiledModule.exports, Date: now });
  return compiledModule.exports;
}

test("live expense adapter preserves the public action arguments and discriminated result contract", async () => {
  const [adapter, action, contracts] = await Promise.all([
    source("src/components/RegisterExpenseDialog.tsx"),
    source("src/actions/expense.ts"),
    source("src/components/expenses/expense-view-contracts.ts"),
  ]);
  assert.match(adapter, /export const registerLiveExpense: ExpenseRegistrationCallback = \(amount, description, options\) =>\s*registerExpense\(amount, description, options\);/s);
  assert.match(action, /export async function registerExpense\(\s*amount: number,\s*description: string,\s*options\?: \{ spentAtStr\?: string \}/s);
  assert.match(contracts, /spentAtStr\?: string/);
  assert.match(contracts, /\{ success: true \}/);
  assert.match(contracts, /\{ success: false; error: string \}/);
});

test("expense form preserves parsing, validation, UTC default, optional date policy, and close/error behavior", async () => {
  class FixedDate {
    toISOString() {
      return "2026-10-01T01:30:00.000Z";
    }
  }
  const { resolveExpenseToday } = await loadContracts(FixedDate);
  assert.equal(resolveExpenseToday(), "2026-10-01");
  assert.equal(resolveExpenseToday({ today: () => "2026-09-30" }), "2026-09-30");

  const [view, adapter, button] = await Promise.all([
    source("src/components/expenses/RegisterExpenseDialogView.tsx"),
    source("src/components/RegisterExpenseDialog.tsx"),
    source("src/components/expenses/RegisterExpenseButtonView.tsx"),
  ]);
  assert.match(view, /parseFloat\(amount\.replace\(",", "\."\)\)/);
  assert.match(view, /El importe debe ser mayor a cero\./);
  assert.match(view, /La descripción es obligatoria\./);
  assert.match(view, /const result = await onRegisterExpense\(validation\.parsedAmount, description, \{ spentAtStr: spentAt \}\);/);
  assert.match(view, /if \(!result\.success\) \{\s*setError\(result\.error\);\s*\} else \{\s*onClose\(\);\s*\}/s);
  assert.match(view, /defaultSpentAt=\{resolveExpenseToday\(datePolicy\)\}/);
  assert.match(view, /const maxDate = today\(\);/);
  assert.match(view, /max=\{today\(\)\}/);
  assert.doesNotMatch(adapter, /datePolicy=/);
  assert.match(button, /<RegisterExpenseDialogView/);
  assert.match(button, /onRegisterExpense: ExpenseRegistrationCallback;/);
  assert.doesNotMatch(button, /onRegisterExpense\?:/);
});

test("pure expense entry graph excludes live adapters and operational modules", async () => {
  const [button, graph] = await Promise.all([
    source("src/components/expenses/RegisterExpenseButtonView.tsx"),
    runtimeGraph([
      "src/components/expenses/RegisterExpenseDialogView.tsx",
      "src/components/expenses/RegisterExpenseButtonView.tsx",
    ]),
  ]);
  assert.match(button, /<RegisterExpenseDialogView/);
  assert.doesNotMatch(button, /RegisterExpenseDialog"/);
  const forbidden = /(^|\/)(actions|auth|prisma|cache|server)(\/|$)|@prisma|@\/lib|^next\//;
  assert.deepEqual(graph.edges.filter(({ specifier }) => forbidden.test(specifier)), []);
  assert.ok([...graph.visited].some((file) => file.endsWith("src/components/expenses/RegisterExpenseDialogView.tsx")));
  assert.ok([...graph.visited].some((file) => file.endsWith("src/components/expenses/RegisterExpenseButtonView.tsx")));
});
