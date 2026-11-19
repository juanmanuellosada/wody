import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createPersonalTrainingDemoFixture } from "./personal-training-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import {
  copyPersonalTrainingWod,
  copyPersonalTrainingWodToDates,
  createPersonalTrainingWod,
  deletePersonalTrainingWod,
  getPersonalTrainingActorToken,
  isValidPersonalTrainingDemoState,
  parsePersonalTrainingDate,
  projectPersonalTrainingWods,
  resetPersonalTrainingDemoState,
  updatePersonalTrainingWod,
} from "./personal-training-demo-state.ts";

const owner = () => getPersonalTrainingActorToken();
const lockedTarget = () => ({ type: "STUDENT", studentId: "personal-student-owner" });
const now = () => new Date("2025-05-11T14:30:00.000Z");

function createCommand(id, extra = {}) {
  return { id, date: "2025-05-12", title: "  Tren inferior  ", content: "  4 x 8  ", target: lockedTarget(), ...extra };
}

function rejected(initial, transition) {
  assert.equal(transition.result.success, false);
  assert.equal(transition.state, initial);
}

test("PERSONAL own-routine create/update/delete follows the mounted WodManager callback shapes", () => {
  const initial = createPersonalTrainingDemoFixture();
  const created = createPersonalTrainingWod(initial, owner(), createCommand("personal-wod-created"));
  assert.deepEqual(created.result, { success: true, wodId: "personal-wod-created" });
  assert.deepEqual(created.state.wods.at(-1), {
    id: "personal-wod-created",
    title: "Tren inferior",
    content: "  4 x 8  ",
    date: "2025-05-12",
    teacherId: "personal-student-owner",
    targetType: "STUDENT",
    targetGroupId: null,
    targetStudentId: "personal-student-owner",
    deletedAt: null,
  });

  const updated = updatePersonalTrainingWod(created.state, owner(), {
    wodId: "personal-wod-created", title: "", content: "  Sin recortar  ", date: "", target: lockedTarget(),
  });
  assert.deepEqual(updated.result, { success: true });
  assert.deepEqual(updated.state.wods.at(-1), { ...created.state.wods.at(-1), title: "Rutina", content: "  Sin recortar  " });

  let clockReads = 0;
  const deleted = deletePersonalTrainingWod(updated.state, owner(), { wodId: "personal-wod-created" }, () => {
    clockReads += 1;
    return now();
  });
  assert.deepEqual(deleted.result, { success: true });
  assert.equal(clockReads, 1);
  assert.equal(deleted.state.wods.at(-1).deletedAt, "2025-05-11T14:30:00.000Z");
  rejected(deleted.state, updatePersonalTrainingWod(deleted.state, owner(), {
    wodId: "personal-wod-created", title: "x", content: "x",
  }));
});

test("single and atomic multi-date copy preserve source fields, permit duplicate dates, and never partially allocate IDs", () => {
  const initial = createPersonalTrainingDemoFixture();
  const single = copyPersonalTrainingWod(initial, owner(), {
    id: "personal-wod-copy-one", sourceWodId: "personal-wod-current", targetDate: "2025-02-30", target: lockedTarget(),
  });
  assert.deepEqual(single.result, { success: true, wodId: "personal-wod-copy-one" });
  assert.equal(single.state.wods.at(-1).date, "2025-03-02");

  const batch = copyPersonalTrainingWodToDates(single.state, owner(), {
    sourceWodId: "personal-wod-current",
    ids: ["personal-wod-copy-a", "personal-wod-copy-b"],
    targetDates: ["2025-05-15", "2025-05-15"],
  });
  assert.deepEqual(batch.result, { success: true, count: 2, wodIds: ["personal-wod-copy-a", "personal-wod-copy-b"] });
  assert.deepEqual(batch.state.wods.slice(-2).map((wod) => [wod.date, wod.title, wod.content, wod.teacherId, wod.targetStudentId]), [
    ["2025-05-15", "Rutina actual", "Movilidad y fuerza controlada.", "personal-student-owner", "personal-student-owner"],
    ["2025-05-15", "Rutina actual", "Movilidad y fuerza controlada.", "personal-student-owner", "personal-student-owner"],
  ]);

  for (const command of [
    { sourceWodId: "personal-wod-current", ids: ["personal-wod-duplicate", "personal-wod-duplicate"], targetDates: ["2025-05-16", "2025-05-17"] },
    { sourceWodId: "personal-wod-current", ids: ["personal-wod-current"], targetDates: ["2025-05-16"] },
    { sourceWodId: "personal-wod-current", ids: ["personal-wod-a", "personal-wod-b"], targetDates: ["2025-05-16"] },
    { sourceWodId: "personal-wod-current", ids: ["personal-wod-a"], targetDates: ["not-a-date"] },
  ]) rejected(initial, copyPersonalTrainingWodToDates(initial, owner(), command));

  const deletedSource = deletePersonalTrainingWod(initial, owner(), { wodId: "personal-wod-current" }, now).state;
  rejected(deletedSource, copyPersonalTrainingWod(deletedSource, owner(), {
    id: "personal-wod-never", sourceWodId: "personal-wod-current", targetDate: "2025-05-16",
  }));
});

