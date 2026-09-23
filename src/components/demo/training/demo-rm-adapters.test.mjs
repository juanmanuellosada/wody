import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createDemoRmCore } from "./demo-rm-core.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createDemoRmCallbackFactory } from "./demo-rm-adapters.ts";

function data(exercise = "  Clean  ", weight = "80", date = "2025-05-10") {
  const form = new FormData();
  form.append("exercise", exercise);
  form.append("exercise", "ignored-second-value");
  form.set("weight", weight);
  form.set("date", date);
  return form;
}

function setup(kind = "GYM", overrides = {}) {
  const core = createDemoRmCore({ kind, ownerIds: ["owner", "other"] });
  let current = core.emptyState();
  const commits = [];
  const callbacks = createDemoRmCallbackFactory({
    core,
    fixedOwnerId: "owner",
    fixedOpaqueToken: core.getActorToken("owner"),
    getState: () => current,
    commit: (next) => { current = next; commits.push(next); },
    ...overrides,
  });
  return { core, callbacks, commits, get current() { return current; }, set current(value) { current = value; } };
}

test("RmsView callbacks preserve FormData first-value, raw parser, create/update/delete signatures, and physical core deletion for both kinds", async () => {
  for (const kind of ["GYM", "PERSONAL"]) {
    const demo = setup(kind);
    assert.deepEqual(await demo.callbacks.onCreateRm(data("  Clean  ", "1e-18", "2025-02-29")), { success: true, id: "demo-rm-local-1" });
    assert.deepEqual(demo.current.rms[0], { id: "demo-rm-local-1", studentId: "owner", exercise: "Clean", weight: 1e-18, date: "2025-03-01" });
    assert.deepEqual(await demo.callbacks.onCreateRm(data("Press", "80kg", "0004-02-29")), { success: true, id: "demo-rm-local-2" });
    assert.equal(demo.current.rms[1].weight, 80);
    assert.equal(demo.current.rms[1].date, "0004-02-29");
    assert.deepEqual(await demo.callbacks.onUpdateRm("demo-rm-local-1", data("  Front Squat  ", "80.125", "2025-05-11")), { success: true });
    assert.deepEqual(await demo.callbacks.onDeleteRm("demo-rm-local-1"), { success: true });
    assert.equal(demo.current.rms.some((row) => row.id === "demo-rm-local-1"), false);
    for (const [weight, expected] of [["0", "El peso debe ser mayor a 0."], ["x", "El peso debe ser mayor a 0."], ["Infinity", "El peso debe ser mayor a 0."], ["80", "El ejercicio no puede estar vacio."]]) {
      assert.deepEqual(await demo.callbacks.onCreateRm(data(weight === "80" ? "  " : "Valid", weight, "2025-05-12")), { success: false, error: expected });
    }
    assert.deepEqual(await demo.callbacks.onCreateRm(data("Valid", "80", "not-a-date")), { success: false, error: "La fecha no es valida." });
  }
});

test("ownership is decided before FormData hooks: foreign and missing updates return production PR-not-found without field reads", async () => {
  const demo = setup();
  const other = demo.core.getActorToken("other");
  demo.current = demo.core.createRm(demo.current, other, { id: "other-rm", exercise: "Press", weight: "70", date: "2025-05-10" }).state;
  let reads = 0;
  const hostileForm = Object.defineProperty({}, "get", { enumerable: true, get() { reads += 1; throw new Error("field read"); } });
  assert.deepEqual(await demo.callbacks.onUpdateRm("other-rm", hostileForm), { success: false, error: "PR no encontrado." });
  assert.deepEqual(await demo.callbacks.onUpdateRm("missing", hostileForm), { success: false, error: "PR no encontrado." });
  assert.equal(reads, 0);
  assert.equal(demo.commits.length, 0);
});

test("foreign, copied, proxied, revoked, cross-core, and cross-kind token bindings are denied before all dependencies or argument hooks", async () => {
  const gym = createDemoRmCore({ kind: "GYM", ownerIds: ["owner"] });
  const personal = createDemoRmCore({ kind: "PERSONAL", ownerIds: ["owner"] });
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  const candidates = [null, {}, Object.assign({}, gym.getActorToken("owner")), new Proxy(gym.getActorToken("owner"), {}), revoked.proxy, personal.getActorToken("owner")];
  let dependencies = 0;
  const hostile = Object.defineProperty({}, "get", { enumerable: true, get() { dependencies += 1; throw new Error("form read"); } });
  for (const token of candidates) {
    const callbacks = createDemoRmCallbackFactory({
      core: gym,
      fixedOwnerId: "owner",
      fixedOpaqueToken: token,
      getState: () => { dependencies += 1; throw new Error("state read"); },
      commit: () => { dependencies += 1; },
      nextId: () => { dependencies += 1; return "never"; },
    });
    assert.deepEqual(await callbacks.onCreateRm(hostile), { success: false, error: "No autorizado." });
    assert.deepEqual(await callbacks.onUpdateRm(hostile, hostile), { success: false, error: "No autorizado." });
    assert.deepEqual(await callbacks.onDeleteRm(hostile), { success: false, error: "No autorizado." });
  }
  assert.equal(dependencies, 0);
});

