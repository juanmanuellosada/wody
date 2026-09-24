import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const root = new URL("../../../../", import.meta.url);
const source = () => readFile(new URL("src/components/demo/gym/DemoGymFeesAdapter.tsx", root), "utf8");

function jsx(type, props) {
  return typeof type === "function" ? type(props ?? {}) : { type, props: props ?? {} };
}

function flatten(node) {
  if (Array.isArray(node)) return node.flatMap(flatten);
  if (!node || typeof node !== "object") return [];
  const children = node.props?.children;
  const kids = children === undefined ? [] : Array.isArray(children) ? children : [children];
  return [node, ...kids.flatMap(flatten)];
}
function findAll(tree, predicate) { return flatten(tree).filter(predicate); }
function findOne(tree, predicate) {
  const matches = findAll(tree, predicate);
  assert.equal(matches.length, 1, `expected exactly one match, found ${matches.length}`);
  return matches[0];
}
function buttonLabeled(tree, label) { return findAll(tree, (n) => n.type === "Button" && n.props.children === label)[0] ?? null; }
function flush() { return new Promise((resolve) => setTimeout(resolve, 0)); }

/**
 * Renders the real, exported DemoGymFeeRowActions through a CJS-require-mock harness with a real
 * hook-index useState mock (same technique as DemoGymProfileProvider.test.mjs), so state actually
 * updates across re-renders. Button/ConfirmDialog/DemoGymProfileEditorView are marker mocks: their
 * own rendered behavior is covered by DemoGymProfileEditorView.test.mjs and production usage
 * elsewhere; this harness proves the wiring DemoGymFeeRowActions itself owns.
 */
async function createHarness(initialProps) {
  const compiled = ts.transpileModule(await source(), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;

  const states = [];
  let hook = 0;
  const react = {
    useState: (initial) => {
      const index = hook++;
      if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
      return [states[index], (next) => { states[index] = typeof next === "function" ? next(states[index]) : next; }];
    },
    useMemo: (factory) => factory(),
  };
  const mocks = {
    react,
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: Symbol.for("fragment") },
    "@/components/payments/PaymentControlView": { PaymentControlView: () => null },
    "@/components/payments/RegisterPaymentSectionView": { RegisterPaymentSectionView: () => null },
    "@/components/StudentTypeSelectView": { StudentTypeSelectView: () => null },
    "@/components/ui/Button": { Button: (p) => ({ type: "Button", props: p ?? {} }) },
    "@/components/ui/ConfirmDialog": { ConfirmDialog: (p) => ({ type: "ConfirmDialog", props: p ?? {} }) },
    "./DemoGymProfileEditorView": { DemoGymProfileEditorView: (p) => ({ type: "DemoGymProfileEditorView", props: p ?? {} }) },
    "@/components/demo/finance/gym-finance-demo-projection": {},
    "@/components/demo/scenarios/gym-demo-directory": { getGymDemoActorToken: () => null },
    "./DemoGymProvider": { useDemoGym: () => ({}) },
    "./DemoGymFinanceProvider": { useDemoGymFinance: () => ({}) },
    "./DemoGymProfileProvider": { useDemoGymProfile: () => ({}) },
  };
  const commonjsModule = { exports: {} };
  const require_ = (specifier) => {
    if (!(specifier in mocks)) throw new Error(`Unexpected module: ${specifier}`);
    return mocks[specifier];
  };
  new Function("require", "exports", "module", compiled)(require_, commonjsModule.exports, commonjsModule);

  let props = initialProps;
  function render() {
    hook = 0;
    return commonjsModule.exports.DemoGymFeeRowActions(props);
  }
  return { render, setProps: (next) => { props = { ...props, ...next }; } };
}

/**
 * `overrides[name]` may be a plain result object (existing usage) or a function invoked directly
 * — not wrapped in `async` — so it can throw synchronously (simulating a callback that throws
 * before returning a promise) as distinct from returning `Promise.reject(...)` (simulating a
 * callback whose returned promise rejects). Neither `editStudent`/`setBlocked`/`setPaymentExempt`
 * themselves are `async`, so a synchronous throw from the override propagates synchronously out of
 * the callback call itself, exactly like a real callback that throws before ever returning.
 */
function makeCallbacks(overrides = {}) {
  const calls = { editStudent: [], setBlocked: [], setPaymentExempt: [] };
  const ok = { success: true };
  function outcome(name, args) {
    calls[name].push(args);
    const override = overrides[name];
    return typeof override === "function" ? override(...args) : Promise.resolve(override ?? ok);
  }
  const callbacks = {
    editStudent: (studentId, name) => outcome("editStudent", [studentId, name]),
    setBlocked: (studentId, blocked) => outcome("setBlocked", [studentId, blocked]),
    setPaymentExempt: (studentId, exempt, reason) => outcome("setPaymentExempt", [studentId, exempt, reason]),
    setType: () => Promise.resolve({ success: true }),
    setOwnRoutines: () => Promise.resolve({ success: true }),
    assignTeacher: () => Promise.resolve({ success: true }),
    unassignTeacher: () => Promise.resolve({ success: true }),
    cancelPending: () => {},
  };
  return { calls, callbacks };
}

