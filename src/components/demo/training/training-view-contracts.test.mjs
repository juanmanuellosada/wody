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

function visit(node, callback) {
  callback(node);
  ts.forEachChild(node, (child) => visit(child, callback));
}

function importBindingsAreTypeOnly(importDeclaration) {
  const clause = importDeclaration.importClause;
  if (!clause) return false;
  if (clause.isTypeOnly) return true;
  if (clause.name || !clause.namedBindings) return false;
  if (!ts.isNamedImports(clause.namedBindings)) return false;
  return clause.namedBindings.elements.every((specifier) => specifier.isTypeOnly);
}

function runtimeModuleSpecifiers(filePath, content) {
  const parsed = parse(filePath, content);
  const specifiers = [];

  visit(parsed, (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      if (!importBindingsAreTypeOnly(node)) specifiers.push(node.moduleSpecifier.text);
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specifiers.push(node.arguments[0].text);
    }
  });

  return specifiers;
}

async function resolveLocalImport(fromFile, specifier) {
  let basePath;
  if (specifier.startsWith("@/")) {
    basePath = path.join(sourceRoot, specifier.slice(2));
  } else if (specifier.startsWith(".")) {
    basePath = path.resolve(path.dirname(fromFile), specifier);
  } else {
    return null;
  }

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
      const localImport = await resolveLocalImport(filePath, specifier);
      if (localImport) pending.push(localImport);
    }
  }

  return { edges, visited };
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

function jsxAttributeNames(filePath, content, componentName) {
  const names = new Set();
  visit(parse(filePath, content), (node) => {
    if (
      ts.isJsxSelfClosingElement(node) &&
      ts.isIdentifier(node.tagName) &&
      node.tagName.text === componentName
    ) {
      for (const attribute of node.attributes.properties) {
        if (ts.isJsxAttribute(attribute)) names.add(attribute.name.text);
      }
    }
  });
  return names;
}

function jsxAttributeExpressionTexts(filePath, content, componentName) {
  const expressions = new Map();
  visit(parse(filePath, content), (node) => {
    if (
      ts.isJsxSelfClosingElement(node) &&
      ts.isIdentifier(node.tagName) &&
      node.tagName.text === componentName
    ) {
      for (const attribute of node.attributes.properties) {
        if (ts.isJsxAttribute(attribute) && attribute.initializer && ts.isJsxExpression(attribute.initializer)) {
          expressions.set(attribute.name.text, attribute.initializer.expression?.getText());
        }
      }
    }
  });
  return expressions;
}

function interfacePropertyNames(filePath, content, interfaceName) {
  const names = new Set();
  visit(parse(filePath, content), (node) => {
    if (ts.isInterfaceDeclaration(node) && node.name.text === interfaceName) {
      for (const member of node.members) {
        if (ts.isPropertySignature(member) && member.name) names.add(member.name.getText());
      }
    }
  });
  return names;
}

function assertExactCall(filePath, content, name, expectedArguments) {
  assert.deepEqual(
    callArguments(filePath, content, name),
    [expectedArguments],
    `${name} must preserve its original argument order`
  );
}

test("action-free training views have explicit mutation contracts", async () => {
  const paths = [
    "src/components/wod/WodManagerView.tsx",
    "src/components/wod/CopyWodDialogView.tsx",
    "src/components/group/GroupManagerView.tsx",
  ];
  const contents = await Promise.all(paths.map(source));

  assert.deepEqual(
    interfacePropertyNames(paths[0], contents[0], "WodManagerViewProps"),
    new Set([
      "wods",
      "groups",
      "students",
      "muslibStudents",
      "terms",
      "lockedTarget",
      "onCreateWod",
      "onUpdateWod",
      "onDeleteWod",
      "onCreateFixedRoutine",
      "onCreateFixedRoutineForGroup",
      "onCopyWod",
      "legacyDemoNoOp",
      "disableDelete",
    ])
  );
  assert.deepEqual(
    interfacePropertyNames(paths[1], contents[1], "CopyWodDialogViewProps"),
    new Set(["sourceWod", "groups", "students", "onClose", "terms", "onCopyWod", "legacyDemoNoOp"])
  );
  assert.deepEqual(
    interfacePropertyNames(paths[2], contents[2], "GroupManagerViewProps"),
    new Set([
      "groups",
      "hideCreate",
      "onCreateGroup",
      "onDeleteGroup",
      "onRenameGroup",
      "onAssignStudentToGroup",
      "onRemoveStudentFromGroup",
      "legacyDemoNoOp",
    ])
  );

  assertExactCall(paths[0], contents[0], "onCreateWod", ["newDate", "editorTitle", "editorContent", "target"]);
  assertExactCall(paths[0], contents[0], "onUpdateWod", ["editingWodId", "editorTitle", "editorContent", "newDate", "target"]);
  assertExactCall(paths[0], contents[0], "onDeleteWod", ["wodId"]);
  assertExactCall(paths[0], contents[0], "onCreateFixedRoutine", ["target.studentId", "editorTitle", "editorContent", "newDate"]);
  assertExactCall(paths[0], contents[0], "onCreateFixedRoutineForGroup", ["target.groupId", "editorTitle", "editorContent", "newDate"]);
  assertExactCall(paths[1], contents[1], "onCopyWod", ["sourceWod.id", "targetDate", "target"]);
  assertExactCall(paths[2], contents[2], "onCreateGroup", ["newGroupName.trim()"]);
  assertExactCall(paths[2], contents[2], "onDeleteGroup", ["groupId"]);
  assertExactCall(paths[2], contents[2], "onRenameGroup", ["groupId", "renameValue.trim()"]);
  assertExactCall(paths[2], contents[2], "onAssignStudentToGroup", ["studentId", "groupId"]);
  assertExactCall(paths[2], contents[2], "onRemoveStudentFromGroup", ["studentId", "groupId"]);
});