test("authorized malformed form values fail coherently, while trusted state, commit, and ID dependencies retain their exceptions", async () => {
  const demo = setup();
  const invalid = [null, {}, { get() { return 1; } }, Object.defineProperty({}, "get", { get() { throw new Error("get"); } })];
  for (const form of invalid) assert.deepEqual(await demo.callbacks.onCreateRm(form), { success: false, error: "El PR no es válido." });
  const file = new FormData();
  file.set("exercise", new Blob(["file"]), "exercise.txt");
  file.set("weight", "80");
  file.set("date", "2025-05-10");
  assert.deepEqual(await demo.callbacks.onCreateRm(file), { success: false, error: "El PR no es válido." });
  assert.equal(demo.commits.length, 0);

  const stateFailure = setup("GYM", { getState: () => { throw new Error("state failed"); } });
  await assert.rejects(stateFailure.callbacks.onCreateRm(data()), /state failed/);
  const commitFailure = setup("GYM", { commit: () => { throw new Error("commit failed"); } });
  await assert.rejects(commitFailure.callbacks.onCreateRm(data()), /commit failed/);
  const idFailure = setup("GYM", { nextId: () => { throw new Error("id failed"); } });
  await assert.rejects(idFailure.callbacks.onCreateRm(data()), /id failed/);
});

test("invalid state is explicit, fresh queued state decides ownership and collisions, and only current successful work commits", async () => {
  const invalid = setup();
  invalid.current = { ...invalid.current, rms: [{ id: "bad", studentId: "owner", exercise: "A", weight: Infinity, date: "2025-05-10" }] };
  assert.deepEqual(await invalid.callbacks.onCreateRm(data()), { success: false, error: "El estado de PRs no es valido." });
  assert.deepEqual(await invalid.callbacks.onUpdateRm("bad", data()), { success: false, error: "El estado de PRs no es valido." });

  const fresh = setup();
  const queued = fresh.callbacks.onCreateRm(data("A"));
  fresh.current = fresh.core.createRm(fresh.current, fresh.core.getActorToken("owner"), { id: "demo-rm-local-1", exercise: "Existing", weight: "50", date: "2025-05-10" }).state;
  assert.deepEqual(await queued, { success: true, id: "demo-rm-local-2" });

  const restored = setup();
  restored.current = restored.core.createRm(restored.current, restored.core.getActorToken("owner"), { id: "owned", exercise: "A", weight: "50", date: "2025-05-10" }).state;
  const update = restored.callbacks.onUpdateRm("owned", data("B"));
  restored.current = restored.core.deleteRm(restored.current, restored.core.getActorToken("owner"), "owned").state;
  assert.deepEqual(await update, { success: false, error: "PR no encontrado." });
  assert.equal(restored.commits.length, 0);
});

test("allocation is bounded and lifetime-reserved across failed, deleted, reset, coalesced, repeated, and cancelled queued operations", async () => {
  const candidates = ["demo-rm-local-1", "chosen", "chosen", "later"];
  const demo = setup("GYM", { nextId: () => candidates.shift() ?? "later" });
  assert.deepEqual(await demo.callbacks.onCreateRm(data("A")), { success: true, id: "demo-rm-local-1" });
  assert.deepEqual(await demo.callbacks.onCreateRm(data(" ")), { success: false, error: "El ejercicio no puede estar vacio." });
  assert.deepEqual(await demo.callbacks.onCreateRm(data("C")), { success: true, id: "later" });
  assert.deepEqual(await demo.callbacks.onDeleteRm("demo-rm-local-1"), { success: true });
  demo.current = demo.core.emptyState();
  const exhausted = await demo.callbacks.onCreateRm(data("D"));
  assert.deepEqual(exhausted, { success: false, error: "No se pudo generar un identificador de PR único." });

  const coalesced = setup();
  const first = coalesced.callbacks.onCreateRm(data("One"));
  const same = coalesced.callbacks.onCreateRm(data("One"));
  const distinct = coalesced.callbacks.onCreateRm(data("Two"));
  assert.equal(first, same);
  assert.deepEqual(await distinct, { success: false, error: "Hay otra operación de PRs en curso." });
  assert.deepEqual(await first, { success: true, id: "demo-rm-local-1" });
  assert.deepEqual(await coalesced.callbacks.onCreateRm(data("One")), { success: true, id: "demo-rm-local-2" });

  const reset = setup();
  const old = reset.callbacks.onCreateRm(data("Old"));
  reset.callbacks.cancelPending();
  const current = reset.callbacks.onCreateRm(data("New"));
  assert.deepEqual(await old, { success: false, error: "La operación de PRs fue cancelada." });
  assert.deepEqual(await current, { success: true, id: "demo-rm-local-1" });
  assert.equal(reset.commits.length, 1);
});
