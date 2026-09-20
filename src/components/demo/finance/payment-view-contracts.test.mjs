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
  const file = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const imports = [];
  function visit(node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && !isTypeOnly(node)) imports.push(node.moduleSpecifier.text);
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

test("extracted dialog keeps raw callback input while the production adapter preserves action arguments and result handling", async () => {
  const [dialog, view, action] = await Promise.all([
    source("src/components/RegisterPaymentDialog.tsx"),
    source("src/components/payments/RegisterPaymentDialogView.tsx"),
    source("src/actions/payment.ts"),
  ]);
  assert.match(dialog, /import \{ registerPayment \} from "@\/actions\/payment"/);
  assert.match(dialog, /registerPayment\(studentId, parseFloat\(amountInput\.replace\(",", "\."\)\), nextPaymentDate, options\)/);
  assert.match(view, /amountInput: string/);
  assert.doesNotMatch(view, /commandId/);
  assert.doesNotMatch(view, /@\/actions|@prisma|registerPayment\(/);
  assert.match(view, /setError\(null\);\s*setDuplicatePending\(null\);\s*const student/);
  assert.match(view, /if \(demo\) \{\s*onClose\(\);\s*return;/);
  assert.match(view, /setDuplicatePending\(null\).*Cancelar/s);
  assert.match(view, /else if \(result\.success\) \{\s*onClose\(\);/);
  assert.match(action, /export async function registerPayment\(\s*studentId: string,\s*amount: number,\s*nextPaymentDateStr: string,/s);
  assert.match(action, /confirmedDuplicate\?: boolean/);
  assert.match(action, /revalidatePaymentViews\(check\.gymSlug\)/);
});

test("section presentation is reusable without importing a live wrapper into the demo graph", async () => {
  const [section, sectionView] = await Promise.all([
    source("src/components/RegisterPaymentSection.tsx"),
    source("src/components/payments/RegisterPaymentSectionView.tsx"),
  ]);
  assert.match(section, /RegisterPaymentSectionView/);
  assert.match(section, /registerLivePayment/);
  assert.match(sectionView, /variant: "primary" \| "secondary"/);
  assert.match(sectionView, /label: string/);
  assert.match(sectionView, /<RegisterPaymentDialogView/);
  assert.doesNotMatch(sectionView, /@\/actions|@prisma|RegisterPaymentDialog"/);
});

test("new views and local finance modules recursively exclude operational imports", async () => {
  const { visited, edges } = await runtimeGraph([
    "src/components/payments/RegisterPaymentDialogView.tsx",
    "src/components/payments/RegisterPaymentSectionView.tsx",
    "src/components/demo/finance/finance-demo-state.ts",
    "src/components/demo/finance/finance-demo-storage.ts",
    "src/components/demo/finance/finance-demo-adapters.ts",
  ]);
  for (const expected of [
    "src/components/payments/RegisterPaymentDialogView.tsx",
    "src/components/payments/RegisterPaymentSectionView.tsx",
    "src/components/demo/finance/finance-demo-state.ts",
    "src/components/demo/finance/finance-demo-storage.ts",
    "src/components/demo/finance/finance-demo-adapters.ts",
  ]) assert.ok([...visited].some((file) => file.endsWith(expected)));
  const forbidden = /(^|\/)(actions|auth|prisma|cache|server)(\/|$)|@prisma/;
  assert.deepEqual(edges.filter(({ specifier }) => forbidden.test(specifier)), []);
});
