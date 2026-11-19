import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const root = new URL("../../../../", import.meta.url);
const source = () => readFile(new URL("src/components/demo/gym/DemoGymProfileEditorView.tsx", root), "utf8");

function jsx(type, props) {
  return typeof type === "function" ? type(props ?? {}) : { type, props: props ?? {} };
}

async function render(props) {
  const compiled = ts.transpileModule(await source(), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mocks = {
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: Symbol.for("fragment") },
    "@/components/ui/Button": { Button: (p) => ({ type: "Button", props: p ?? {} }) },
  };
  const commonjsModule = { exports: {} };
  const require_ = (specifier) => {
    if (!(specifier in mocks)) throw new Error(`Unexpected module: ${specifier}`);
    return mocks[specifier];
  };
  new Function("require", "exports", "module", compiled)(require_, commonjsModule.exports, commonjsModule);
  return commonjsModule.exports.DemoGymProfileEditorView(props);
}

function flatten(node) {
  if (Array.isArray(node)) return node.flatMap(flatten);
  if (!node || typeof node !== "object") return [];
  const children = node.props?.children;
  const kids = children === undefined ? [] : Array.isArray(children) ? children : [children];
  return [node, ...kids.flatMap(flatten)];
}

function findAll(tree, predicate) {
  return flatten(tree).filter(predicate);
}

function findOne(tree, predicate) {
  const matches = findAll(tree, predicate);
  assert.equal(matches.length, 1, `expected exactly one match, found ${matches.length}`);
  return matches[0];
}

function buttonLabeled(tree, label) {
  return findAll(tree, (n) => n.type === "Button" && n.props.children === label)[0] ?? null;
}

const baseProps = () => ({
  isAdmin: true,
  name: "Paula Méndez",
  onNameChange: () => {},
  onSaveName: () => {},
  assignedTeachers: [{ id: "t1", name: "Tomás Ríos" }],
  availableTeachers: [{ id: "t2", name: "Nora Vidal" }],
  addTeacherId: "",
  onAddTeacherIdChange: () => {},
  onAssignTeacher: () => {},
  onUnassignTeacher: () => {},
  paymentExempt: false,
  paymentExemptReason: "",
  onPaymentExemptReasonChange: () => {},
  onTogglePaymentExempt: () => {},
  pending: false,
  error: null,
  onClose: () => {},
});

test("isAdmin=false hides the assignment and exemption sections the core would reject for a TEACHER", async () => {
  const tree = await render({ ...baseProps(), isAdmin: false });
  assert.equal(buttonLabeled(tree, "Agregar"), null);
  assert.equal(buttonLabeled(tree, "Marcar exento"), null);
  assert.equal(buttonLabeled(tree, "Quitar exención"), null);
  assert.equal(findAll(tree, (n) => n.type === "select").length, 0);
  assert.equal(findAll(tree, (n) => n.type === "textarea").length, 0);
  // The name field always stays: editing is ADMIN/TEACHER, not ADMIN-only.
  assert.ok(findAll(tree, (n) => n.type === "input" && n.props.value === "Paula Méndez").length === 1);
});

test("isAdmin=true shows assigned/available teachers and wires assign/unassign to the given callbacks", async () => {
  const calls = { assign: [], unassign: [], addTeacherIdChange: [] };
  const tree = await render({
    ...baseProps(),
    onAssignTeacher: () => calls.assign.push(true),
    onUnassignTeacher: (id) => calls.unassign.push(id),
    onAddTeacherIdChange: (id) => calls.addTeacherIdChange.push(id),
    addTeacherId: "t2",
  });

  const removeButton = findOne(tree, (n) => n.type === "button" && n.props.title === "Quitar profe");
  removeButton.props.onClick();
  assert.deepEqual(calls.unassign, ["t1"]);

  const select = findOne(tree, (n) => n.type === "select");
  const options = findAll(select, (n) => n.type === "option").filter((n) => n !== select);
  assert.deepEqual(options.map((o) => o.props.value), ["", "t2"]);
  select.props.onChange({ target: { value: "t2" } });
  assert.deepEqual(calls.addTeacherIdChange, ["t2"]);

  const addButton = buttonLabeled(tree, "Agregar");
  assert.equal(addButton.props.disabled, false);
  addButton.props.onClick();
  assert.equal(calls.assign.length, 1);
});

