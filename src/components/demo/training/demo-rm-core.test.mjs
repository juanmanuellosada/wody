import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createDemoRmCore } from "./demo-rm-core.ts";

const projectRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const row = (id, studentId, date = "2025-05-10") => ({ id, studentId, exercise: "Squat", weight: 100, date });
const command = (id, extra = {}) => ({ id, exercise: "  Clean  ", weight: "80", date: "2025-05-10", ...extra });

function setup(kind = "GYM", ownerIds = ["student", "admin", "teacher"]) {
  const core = createDemoRmCore({ kind, ownerIds });
  return { core, student: core.getActorToken("student"), admin: core.getActorToken("admin"), teacher: core.getActorToken("teacher") };
}

function assertFailure(state, transition, error) {
  assert.equal(transition.state, state);
  assert.equal(transition.result.success, false);
  if (error) assert.equal(transition.result.error, error);
}

function assertProjectionSuccess(result) {
  assert.equal(result.success, true);
  return result.rms;
}

function assertProjectionFailure(result, error) {
  assert.deepEqual(result, { success: false, error });
}

for (const kind of ["GYM", "PERSONAL"]) {
  test(`${kind} has an isolated PR ledger and authenticated owners may only CRUD their own rows`, () => {
    const { core, student, admin, teacher } = setup(kind);
    assert.equal(core.namespace, kind === "GYM" ? "demo-gym-rms/v1" : "demo-personal-rms/v1");
    let state = core.emptyState();
    const created = core.createRm(state, student, command("student-rm"));
    assert.deepEqual(created.result, { success: true, id: "student-rm" });
    state = created.state;
    for (const actor of [admin, teacher]) {
      assert.deepEqual(assertProjectionSuccess(core.projectRms(state, actor)), []);
      assertFailure(state, core.updateRm(state, actor, command("student-rm", { exercise: "", weight: "-1", date: "" })), "PR no encontrado.");
      assertFailure(state, core.deleteRm(state, actor, "student-rm"), "PR no encontrado.");
    }
    const adminCreated = core.createRm(state, admin, command("admin-rm", { exercise: "Press" }));
    state = adminCreated.state;
    assert.deepEqual(assertProjectionSuccess(core.projectRms(state, admin)).map((entry) => entry.id), ["admin-rm"]);
    assert.equal(core.updateRm(state, admin, command("admin-rm", { weight: "80kg", date: "2025-02-29" })).result.success, true);
    assert.equal(core.deleteRm(state, admin, "admin-rm").result.success, true);
    assert.equal(core.createRm(core.emptyState(), teacher, command("teacher-rm")).result.success, true);
  });
}

test("tokens are private, stable, owner IDs are copied once, and scope/factory boundaries cannot cross", () => {
  const config = { kind: "GYM", ownerIds: ["student", "admin", "__proto__"] };
  const gym = createDemoRmCore(config);
  const sameGym = createDemoRmCore({ kind: "GYM", ownerIds: ["student", "admin", "__proto__"] });
  const personal = createDemoRmCore({ kind: "PERSONAL", ownerIds: ["student", "admin", "__proto__"] });
  const student = gym.getActorToken("student");
  assert.equal(student, gym.getActorToken("student"));
  assert.ok(gym.getActorToken("__proto__"));
  config.ownerIds[0] = "forged";
  config.ownerIds.push("new-owner");
  assert.ok(gym.getActorToken("student"));
  assert.equal(gym.getActorToken("forged"), null);
  assert.equal(gym.getActorToken("new-owner"), null);
  assert.equal(gym.getActorToken(Object.create({ toString: () => "student" })), null);
  const state = gym.resetState({ version: 1, namespace: gym.namespace, kind: "GYM", rms: [row("same", "student")] });
  assert.ok(state);
  for (const actor of [sameGym.getActorToken("student"), personal.getActorToken("student"), { }, Object.assign({}, student)]) {
    assertProjectionFailure(gym.projectRms(state, actor), "No autorizado.");
    assertFailure(state, gym.deleteRm(state, actor, "same"), "No autorizado.");
  }
  assert.deepEqual(assertProjectionSuccess(personal.projectRms(personal.resetState({ version: 1, namespace: personal.namespace, kind: "PERSONAL", rms: [row("same", "student")] }), personal.getActorToken("student"))).map((entry) => entry.id), ["same"]);
});

