import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createTrainingCallbackFactory } from "./training-demo-adapters.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createTrainingDemoFixture } from "./training-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createTrainingRm, deleteTrainingRm, projectTrainingViews, resetTrainingDemoState, selectTrainingDemoActor, updateTrainingRm } from "./training-demo-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { isValidTrainingDemoState, restoreTrainingDemoState, serializeTrainingDemoState } from "./training-demo-storage.ts";

const projectRoot = fileURLToPath(new URL("../../../../", import.meta.url));

function asActor(state, actorId) {
  const selected = selectTrainingDemoActor(state, actorId);
  assert.equal(selected.result.success, true);
  return selected.state;
}

function formData(entries) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

test("student and teacher RMs are own-only, date-descending, and hard-deleted", () => {
  let student = asActor(createTrainingDemoFixture(), "s1");
  assert.deepEqual(projectTrainingViews(student).rms.map((rm) => rm.id), ["rm-s1-1"]);

  const studentCreated = createTrainingRm(student, "rm-s1-2", "  Clean & Jerk  ", 95, "2025-04-12", "2025-04-12T10:00:00.000Z");
  assert.deepEqual(studentCreated.result, { success: true });
  student = studentCreated.state;
  assert.deepEqual(projectTrainingViews(student).rms.map((rm) => rm.id), ["rm-s1-2", "rm-s1-1"]);
  assert.equal(projectTrainingViews(student).rms[0].exercise, "Clean & Jerk");
  assert.ok(projectTrainingViews(student).rms.every((rm) => rm.date instanceof Date && rm.createdAt instanceof Date));

  const updated = updateTrainingRm(student, "rm-s1-2", "Clean", 100, "2025-04-13");
  assert.deepEqual(updated.result, { success: true });
  assert.equal(projectTrainingViews(updated.state).rms[0].weight, 100);

  const teacher = asActor(updated.state, "t1");
  assert.deepEqual(projectTrainingViews(teacher).rms.map((rm) => rm.id), ["rm-t1-1"]);
  const teacherCreated = createTrainingRm(teacher, "rm-t1-2", "Press", 60, "2025-04-15", "2025-04-15T10:00:00.000Z");
  assert.deepEqual(teacherCreated.result, { success: true });
  assert.deepEqual(projectTrainingViews(teacherCreated.state).rms.map((rm) => rm.id), ["rm-t1-2", "rm-t1-1"]);

  const deleted = deleteTrainingRm(teacherCreated.state, "rm-t1-2");
  assert.deepEqual(deleted.result, { success: true });
  assert.equal(deleted.state.rms.some((rm) => rm.id === "rm-t1-2"), false);
});

test("foreign, missing, malformed, non-finite, and invalid-date RM commands never mutate", () => {
  const student = asActor(createTrainingDemoFixture(), "s1");
  for (const rejected of [
    updateTrainingRm(student, "rm-t1-1", "Deadlift", 160, "2025-04-10"),
    deleteTrainingRm(student, "rm-t1-1"),
    updateTrainingRm(student, "missing", "Deadlift", 160, "2025-04-10"),
    createTrainingRm(student, "bad-1", null, 10, "2025-04-10", "2025-04-10T10:00:00.000Z"),
    createTrainingRm(student, "bad-2", "Squat", "100", "2025-04-10", "2025-04-10T10:00:00.000Z"),
    createTrainingRm(student, "bad-3", "Squat", Number.POSITIVE_INFINITY, "2025-04-10", "2025-04-10T10:00:00.000Z"),
    createTrainingRm(student, "bad-4", "Squat", 0, "2025-04-10", "2025-04-10T10:00:00.000Z"),
    createTrainingRm(student, "bad-5", "Squat", 100, "2025-02-30", "2025-04-10T10:00:00.000Z"),
    createTrainingRm(student, "bad-6", "Squat", 100, "2025-04-10", "not-an-instant"),
  ]) {
    assert.equal(rejected.result.success, false);
    assert.equal(rejected.state, student);
  }
});

