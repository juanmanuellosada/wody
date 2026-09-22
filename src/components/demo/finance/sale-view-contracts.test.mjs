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
  ts.forEachChild(node, (child) => {
    walk(child, predicate, found);
  });
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

function hasProperty(typeNode, name, expectedText) {
  return ts.isTypeLiteralNode(typeNode) && typeNode.members.some((member) =>
    ts.isPropertySignature(member)
    && member.name.getText() === name
    && member.type?.getText() === expectedText,
  );
}

function loadContracts(now) {
  return source("src/components/sales/sale-view-contracts.ts").then((content) => {
    const output = ts.transpileModule(content, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const compiledModule = { exports: {} };
    vm.runInNewContext(output, { module: compiledModule, exports: compiledModule.exports, Date: now });
    return compiledModule.exports;
  });
}

test("production adapter retains the public positional action contract and its discriminated result", async () => {
  const [dialog, action, contracts] = await Promise.all([
    source("src/components/NewSaleDialog.tsx"),
    source("src/actions/sale.ts"),
    source("src/components/sales/sale-view-contracts.ts"),
  ]);
  const dialogFile = parse("NewSaleDialog.tsx", dialog);
  const liveImports = runtimeImports("NewSaleDialog.tsx", dialog);
  assert.deepEqual(liveImports.filter((specifier) => specifier.startsWith("@/actions/")), ["@/actions/sale"]);

  const liveAdapter = walk(dialogFile, (node) => ts.isVariableDeclaration(node) && node.name.getText() === "registerLiveSale")[0];
  assert.ok(liveAdapter?.initializer && ts.isArrowFunction(liveAdapter.initializer));
  const productionCall = walk(liveAdapter.initializer, ts.isCallExpression)
    .find((call) => call.expression.getText() === "registerSale");
  assert.deepEqual(productionCall?.arguments.map((argument) => argument.getText()), ["productId", "quantity", "unitAmount", "options"]);

  const actionFunction = walk(parse("sale.ts", action), (node) => ts.isFunctionDeclaration(node) && node.name?.text === "registerSale")[0];
  assert.equal(actionFunction?.parameters.length, 4);
  const resultAlias = walk(parse("sale-view-contracts.ts", contracts), (node) =>
    ts.isTypeAliasDeclaration(node) && node.name.text === "SaleRegistrationResult",
  )[0];
  assert.ok(resultAlias && ts.isUnionTypeNode(resultAlias.type));
  assert.ok(resultAlias.type.types.some((member) => hasProperty(member, "success", "true")));
  assert.ok(resultAlias.type.types.some((member) => hasProperty(member, "success", "false") && hasProperty(member, "error", "string")));
});

test("view flow keeps product parsing, error/pending close semantics, and stock warning non-blocking", async () => {
  const content = await source("src/components/sales/NewSaleDialogView.tsx");
  const file = parse("NewSaleDialogView.tsx", content);
  const text = file.getText();
  const methods = walk(file, (node) => ts.isStringLiteral(node) && ["EFECTIVO", "TRANSFERENCIA", "TARJETA", "MERCADO_PAGO"].includes(node.text));
  assert.equal(methods.length >= 4, true);
  assert.ok(text.includes("product.description.toLowerCase().includes(query.toLowerCase())"));
  assert.ok(text.includes("String(product.code).includes(query.trim())"));
  assert.ok(text.includes("setUnitAmount(product ? String(product.salePrice) : \"\")"));
  assert.ok(text.includes("parsedQuantityForDisplay * parsedUnitAmountForDisplay"));
  assert.ok(text.includes("selectedProduct.stock - parsedQuantityForDisplay <= 0"));
  assert.ok(text.includes("Se registra igual."));
  assert.ok(text.includes("parseInt(quantity, 10)"));
  assert.ok(text.includes("parseFloat(unitAmount.replace(\",\", \".\"))"));

  const confirm = walk(file, (node) => ts.isFunctionDeclaration(node) && node.name?.text === "handleConfirm")[0];
  assert.ok(confirm);
  const callback = walk(confirm, ts.isCallExpression).find((call) => call.expression.getText() === "onRegisterSale");
  assert.deepEqual(callback?.arguments.slice(0, 3).map((argument) => argument.getText()), [
    "productId",
    "validation.parsedQuantity",
    "validation.parsedUnitAmount",
  ]);
  assert.ok(text.includes("if (!result.success) {\n        setError(result.error);\n      } else {\n        onClose();"));
  assert.ok(text.includes("!isPending && onClose()"));
});

test("date policy defaults to UTC and supports a local calendar source without changing production options", async () => {
  class FixedDate {
    toISOString() {
      return "2026-10-01T01:30:00.000Z";
    }
  }
  const { resolveSaleToday } = await loadContracts(FixedDate);
  assert.equal(resolveSaleToday(), "2026-10-01");
  assert.equal(resolveSaleToday({ today: () => "2026-09-30" }), "2026-09-30");

  const [dialogView, liveDialog] = await Promise.all([
    source("src/components/sales/NewSaleDialogView.tsx"),
    source("src/components/NewSaleDialog.tsx"),
  ]);
  assert.ok(dialogView.includes("defaultSoldAt={resolveSaleToday(datePolicy)}"));
  assert.ok(dialogView.includes("const maxDate = today();"));
  assert.ok(dialogView.includes("max={today()}"));
  assert.equal(liveDialog.includes("datePolicy="), false);
});

test("pure dialog and button graph excludes live adapters and operational modules", async () => {
  const [buttonView, graph] = await Promise.all([
    source("src/components/sales/NewSaleButtonView.tsx"),
    runtimeGraph([
      "src/components/sales/NewSaleDialogView.tsx",
      "src/components/sales/NewSaleButtonView.tsx",
    ]),
  ]);
  assert.ok(buttonView.includes("<NewSaleDialogView"));
  assert.equal(buttonView.includes("NewSaleDialog\""), false);
  const forbidden = /(^|\/)(actions|auth|prisma|cache|server)(\/|$)|@prisma/;
  assert.deepEqual(graph.edges.filter(({ specifier }) => forbidden.test(specifier)), []);
  assert.ok([...graph.visited].some((file) => file.endsWith("src/components/sales/NewSaleDialogView.tsx")));
  assert.ok([...graph.visited].some((file) => file.endsWith("src/components/sales/NewSaleButtonView.tsx")));
});
