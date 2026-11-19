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

test("live product adapters retain their public props and own every product action import", async () => {
  const [list, dialog, categories] = await Promise.all([
    source("src/components/products/ProductList.tsx"),
    source("src/components/products/ProductDialog.tsx"),
    source("src/components/products/CategoryManager.tsx"),
  ]);
  assert.match(list, /export function ProductList\(\{ products, categories, previewCode \}: Props\)/);
  assert.match(dialog, /export type \{ ProductCategoryOption, ProductRow \} from "@\/components\/products\/product-view-contracts"/);
  assert.match(dialog, /export function ProductDialog\(\{ categories, previewCode, product, onClose \}/);
  assert.match(categories, /export function CategoryManager\(\{ initialCategories \}: Props\)/);
  assert.match(list, /import \{ createCategory, createProduct, deleteProduct, updateProduct \} from "@\/actions\/product"/);
  assert.match(dialog, /import \{ createCategory, createProduct, updateProduct \} from "@\/actions\/product"/);
  assert.match(categories, /import \{ createCategory, deleteCategory, updateCategory \} from "@\/actions\/product"/);
});

test("product views preserve action arguments, result paths, parsing, and local category updates", async () => {
  const [dialog, list, categories] = await Promise.all([
    source("src/components/products/ProductDialogView.tsx"),
    source("src/components/products/ProductListView.tsx"),
    source("src/components/products/CategoryManagerView.tsx"),
  ]);
  assert.match(dialog, /const parsedPrice = parseFloat\(salePrice\.replace\(",", "\."\)\)/);
  assert.match(dialog, /parsedPrice < 0/);
  assert.match(dialog, /const parsedStock = parseInt\(stock, 10\)/);
  assert.ok(dialog.includes('if (raw === "" || /^-?\\d*$/.test(raw)) setStock(raw);'));
  assert.match(dialog, /const result = isEdit\s*\? await onUpdateProduct\(product!\.id, data\)\s*: await onCreateProduct\(data\);/s);
  assert.match(dialog, /setCategories\(\(prev\) => \[\.\.\.prev, result\.category\]\);\s*setCategoryId\(result\.category\.id\);\s*setNewCategoryName\(""\);\s*setAddingCategory\(false\);/s);
  assert.match(dialog, /if \(!result\.success\) \{\s*setError\(result\.error\);\s*\} else \{\s*onClose\(\);\s*\}/s);
  assert.match(list, /const result = await onDeleteProduct\(deleteTarget\.id\);/);
  assert.match(list, /loading=\{isDeleting\}/);
  assert.match(list, /if \(!isDeleting\) \{\s*setDeleteTarget\(null\);\s*setDeleteError\(null\);\s*\}/s);
  assert.match(categories, /setCategories\(\(prev\) => \[\.\.\.prev, result\.category\]\);\s*setNewName\(""\);/s);
  assert.match(categories, /prev\.map\(\(c\) => \(c\.id === editingId \? \{ \.\.\.c, name: trimmed \} : c\)\)/);
  assert.match(categories, /prev\.filter\(\(c\) => c\.id !== deleteTarget\.id\)/);
});

test("product composition renders extracted views rather than live wrappers", async () => {
  const [listView, list, dialog, categories] = await Promise.all([
    source("src/components/products/ProductListView.tsx"),
    source("src/components/products/ProductList.tsx"),
    source("src/components/products/ProductDialog.tsx"),
    source("src/components/products/CategoryManager.tsx"),
  ]);
  assert.match(listView, /import \{ ProductDialogView \} from "@\/components\/products\/ProductDialogView"/);
  assert.match(listView, /<ProductDialogView/);
  assert.doesNotMatch(listView, /from "@\/components\/products\/ProductDialog";/);
  assert.match(list, /<ProductListView/);
  assert.match(dialog, /<ProductDialogView/);
  assert.match(categories, /<CategoryManagerView/);
});

test("recursive pure product-view graph excludes operational modules", async () => {
  const { visited, edges } = await runtimeGraph([
    "src/components/products/ProductListView.tsx",
    "src/components/products/ProductDialogView.tsx",
    "src/components/products/CategoryManagerView.tsx",
  ]);
  for (const expected of [
    "src/components/products/ProductListView.tsx",
    "src/components/products/ProductDialogView.tsx",
    "src/components/products/CategoryManagerView.tsx",
  ]) assert.ok([...visited].some((file) => file.endsWith(expected)));
  const forbidden = /(^|\/)(actions|auth|prisma|cache|server)(\/|$)|@\/actions|@\/lib|@prisma|^next\//;
  assert.deepEqual(edges.filter(({ specifier }) => forbidden.test(specifier)), []);
});