const baseProps = (callbacks) => ({
  studentId: "gym-fixed-student-general",
  isAdmin: true,
  callbacks,
  name: "Paula Méndez",
  blockedAt: null,
  paymentExempt: false,
  paymentExemptReason: null,
});

test("Editar opens the editor with the row's own studentId/isAdmin threaded through, and Guardar issues EDIT_STUDENT with the typed name", async () => {
  const { calls, callbacks } = makeCallbacks();
  const harness = await createHarness(baseProps(callbacks));
  buttonLabeled(harness.render(), "Editar").props.onClick();
  const editor = findOne(harness.render(), (n) => n.type === "DemoGymProfileEditorView");
  assert.equal(editor.props.isAdmin, true);
  assert.equal(editor.props.name, "Paula Méndez");

  editor.props.onNameChange("Paula Editada");
  findOne(harness.render(), (n) => n.type === "DemoGymProfileEditorView").props.onSaveName();
  await flush();

  assert.deepEqual(calls.editStudent, [["gym-fixed-student-general", "Paula Editada"]]);
  assert.equal(calls.setBlocked.length, 0);
  assert.equal(calls.setPaymentExempt.length, 0);
});

test("toggling exemption sends the opposite of the current paymentExempt prop, with the trimmed reason or null", async () => {
  const { calls, callbacks } = makeCallbacks();
  const harness = await createHarness(baseProps(callbacks));
  buttonLabeled(harness.render(), "Editar").props.onClick();
  let editor = findOne(harness.render(), (n) => n.type === "DemoGymProfileEditorView");
  editor.props.onPaymentExemptReasonChange("  Becado  ");
  editor = findOne(harness.render(), (n) => n.type === "DemoGymProfileEditorView");
  editor.props.onTogglePaymentExempt();
  await flush();
  assert.deepEqual(calls.setPaymentExempt, [["gym-fixed-student-general", true, "Becado"]]);

  // paymentExempt is now true on the row (as it would be after the parent re-renders with the
  // bridge's updated state): the second toggle must send `false`, not repeat `true`, proving the
  // command follows the current prop's direction rather than a fixed value.
  harness.setProps({ paymentExempt: true });
  editor = findOne(harness.render(), (n) => n.type === "DemoGymProfileEditorView");
  editor.props.onPaymentExemptReasonChange("   ");
  editor = findOne(harness.render(), (n) => n.type === "DemoGymProfileEditorView");
  editor.props.onTogglePaymentExempt();
  await flush();
  assert.deepEqual(calls.setPaymentExempt[1], ["gym-fixed-student-general", false, null]);
});

test("Bloquear/Desbloquear confirms through the dialog and sends the opposite of the current blockedAt, in both directions", async () => {
  const { calls, callbacks } = makeCallbacks();
  const harness = await createHarness(baseProps(callbacks));

  // Direction 1: unblocked (blockedAt=null) -> Bloquear -> setBlocked(id, true).
  let tree = harness.render();
  assert.equal(buttonLabeled(tree, "Bloquear")?.props.children, "Bloquear");
  buttonLabeled(tree, "Bloquear").props.onClick();
  tree = harness.render();
  let dialog = findOne(tree, (n) => n.type === "ConfirmDialog");
  assert.equal(dialog.props.open, true);
  assert.equal(dialog.props.title, "Bloquear alumno");
  assert.equal(dialog.props.confirmLabel, "Bloquear");
  assert.equal(dialog.props.variant, "danger");
  assert.match(dialog.props.message, /No va a poder ingresar/);
  dialog.props.onConfirm();
  await flush();
  assert.deepEqual(calls.setBlocked, [["gym-fixed-student-general", true]]);
  tree = harness.render();
  assert.equal(findOne(tree, (n) => n.type === "ConfirmDialog").props.open, false, "the dialog closes after resolution");

  // Direction 2: as the row would look after the parent re-renders with the bridge's updated
  // state (blockedAt now set) -> Desbloquear -> setBlocked(id, false), the opposite direction,
  // not a repeat of `true`. Also proves the label and the unblock dialog's own copy/variant, which
  // this test previously never exercised.
  harness.setProps({ blockedAt: "2030-06-01T00:00:00.000Z" });
  tree = harness.render();
  assert.equal(buttonLabeled(tree, "Bloquear"), null);
  assert.equal(buttonLabeled(tree, "Desbloquear")?.props.children, "Desbloquear");
  buttonLabeled(tree, "Desbloquear").props.onClick();
  tree = harness.render();
  dialog = findOne(tree, (n) => n.type === "ConfirmDialog");
  assert.equal(dialog.props.open, true);
  assert.equal(dialog.props.title, "Desbloquear alumno");
  assert.equal(dialog.props.confirmLabel, "Desbloquear");
  assert.equal(dialog.props.variant, "primary");
  assert.match(dialog.props.message, /Va a poder ingresar de nuevo/);
  dialog.props.onConfirm();
  await flush();
  assert.deepEqual(calls.setBlocked[1], ["gym-fixed-student-general", false]);
  tree = harness.render();
  assert.equal(findOne(tree, (n) => n.type === "ConfirmDialog").props.open, false, "the dialog closes after resolution");
});