test("invalid or foreign actors are denied before state, command, IDs, or dependencies are read", () => {
  const { core } = setup();
  let reads = 0;
  const hostileState = Object.defineProperty({}, "rms", { get() { reads += 1; throw new Error("state read"); } });
  const hostileCommand = Object.defineProperty({}, "id", { get() { reads += 1; throw new Error("command read"); } });
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  for (const actor of [null, { id: "student" }, Object.create({ id: "student" }), revoked.proxy]) {
    assertFailure(hostileState, core.createRm(hostileState, actor, hostileCommand), "No autorizado.");
    assertFailure(hostileState, core.updateRm(hostileState, actor, hostileCommand), "No autorizado.");
    assertFailure(hostileState, core.deleteRm(hostileState, actor, "never"), "No autorizado.");
    assertProjectionFailure(core.projectRms(hostileState, actor), "No autorizado.");
  }
  assert.equal(reads, 0);
});

test("update decides row ownership before field semantics and all failures preserve the input identity", () => {
  const { core, student, admin } = setup();
  const state = core.resetState({ version: 1, namespace: core.namespace, kind: "GYM", rms: [row("other", "admin")] });
  assert.ok(state);
  assertFailure(state, core.updateRm(state, student, command("other", { exercise: "", weight: "Infinity", date: "" })), "PR no encontrado.");
  assertFailure(state, core.updateRm(state, student, command("missing", { exercise: "", weight: "Infinity", date: "" })), "PR no encontrado.");
  assertFailure(state, core.createRm(state, student, command("other")), "No autorizado.");
  assert.equal(core.updateRm(state, admin, command("other", { exercise: "", weight: "80", date: "2025-05-10" })).result.error, "El ejercicio no puede estar vacio.");
});

test("the raw production parseFloat contract accepts finite prefixes and rejects zero, negative, NaN, and the intentional non-finite boundary", () => {
  const { core, student } = setup();
  for (const [id, raw, accepted] of [
    ["small", "1e-18", true], ["decimal", "80.125", true], ["prefix", "80kg", true],
    ["zero", "0", false], ["negative", "-1", false], ["dot", ".", false], ["nan", "x", false],
    ["infinity", "Infinity", false], ["exponent-infinity", "1e999", false],
  ]) {
    const state = core.emptyState();
    const result = core.createRm(state, student, command(id, { weight: raw }));
    assert.equal(result.result.success, accepted, raw);
    assert.equal(result.state === state, !accepted, raw);
    if (accepted) assert.equal(result.state.rms[0].weight, parseFloat(raw));
  }
});

test("dates use UTC midnight, preserve low years and past/future values, normalize overflow, and reject blank or invalid dates", () => {
  const { core, student } = setup();
  for (const [id, raw, expected] of [
    ["past", "0001-01-01", "0001-01-01"], ["leap", "0004-02-29", "0004-02-29"],
    ["rollover", "2025-02-29", "2025-03-01"], ["future", "2099-12-31", "2099-12-31"],
  ]) {
    const result = core.createRm(core.emptyState(), student, command(id, { date: raw }));
    assert.equal(result.result.success, true);
    assert.equal(result.state.rms[0].date, expected);
  }
  for (const raw of ["", "not-a-date", "2025-13-01"]) {
    const state = core.emptyState();
    const result = core.createRm(state, student, command("bad", { date: raw }));
    assertFailure(state, result, raw === "" ? "La fecha es obligatoria." : "La fecha no es valida.");
  }
});