test("production adapters retain action arguments, locked target, fixed routines, and legacy demo no-ops", async () => {
  const wodPath = "src/components/wod/WodManagerClient.tsx";
  const copyPath = "src/components/wod/CopyWodDialog.tsx";
  const groupPath = "src/components/group/GroupManager.tsx";
  const [wod, copy, group] = await Promise.all([source(wodPath), source(copyPath), source(groupPath)]);
  const wodBindings = jsxAttributeExpressionTexts(wodPath, wod, "WodManagerView");
  const copyBindings = jsxAttributeExpressionTexts(copyPath, copy, "CopyWodDialogView");
  const groupBindings = jsxAttributeExpressionTexts(groupPath, group, "GroupManagerView");

  // Direct references preserve each live action's full signature, arguments, result, and revalidation behavior.
  assert.equal(wodBindings.get("onCreateWod"), "createWod");
  assert.equal(wodBindings.get("onUpdateWod"), "updateWod");
  assert.equal(wodBindings.get("onDeleteWod"), "deleteWod");
  assert.equal(wodBindings.get("onCreateFixedRoutine"), "createFixedRoutine");
  assert.equal(wodBindings.get("onCreateFixedRoutineForGroup"), "createFixedRoutineForGroup");
  assert.equal(wodBindings.get("onCopyWod"), "copyWod");
  assert.equal(copyBindings.get("onCopyWod"), "copyWod");
  assert.equal(groupBindings.get("onCreateGroup"), "createGroup");
  assert.equal(groupBindings.get("onDeleteGroup"), "deleteGroup");
  assert.equal(groupBindings.get("onRenameGroup"), "renameGroup");
  assert.equal(groupBindings.get("onAssignStudentToGroup"), "assignStudentToGroup");
  assert.equal(groupBindings.get("onRemoveStudentFromGroup"), "removeStudentFromGroup");

  assert.deepEqual(
    jsxAttributeNames(wodPath, wod, "WodManagerView"),
    new Set([
      "wods",
      "groups",
      "students",
      "muslibStudents",
      "terms",
      "lockedTarget",
      "onCreateWod",
      "onUpdateWod",
      "onDeleteWod",
      "onCreateFixedRoutine",
      "onCreateFixedRoutineForGroup",
      "onCopyWod",
      "legacyDemoNoOp",
      "disableDelete",
    ])
  );
  assert.deepEqual(
    jsxAttributeNames(copyPath, copy, "CopyWodDialogView"), new Set([
      "sourceWod",
      "groups",
      "students",
      "onClose",
      "terms",
      "onCopyWod",
      "legacyDemoNoOp",
    ])
  );
  assert.deepEqual(
    jsxAttributeNames(groupPath, group, "GroupManagerView"), new Set([
      "groups",
      "hideCreate",
      "onCreateGroup",
      "onDeleteGroup",
      "onRenameGroup",
      "onAssignStudentToGroup",
      "onRemoveStudentFromGroup",
      "legacyDemoNoOp",
    ])
  );

  assert.match(wod, /lockedTarget\?: WodTarget/);
  assert.equal(wodBindings.get("legacyDemoNoOp"), "demo");
  assert.equal(wodBindings.get("disableDelete"), "demo");
  assert.equal(copyBindings.get("legacyDemoNoOp"), "demo");
  assert.equal(groupBindings.get("legacyDemoNoOp"), "demo");
});

test("the complete local training runtime graph excludes operational modules, including dynamic editor dependencies", async () => {
  const { edges, visited } = await runtimeLocalGraph([
    "src/components/wod/WodManagerView.tsx",
    "src/components/wod/CopyWodDialogView.tsx",
    "src/components/group/GroupManagerView.tsx",
    "src/components/demo/training/training-demo-state.ts",
    "src/components/demo/training/training-demo-storage.ts",
    "src/components/demo/training/training-demo-adapters.ts",
    "src/components/demo/training/DemoTrainingProvider.tsx",
  ]);

  assert.ok(
    [...visited].some((filePath) => filePath.endsWith("src/components/ui/MarkdownEditor.tsx")),
    "the graph must traverse WodManagerView's next/dynamic MarkdownEditor import"
  );
  assert.ok(
    [...visited].some((filePath) => filePath.endsWith("src/components/wod/CopyWodDialogView.tsx")),
    "the graph must traverse the copy dialog view"
  );

  const forbidden = /(^|\/)(actions|auth|prisma|cache|server)(\/|$)/;
  assert.deepEqual(
    edges.filter(({ specifier }) => forbidden.test(specifier)),
    [],
    `runtime graph contains an operational import: ${JSON.stringify(edges)}`
  );
});

test("the client provider exposes hydration-safe local state, projections, and the callback factory", async () => {
  const providerPath = "src/components/demo/training/DemoTrainingProvider.tsx";
  const provider = await source(providerPath);
  const parsed = parse(providerPath, provider);
  const exported = new Set();
  visit(parsed, (node) => {
    if (ts.isFunctionDeclaration(node) && node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      exported.add(node.name?.text);
    }
  });
  assert.deepEqual(exported, new Set(["DemoTrainingProvider", "useDemoTraining"]));
  assert.match(provider, /^"use client";/);
  assert.match(provider, /typeof window !== "undefined"/);
  assert.match(provider, /resolveTrainingDemoInitialState\(null, initialState\)\.state/);
  assert.match(provider, /loadTrainingDemoState\(storageRef\.current, initialFallbackState\)/);
  assert.match(provider, /createTrainingCallbackFactory/);
  assert.match(provider, /projectTrainingViews/);
  assert.doesNotMatch(provider, /setState\(\(previous/);
});