test("canonical PERSONAL identity and frozen capability deny forged, foreign, disabled, revoked, and mutated actor inputs before state, IDs, or clocks", () => {
  const token = owner();
  assert.equal(Object.isFrozen(token), true);
  const initial = createPersonalTrainingDemoFixture();
  let reads = 0;
  const hostileState = Object.defineProperty({}, "wods", { enumerable: true, get() { reads += 1; throw new Error("must not read"); } });
  const foreign = Proxy.revocable({}, {}).proxy;
  const actors = [
    { id: "personal-student-owner", role: "STUDENT", canCreateOwnRoutines: true },
    { id: "personal-student-owner", role: "STUDENT", canCreateOwnRoutines: false },
    { id: "box-student", role: "STUDENT", canCreateOwnRoutines: true },
    Object.create({ id: "personal-student-owner" }),
    foreign,
  ];
  for (const actor of actors) {
    rejected(hostileState, createPersonalTrainingWod(hostileState, actor, Object.defineProperty({}, "id", {
      enumerable: true, get() { throw new Error("must not read command"); },
    })));
    assert.equal(projectPersonalTrainingWods(hostileState, actor), null);
  }
  assert.equal(reads, 0);
  rejected(initial, createPersonalTrainingWod(initial, Object.freeze({ ...token }), createCommand("personal-wod-forged")));
  assert.equal(deletePersonalTrainingWod(initial, { id: "x" }, { wodId: "personal-wod-current" }, () => { throw new Error("must not read clock"); }).state, initial);
});

test("the locked self target rejects every retarget, account role, group, and foreign-student path", () => {
  const initial = createPersonalTrainingDemoFixture();
  const badTargets = [
    { type: "ALL" }, { type: "PERSONALIZED" }, { type: "GROUP", groupId: "g1" },
    { type: "MUSCULACION_LIBRE", studentId: "personal-student-owner" },
    { type: "STUDENT", studentId: "box-student" }, { type: "STUDENT", studentId: "personal-student-owner", extra: true },
  ];
  for (const target of badTargets) {
    rejected(initial, createPersonalTrainingWod(initial, owner(), createCommand("personal-wod-bad", { target })));
    rejected(initial, updatePersonalTrainingWod(initial, owner(), {
      wodId: "personal-wod-current", title: "x", content: "x", target,
    }));
    rejected(initial, copyPersonalTrainingWod(initial, owner(), {
      id: "personal-wod-bad", sourceWodId: "personal-wod-current", targetDate: "2025-05-12", target,
    }));
  }
  assert.equal(createPersonalTrainingWod(initial, owner(), createCommand("personal-wod-default", { target: lockedTarget() })).result.success, true);
});

