import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

// This file answers one factual question raised during review of the GYM payment-links redesign
// (the `registerPayment` memo in DemoGymFeesAdapter): DialogForm inside RegisterPaymentDialogView reads
// `onRegisterPayment` straight from its render props into a plain `submit` function (not a ref,
// unlike onClose/onCancelPendingDuplicate just above it, which ARE ref-captured on purpose). If a
// caller retains an `onRegisterPayment` reference across renders and only ever calls the ORIGINAL
// one — a stale closure, distinct from the ref/shared-cell "rewind" hazard already closed off in
// gym-finance-payment-adapters.test.mjs — the duplicate-confirmation retry could dispatch with an
// outdated links snapshot even though the wrapper itself no longer caches anything.
//
// This drives the real, unmodified RegisterPaymentDialogView/DialogForm source (not a rewrite or a
// simplified stand-in) through the exact sequence the concern describes: first attempt gets
// `requiresConfirmation`, the dialog stays open showing the confirm screen, the CALLER re-renders
// with a NEW onRegisterPayment (standing in for DemoGymFeesAdapter recomputing `registerPayment`
// after profileState.links changed), then the confirm click fires. Since `submit` (and the
// "Registrar igual" button's onClick) is a plain closure rebuilt on every DialogForm render from
// current props — not memoized, not ref-captured — whichever render happened last before the click
// decides which onRegisterPayment gets called. This only proves that property; it does not
// re-verify that an assign/unassign in DemoGymFeesAdapter always reaches DialogForm before a human
// can click (that rests on ordinary React context propagation and the absence of any memo boundary
// in RegisterPaymentSectionView/RegisterPaymentDialogView/DialogForm, confirmed by inspection, not
// re-tested here since it would need a full multi-file app render this project's test style does
// not otherwise use).

const root = new URL("../../../", import.meta.url);
const source = () => readFile(new URL("src/components/payments/RegisterPaymentDialogView.tsx", root), "utf8");

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

function findAll(tree, predicate) {
  return flatten(tree).filter(predicate);
}

function buttonLabeled(tree, label) {
  return findAll(tree, (n) => n.type === "Button" && n.props.children === label)[0] ?? null;
}

/**
 * Hook mock notes: useEffect is a deliberate no-op. The only effects in DialogForm sync
 * onCloseRef/onCancelPendingDuplicateRef and register document-level listeners — none of that
 * affects which onRegisterPayment a submit closure captures, since onRegisterPayment is read
 * directly from props (never from a ref). states/refs persist across render() calls to simulate
 * one long-lived DialogForm instance receiving new props on each call, exactly like React updating
 * an already-mounted component.
 */
async function createHarness() {
  const compiled = ts.transpileModule(await source(), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  let hook = 0;
  const states = [];
  const refs = [];
  let pendingTransition = null;
  const react = {
    useState: (initial) => {
      const index = hook++;
      if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
      return [states[index], (next) => { states[index] = typeof next === "function" ? next(states[index]) : next; }];
    },
    useRef: (initial) => {
      const index = hook++;
      return refs[index] ??= { current: initial };
    },
    useEffect: () => { hook++; },
    useCallback: (callback) => (hook++, callback),
    useTransition: () => { hook++; return [false, (fn) => { pendingTransition = fn(); }]; },
  };
  const mocks = {
    react,
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: Symbol.for("fragment") },
    "@/components/ui/Button": { Button: (p) => ({ type: "Button", props: p ?? {} }) },
    "@/components/ui/DatePicker": { DatePicker: (p) => ({ type: "DatePicker", props: p ?? {} }) },
  };
  const commonjsModule = { exports: {} };
  const require_ = (specifier) => {
    if (!(specifier in mocks)) throw new Error(`Unexpected module: ${specifier}`);
    return mocks[specifier];
  };
  new Function("require", "exports", "module", compiled)(require_, commonjsModule.exports, commonjsModule);
  const RegisterPaymentDialogView = commonjsModule.exports.RegisterPaymentDialogView;
  return {
    render(props) {
      hook = 0;
      pendingTransition = null;
      return RegisterPaymentDialogView(props);
    },
    async flush() {
      if (pendingTransition) {
        await pendingTransition;
        pendingTransition = null;
      }
    },
  };
}

const student = { id: "s1", name: "Ana", suggestedNextDate: "2030-08-01", lastAmount: 100 };
const baseProps = {
  students: [student],
  preSelectedStudentId: "s1",
  open: true,
  onClose: () => {},
  datePolicy: { today: () => "2030-07-01" },
};

test("the confirmed-duplicate retry calls whichever onRegisterPayment was current on the render before the click, not the one captured on the first attempt", async () => {
  const harness = await createHarness();

  const staleCalls = [];
  const staleCallback = async () => {
    staleCalls.push(true);
    return { success: false, requiresConfirmation: true, duplicateInfo: { studentName: "Ana", paidAt: "2030-07-01" } };
  };
  const freshCalls = [];
  const freshCallback = async (studentId, amount, nextDate, options) => {
    freshCalls.push({ studentId, amount, nextDate, options });
    return { success: true };
  };

  // First attempt, wired to the "stale" callback (stands in for a render captured before links changed).
  let tree = harness.render({ ...baseProps, onRegisterPayment: staleCallback });
  const submitButton = buttonLabeled(tree, "Registrar");
  assert.ok(submitButton, "expected the initial form's Registrar button");
  submitButton.props.onClick();
  await harness.flush();
  assert.equal(staleCalls.length, 1, "the first attempt must reach the stale callback exactly once");

  // The caller re-renders with a NEW onRegisterPayment while the dialog stays open showing the
  // duplicate-confirmation screen — standing in for DemoGymFeesAdapter recomputing registerPayment
  // after profileState.links changed (e.g. an assign/unassign resolved).
  tree = harness.render({ ...baseProps, onRegisterPayment: freshCallback });
  const confirmButton = buttonLabeled(tree, "Registrar igual");
  assert.ok(confirmButton, "expected the duplicate-confirmation screen with a Registrar igual button");
  confirmButton.props.onClick();
  await harness.flush();

  assert.equal(staleCalls.length, 1, "the retry must not reach the stale callback again");
  assert.equal(freshCalls.length, 1, "the retry must reach the callback current as of the render before the click");
  assert.equal(freshCalls[0].options.confirmedDuplicate, true, "the retry must still be marked as a confirmed duplicate");
});

test("without any re-render between the first attempt and the retry, the retry still uses the only onRegisterPayment it has ever been given (baseline: no re-render means no fresher prop exists yet)", async () => {
  const harness = await createHarness();
  const calls = [];
  const callback = async (studentId, amount, nextDate, options) => {
    calls.push(options.confirmedDuplicate);
    return calls.length === 1
      ? { success: false, requiresConfirmation: true, duplicateInfo: { studentName: "Ana", paidAt: "2030-07-01" } }
      : { success: true };
  };

  let tree = harness.render({ ...baseProps, onRegisterPayment: callback });
  buttonLabeled(tree, "Registrar").props.onClick();
  await harness.flush();

  // Same props object, same callback identity: re-rendering with unchanged onRegisterPayment must
  // still work and must not be mistaken for a rewind (this is the ordinary "nothing changed" case).
  tree = harness.render({ ...baseProps, onRegisterPayment: callback });
  const confirmButton = buttonLabeled(tree, "Registrar igual");
  assert.ok(confirmButton, "expected the duplicate-confirmation screen");
  confirmButton.props.onClick();
  await harness.flush();

  assert.deepEqual(calls, [false, true]);
});