test("IDs are unique, repeated exercise/date is allowed, deletes are physical, and deleted IDs can be reused", () => {
  const { core, student } = setup();
  let state = core.createRm(core.emptyState(), student, command("one")).state;
  assertFailure(state, core.createRm(state, student, command("one", { exercise: "Other" })), "No autorizado.");
  const repeated = core.createRm(state, student, command("two"));
  assert.equal(repeated.result.success, true);
  state = repeated.state;
  const deleted = core.deleteRm(state, student, "one");
  assert.equal(deleted.result.success, true);
  assert.deepEqual(deleted.state.rms.map((entry) => entry.id), ["two"]);
  assert.equal(core.createRm(deleted.state, student, command("one")).result.success, true);
});

test("projections are own-only, date-descending with stable ties, and detached RmsView Date DTOs", () => {
  const { core, student } = setup();
  const state = core.resetState({
    version: 1, namespace: core.namespace, kind: "GYM",
    rms: [row("tie-first", "student", "2025-05-10"), row("old", "student", "2025-05-09"), row("tie-second", "student", "2025-05-10"), row("other", "admin", "2099-01-01")],
  });
  const projected = assertProjectionSuccess(core.projectRms(state, student));
  assert.deepEqual(projected.map((entry) => entry.id), ["tie-first", "tie-second", "old"]);
  assert.ok(projected.every((entry) => entry.date instanceof Date && entry.createdAt instanceof Date));
  projected[0].date.setUTCFullYear(1900);
  projected[0].exercise = "mutated";
  const fresh = assertProjectionSuccess(core.projectRms(state, student));
  assert.equal(fresh[0].date.toISOString(), "2025-05-10T00:00:00.000Z");
  assert.equal(fresh[0].exercise, "Squat");
});

test("closed state and commands reject symbols, accessors, prototypes, sparse or keyed arrays, duplicate IDs, foreign owners, bad dates, and nonfinite values", () => {
  const { core, student } = setup();
  const clean = core.emptyState();
  const accessor = Object.defineProperty({}, "id", { enumerable: true, get() { throw new Error("must not run"); } });
  const symbolCommand = command("symbol");
  symbolCommand[Symbol("extra")] = true;
  for (const bad of [null, [], { ...command("extra"), extra: true }, accessor, symbolCommand]) assertFailure(clean, core.createRm(clean, student, bad), "No autorizado.");
  const cases = [];
  const duplicate = { version: 1, namespace: core.namespace, kind: "GYM", rms: [row("same", "student"), row("same", "student")] };
  const foreign = { version: 1, namespace: core.namespace, kind: "GYM", rms: [row("foreign", "not-registered")] };
  const invalidWeight = { version: 1, namespace: core.namespace, kind: "GYM", rms: [{ ...row("weight", "student"), weight: Infinity }] };
  const invalidDate = { version: 1, namespace: core.namespace, kind: "GYM", rms: [row("date", "student", "not-a-date")] };
  const proto = Object.create({ version: 1, namespace: core.namespace, kind: "GYM", rms: [] });
  const sparseRows = new Array(1);
  const sparse = { version: 1, namespace: core.namespace, kind: "GYM", rms: sparseRows };
  const keyedRows = [row("keyed", "student")]; keyedRows.extra = true;
  const keyed = { version: 1, namespace: core.namespace, kind: "GYM", rms: keyedRows };
  cases.push(duplicate, foreign, invalidWeight, invalidDate, proto, sparse, keyed, { version: 1, namespace: "demo-box-rms/v1", kind: "BOX", rms: [] });
  for (const candidate of cases) {
    assert.equal(core.isValidState(candidate), false);
    assertFailure(candidate, core.createRm(candidate, student, command("safe")), "El estado de PRs no es valido.");
  }
});

