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

test("live history adapters preserve production action argument mappings and public aliases", async () => {
  const [payment, sale, expense] = await Promise.all([
    source("src/components/PaymentHistorySection.tsx"),
    source("src/components/SaleHistorySection.tsx"),
    source("src/components/ExpenseHistorySection.tsx"),
  ]);
  assert.match(payment, /updateLivePayment: UpdatePaymentCallback = \(paymentId, amount\) => updatePayment\(paymentId, amount\);/);
  assert.match(payment, /deleteLivePayment: DeletePaymentCallback = \(paymentId\) => deletePayment\(paymentId\);/);
  assert.match(sale, /updateLiveSale: UpdateSaleCallback = \(saleId, data\) => updateSale\(saleId, data\);/);
  assert.match(sale, /deleteLiveSale: DeleteSaleCallback = \(saleId\) => deleteSale\(saleId\);/);
  assert.match(expense, /updateLiveExpense: UpdateExpenseCallback = \(expenseId, data\) => updateExpense\(expenseId, data\);/);
  assert.match(expense, /deleteLiveExpense: DeleteExpenseCallback = \(expenseId\) => deleteExpense\(expenseId\);/);
  assert.match(payment, /PaymentHistoryRecord as PaymentRecord/);
  assert.match(sale, /SaleHistoryRecord as SaleRecord/);
  assert.match(expense, /ExpenseHistoryRecord as ExpenseRecord/);
});

test("pure history views retain rows, parsing, confirmation warnings, pending, and result errors", async () => {
  const [payment, sale, expense, contracts] = await Promise.all([
    source("src/components/payments/PaymentHistorySectionView.tsx"),
    source("src/components/sales/SaleHistorySectionView.tsx"),
    source("src/components/expenses/ExpenseHistorySectionView.tsx"),
    source("src/components/finance/history-view-contracts.ts"),
  ]);
  assert.match(contracts, /studentId: string/);
  assert.match(contracts, /productCode: number/);
  assert.match(contracts, /recordedByName: string/);
  assert.match(contracts, /requiresConfirmation: true/);
  assert.match(payment, /parseFloat\(amount\.replace\(",", "\."\)\)/);
  assert.match(sale, /parseInt\(quantity, 10\)/);
  assert.match(sale, /parseFloat\(unitAmount\.replace\(",", "\."\)\)/);
  assert.match(expense, /parseFloat\(amount\.replace\(",", "\."\)\)/);
  assert.match(payment, /El próximo vencimiento del alumno no cambia\./);
  assert.match(sale, /No repone el stock descontado\./);
  for (const view of [payment, sale, expense]) {
    assert.match(view, /loading=\{isDeleting\}/);
    assert.match(view, /if \(!isDeleting\) \{\s*setDeleteTarget\(null\);\s*setDeleteError\(null\);\s*\}/s);
    assert.match(view, /if \(!result\.success\) \{\s*set(?:Delete)?Error\(/s);
  }
});

test("pure history graph excludes operational modules and production wrappers render the views", async () => {
  const [paymentAdapter, saleAdapter, expenseAdapter, graph] = await Promise.all([
    source("src/components/PaymentHistorySection.tsx"),
    source("src/components/SaleHistorySection.tsx"),
    source("src/components/ExpenseHistorySection.tsx"),
    runtimeGraph([
      "src/components/payments/PaymentHistorySectionView.tsx",
      "src/components/sales/SaleHistorySectionView.tsx",
      "src/components/expenses/ExpenseHistorySectionView.tsx",
    ]),
  ]);
  assert.match(paymentAdapter, /<PaymentHistorySectionView/);
  assert.match(saleAdapter, /<SaleHistorySectionView/);
  assert.match(expenseAdapter, /<ExpenseHistorySectionView/);
  const forbidden = /(^|\/)(actions|auth|prisma|cache|server)(\/|$)|@prisma|@\/actions|@\/lib|^next\//;
  assert.deepEqual(graph.edges.filter(({ specifier }) => forbidden.test(specifier)), []);
  for (const expected of [
    "src/components/payments/PaymentHistorySectionView.tsx",
    "src/components/sales/SaleHistorySectionView.tsx",
    "src/components/expenses/ExpenseHistorySectionView.tsx",
  ]) assert.ok([...graph.visited].some((file) => file.endsWith(expected)));
});