test("FormData adapters reject files and non-string values, commit valid own CRUD, and retain latest state", async () => {
  let current = asActor(createTrainingDemoFixture(), "s1");
  let commits = 0;
  const callbacks = createTrainingCallbackFactory({
    getState: () => current,
    commit: (next) => { current = next; commits += 1; },
    now: () => new Date("2025-04-20T10:00:00.000Z"),
  });
  const fileData = new FormData();
  fileData.set("exercise", new Blob(["not text"]), "exercise.txt");
  fileData.set("weight", "100");
  fileData.set("date", "2025-04-20");
  assert.equal((await callbacks.rm.createRm(fileData)).success, false);
  assert.equal(commits, 0);

  assert.deepEqual(await callbacks.rm.createRm(formData({ exercise: "Front Squat", weight: "100", date: "2025-04-20" })), { success: true });
  const created = current.rms.find((rm) => rm.id === "rm-local-1");
  assert.deepEqual(created, {
    id: "rm-local-1",
    exercise: "Front Squat",
    weight: 100,
    date: "2025-04-20",
    createdAt: "2025-04-20T10:00:00.000Z",
    ownerId: "s1",
  });
  const beforeRejectedUpdate = current;
  assert.equal((await callbacks.rm.updateRm("rm-local-1", formData({ exercise: "Front Squat", weight: "100", date: "2025-02-30" }))).success, false);
  assert.equal(current, beforeRejectedUpdate);
  assert.equal((await callbacks.rm.deleteRm("rm-t1-1")).success, false);
  assert.equal(current, beforeRejectedUpdate);
  assert.deepEqual(await callbacks.rm.updateRm("rm-local-1", formData({ exercise: "Front Squat", weight: "105", date: "2025-04-21" })), { success: true });
  assert.deepEqual(await callbacks.rm.deleteRm("rm-local-1"), { success: true });
  assert.equal(commits, 3);
});

test("RM CRUD state reloads exactly, reset returns fixtures, and malformed payloads are rejected", () => {
  const fixture = createTrainingDemoFixture();
  const created = createTrainingRm(asActor(fixture, "s1"), "rm-reload", "Thruster", 80, "2025-04-22", "2025-04-22T10:00:00.000Z");
  assert.equal(created.result.success, true);
  const serialized = serializeTrainingDemoState(created.state);
  assert.deepEqual(restoreTrainingDemoState(serialized), created.state);
  assert.deepEqual(resetTrainingDemoState(), fixture);
  assert.equal(isValidTrainingDemoState(fixture), true);

  const duplicate = structuredClone(fixture);
  duplicate.rms.push(structuredClone(duplicate.rms[0]));
  const foreignOwner = structuredClone(fixture);
  foreignOwner.rms[0].ownerId = "not-an-actor";
  const malformedWeight = structuredClone(fixture);
  malformedWeight.rms[0].weight = Number.NaN;
  const invalidDate = structuredClone(fixture);
  invalidDate.rms[0].date = "2025-02-30";
  const oldSchema = structuredClone(fixture);
  oldSchema.version = 1;
  for (const candidate of [duplicate, foreignOwner, malformedWeight, invalidDate, oldSchema]) {
    assert.equal(isValidTrainingDemoState(candidate), false);
    assert.deepEqual(restoreTrainingDemoState(JSON.stringify(candidate)), fixture);
  }
});

test("shared RM view retains percentage source calculation and click-only share wiring", async () => {
  const [view, share] = await Promise.all([
    readFile(path.join(projectRoot, "src/components/RmsView.tsx"), "utf8"),
    readFile(path.join(projectRoot, "src/components/ShareRmButton.tsx"), "utf8"),
  ]);
  assert.match(view, /const value = Math\.round\(rm\.weight \* pct\) \/ 100;/);
  assert.match(view, /<ShareRmButton[\s\S]*weight=\{rm\.weight\}/);
  assert.match(share, /onClick=\{handleShare\}/);
  assert.doesNotMatch(share, /useEffect|createRm|updateRm|deleteRm|@\/actions\//);
});