test("closed runtime data rejects getters, symbols, prototypes, sparse arrays, foreign namespaces, aliases, and deleted-ID collisions", () => {
  const initial = createPersonalTrainingDemoFixture();
  const symbolCommand = createCommand("personal-wod-symbol");
  symbolCommand[Symbol("unexpected")] = true;
  const getterCommand = Object.defineProperty({}, "id", { enumerable: true, get() { throw new Error("no getter"); } });
  for (const command of [
    null, [], { ...createCommand("personal-wod-extra"), extra: true }, symbolCommand, getterCommand,
    createCommand("box-wod-foreign"), createCommand("personal-wod-deleted"),
    createCommand("personal-wod-empty-content", { content: "  " }),
  ]) rejected(initial, createPersonalTrainingWod(initial, owner(), command));

  const sparse = new Array(1);
  rejected(initial, copyPersonalTrainingWodToDates(initial, owner(), {
    sourceWodId: "personal-wod-current", ids: sparse, targetDates: ["2025-05-12"],
  }));
  const badStates = [
    { ...initial, namespace: "demo-box-training" },
    { ...initial, version: 2 },
    { ...initial, wods: [...initial.wods, { ...initial.wods[0] }] },
    { ...initial, wods: [{ ...initial.wods[0], teacherId: "box-teacher" }] },
    Object.create(initial),
  ];
  for (const state of badStates) {
    assert.equal(isValidPersonalTrainingDemoState(state), false);
    rejected(state, createPersonalTrainingWod(state, owner(), createCommand("personal-wod-never")));
  }
});

test("action-style date parsing normalizes valid overflow but rejects invalid values and preserves low years", () => {
  assert.equal(parsePersonalTrainingDate("2025-02-29"), "2025-03-01");
  assert.equal(parsePersonalTrainingDate("2025-02-30"), "2025-03-02");
  assert.equal(parsePersonalTrainingDate("0000-01-01"), "0000-01-01");
  assert.equal(parsePersonalTrainingDate("0001-01-01"), "0001-01-01");
  assert.equal(parsePersonalTrainingDate("0099-12-31"), "0099-12-31");
  for (const value of ["", "2025-13-01", "2025-00-01", "not-a-date", "2025-1-01", null]) assert.equal(parsePersonalTrainingDate(value), null);

  const initial = createPersonalTrainingDemoFixture();
  rejected(initial, updatePersonalTrainingWod(initial, owner(), {
    wodId: "personal-wod-current", title: "x", content: "x", date: "2025-13-01",
  }));
  const overflow = updatePersonalTrainingWod(initial, owner(), {
    wodId: "personal-wod-current", title: "x", content: "x", date: "2025-02-30",
  });
  assert.equal(overflow.state.wods[0].date, "2025-03-02");
});

test("Mis rutinas projection is own-only, active-only, date DESC with stable ties, and returns detached Date DTOs", () => {
  const initial = createPersonalTrainingDemoFixture();
  const tied = {
    ...initial,
    wods: [
      ...initial.wods,
      { ...initial.wods[0], id: "personal-wod-tie-first", title: "Tie first", date: "2025-05-20" },
      { ...initial.wods[0], id: "personal-wod-tie-second", title: "Tie second", date: "2025-05-20" },
    ],
  };
  const rows = projectPersonalTrainingWods(tied, owner());
  assert.deepEqual(rows.map((row) => row.id), ["personal-wod-tie-first", "personal-wod-tie-second", "personal-wod-current", "personal-wod-past"]);
  assert.ok(rows.every((row) => row.date instanceof Date && row.targetGroupName === null && row.targetStudentName === null));
  rows[0].title = "mutated";
  rows[0].date.setUTCFullYear(2030);
  const fresh = projectPersonalTrainingWods(tied, owner());
  assert.equal(fresh[0].title, "Tie first");
  assert.equal(fresh[0].date.toISOString(), "2025-05-20T00:00:00.000Z");
  assert.equal(projectPersonalTrainingWods(tied, { id: "personal-student-owner" }), null);
});

test("reset recreates an isolated deterministic PERSONAL ledger, including an empty valid ledger case", () => {
  const empty = { version: 1, namespace: "demo-personal-training/v1", wods: [] };
  assert.equal(isValidPersonalTrainingDemoState(empty), true);
  assert.deepEqual(projectPersonalTrainingWods(empty, owner()), []);
  const reset = resetPersonalTrainingDemoState();
  assert.deepEqual(reset, createPersonalTrainingDemoFixture());
  assert.notEqual(reset, createPersonalTrainingDemoFixture());
});