test("the assign button stays disabled with no teacher selected, independent of pending", async () => {
  const treeIdle = await render({ ...baseProps(), addTeacherId: "" });
  assert.equal(buttonLabeled(treeIdle, "Agregar").props.disabled, true);
  const treePending = await render({ ...baseProps(), addTeacherId: "t2", pending: true });
  assert.equal(buttonLabeled(treePending, "Agregar").props.disabled, true);
});

test("exemption toggle reflects paymentExempt and calls onTogglePaymentExempt; reason edits call onPaymentExemptReasonChange", async () => {
  const calls = { toggle: 0, reason: [] };
  const treeOff = await render({
    ...baseProps(),
    paymentExempt: false,
    onTogglePaymentExempt: () => { calls.toggle += 1; },
    onPaymentExemptReasonChange: (v) => calls.reason.push(v),
  });
  const markButton = buttonLabeled(treeOff, "Marcar exento");
  assert.ok(markButton);
  markButton.props.onClick();
  assert.equal(calls.toggle, 1);
  const textarea = findOne(treeOff, (n) => n.type === "textarea");
  textarea.props.onChange({ target: { value: "Becado" } });
  assert.deepEqual(calls.reason, ["Becado"]);

  const treeOn = await render({ ...baseProps(), paymentExempt: true });
  assert.ok(buttonLabeled(treeOn, "Quitar exención"));
  assert.equal(buttonLabeled(treeOn, "Marcar exento"), null);
});

test("error renders as an alert only when present, and Guardar/Cerrar call their own callbacks", async () => {
  const calls = { save: 0, close: 0 };
  const withError = await render({ ...baseProps(), error: "No autorizado." });
  const alert = findOne(withError, (n) => n.type === "p" && n.props.role === "alert");
  assert.equal(alert.props.children, "No autorizado.");

  const withoutError = await render({ ...baseProps(), error: null });
  assert.equal(findAll(withoutError, (n) => n.type === "p" && n.props.role === "alert").length, 0);

  const tree = await render({ ...baseProps(), onSaveName: () => { calls.save += 1; }, onClose: () => { calls.close += 1; } });
  buttonLabeled(tree, "Guardar nombre").props.onClick();
  buttonLabeled(tree, "Cerrar").props.onClick();
  assert.equal(calls.save, 1);
  assert.equal(calls.close, 1);
});

test("pending disables the name input and Cerrar, and puts Guardar nombre in its loading state", async () => {
  const tree = await render({ ...baseProps(), pending: true });
  assert.equal(findOne(tree, (n) => n.type === "input").props.disabled, true);
  assert.equal(buttonLabeled(tree, "Cerrar").props.disabled, true);
  assert.equal(buttonLabeled(tree, "Guardar nombre").props.loading, true);
});

test("clicking the backdrop closes while idle, but must not be a way around the disabled Cerrar while pending", async () => {
  const calls = { close: 0 };
  const onClose = () => { calls.close += 1; };
  const target = {};

  const idle = await render({ ...baseProps(), onClose, pending: false });
  assert.equal(idle.type, "div", "the root element is the backdrop itself");
  idle.props.onClick({ target, currentTarget: target });
  assert.equal(calls.close, 1);

  const pending = await render({ ...baseProps(), onClose, pending: true });
  pending.props.onClick({ target, currentTarget: target });
  assert.equal(calls.close, 1, "a backdrop click while pending must not call onClose, matching the disabled Cerrar button");
});