test("closed records require enumerable data fields and closed arrays require enumerable indices without invoking hooks", () => {
  const { core, student } = setup();
  const clean = core.emptyState();
  const nonEnumerableCommand = command("command-hidden");
  Object.defineProperty(nonEnumerableCommand, "weight", { enumerable: false, value: "80" });
  assertFailure(clean, core.createRm(clean, student, nonEnumerableCommand), "No autorizado.");

  const state = core.emptyState();
  Object.defineProperty(state, "namespace", { enumerable: false, value: core.namespace });
  assert.equal(core.isValidState(state), false);
  assertFailure(state, core.createRm(state, student, command("state-hidden")), "El estado de PRs no es valido.");

  const rowHidden = row("row-hidden", "student");
  Object.defineProperty(rowHidden, "weight", { enumerable: false, value: 100 });
  const rowState = { version: 1, namespace: core.namespace, kind: "GYM", rms: [rowHidden] };
  assert.equal(core.isValidState(rowState), false);
  assertFailure(rowState, core.createRm(rowState, student, command("row-next")), "El estado de PRs no es valido.");

  const indexedRows = [row("index-hidden", "student")];
  Object.defineProperty(indexedRows, "0", { enumerable: false, value: indexedRows[0] });
  const indexState = { version: 1, namespace: core.namespace, kind: "GYM", rms: indexedRows };
  assert.equal(core.isValidState(indexState), false);
  assertFailure(indexState, core.createRm(indexState, student, command("index-next")), "El estado de PRs no es valido.");

  let hooks = 0;
  const hooked = { ...core.emptyState() };
  Object.defineProperty(hooked, "toJSON", { enumerable: false, value() { hooks += 1; return {}; } });
  assert.equal(core.isValidState(hooked), false);
  assert.equal(hooks, 0);
});

test("scoped reflection guards reject revoked and trapping nested ledgers without executing getters or throwing", () => {
  const { core, student } = setup();
  const candidates = [];
  const revoked = Proxy.revocable([], {}); revoked.revoke();
  candidates.push({ ...core.emptyState(), rms: revoked.proxy });
  candidates.push({ ...core.emptyState(), rms: new Proxy([], { getPrototypeOf() { throw new Error("prototype trap"); } }) });
  candidates.push({ ...core.emptyState(), rms: new Proxy([], { ownKeys() { throw new Error("keys trap"); } }) });
  candidates.push({ ...core.emptyState(), rms: new Proxy([], { getOwnPropertyDescriptor() { throw new Error("descriptor trap"); } }) });
  for (const candidate of candidates) {
    assert.doesNotThrow(() => core.isValidState(candidate));
    assert.equal(core.isValidState(candidate), false);
    assert.doesNotThrow(() => core.createRm(candidate, student, command("safe")));
    assertFailure(candidate, core.createRm(candidate, student, command("safe")), "El estado de PRs no es valido.");
  }
});

test("projection is a discriminated authorization and ledger-validation result", () => {
  const { core, student } = setup();
  let reads = 0;
  const poison = Object.defineProperty({}, "rms", { get() { reads += 1; throw new Error("state read"); } });
  assertProjectionFailure(core.projectRms(poison, { id: "student" }), "No autorizado.");
  assert.equal(reads, 0);

  const corrupt = { ...core.emptyState(), rms: [{ ...row("bad", "student"), weight: Infinity }] };
  for (const transition of [
    core.createRm(corrupt, student, command("new")),
    core.updateRm(corrupt, student, command("bad")),
    core.deleteRm(corrupt, student, "bad"),
  ]) assertFailure(corrupt, transition, "El estado de PRs no es valido.");
  assertProjectionFailure(core.projectRms(corrupt, student), "El estado de PRs no es valido.");
  assert.deepEqual(assertProjectionSuccess(core.projectRms(core.emptyState(), student)), []);
});

test("reset is pure, validates scoped fixtures, and source has no runtime action, provider, storage, or UI coupling", async () => {
  const { core } = setup();
  const reset = core.resetState();
  assert.deepEqual(reset, core.emptyState());
  assert.notEqual(reset, core.emptyState());
  assert.equal(core.resetState({ version: 1, namespace: "demo-personal-rms/v1", kind: "PERSONAL", rms: [] }), null);
  const source = await readFile(path.join(projectRoot, "src/components/demo/training/demo-rm-core.ts"), "utf8");
  assert.doesNotMatch(source, /@\/actions|RmsClient|DemoTrainingProvider|localStorage|sessionStorage|Date\.now/);
});