test("a TEACHER (isAdmin=false) never renders the Bloquear affordance, and the editor still receives isAdmin=false", async () => {
  const { callbacks } = makeCallbacks();
  const harness = await createHarness({ ...baseProps(callbacks), isAdmin: false });
  let tree = harness.render();
  assert.equal(buttonLabeled(tree, "Bloquear"), null);
  assert.equal(buttonLabeled(tree, "Desbloquear"), null);
  buttonLabeled(tree, "Editar").props.onClick();
  tree = harness.render();
  assert.equal(findOne(tree, (n) => n.type === "DemoGymProfileEditorView").props.isAdmin, false);
});

test("a rejected command surfaces its error without throwing, and does not clear the typed name", async () => {
  const { calls, callbacks } = makeCallbacks({ editStudent: { success: false, error: "Este alumno no está asignado a vos." } });
  const harness = await createHarness(baseProps(callbacks));
  buttonLabeled(harness.render(), "Editar").props.onClick();
  let editor = findOne(harness.render(), (n) => n.type === "DemoGymProfileEditorView");
  editor.props.onNameChange("Intento de edición");
  editor = findOne(harness.render(), (n) => n.type === "DemoGymProfileEditorView");
  editor.props.onSaveName();
  await flush();
  assert.deepEqual(calls.editStudent, [["gym-fixed-student-general", "Intento de edición"]]);
  editor = findOne(harness.render(), (n) => n.type === "DemoGymProfileEditorView");
  assert.equal(editor.props.error, "Este alumno no está asignado a vos.");
  assert.equal(editor.props.name, "Intento de edición", "a failed save must not revert what the user typed");
  assert.equal(editor.props.pending, false);
});

test("null callbacks (profile bridge not ready yet) surface an unavailable error instead of throwing", async () => {
  const harness = await createHarness(baseProps(null));
  buttonLabeled(harness.render(), "Editar").props.onClick();
  let editor = findOne(harness.render(), (n) => n.type === "DemoGymProfileEditorView");
  editor.props.onSaveName();
  await flush();
  editor = findOne(harness.render(), (n) => n.type === "DemoGymProfileEditorView");
  assert.match(editor.props.error, /no está disponible/);
});

test("a callback whose returned promise rejects still clears pending and surfaces an error, and the row is usable again", async () => {
  const { callbacks } = makeCallbacks({ editStudent: () => Promise.reject(new Error("network glitch")) });
  const harness = await createHarness(baseProps(callbacks));
  buttonLabeled(harness.render(), "Editar").props.onClick();
  let editor = findOne(harness.render(), (n) => n.type === "DemoGymProfileEditorView");
  editor.props.onSaveName();
  await flush();
  editor = findOne(harness.render(), (n) => n.type === "DemoGymProfileEditorView");
  assert.equal(editor.props.pending, false, "pending must clear even when the callback's promise rejects");
  assert.match(editor.props.error, /No se pudo completar la operación/);
  const tree = harness.render();
  assert.equal(buttonLabeled(tree, "Editar").props.disabled, false, "the row must stay usable, not lock up");
});

test("a callback that throws synchronously (never returns a promise) still closes the block dialog and clears pending", async () => {
  const { callbacks } = makeCallbacks({ setBlocked: () => { throw new Error("kaboom"); } });
  const harness = await createHarness(baseProps(callbacks));
  buttonLabeled(harness.render(), "Bloquear").props.onClick();
  let tree = harness.render();
  findOne(tree, (n) => n.type === "ConfirmDialog").props.onConfirm();
  await flush();
  tree = harness.render();
  assert.equal(findOne(tree, (n) => n.type === "ConfirmDialog").props.open, false, "the dialog must not stay stuck open in its loading state");
  assert.equal(buttonLabeled(tree, "Bloquear").props.disabled, false, "pending must clear even when the callback throws synchronously");
  const alert = findOne(tree, (n) => n.type === "p" && n.props.role === "alert");
  assert.match(alert.props.children, /No se pudo completar la operación/);
});
