import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  MANAGEMENT_DEMO_STORAGE_KEY,
  activeDemoActor,
  demoStudents,
  demoTeachers,
  rowsRevision,
  toManagementActivityInput,
  visibleManagementActivityIds,
} from "./demo-view-adapters.ts";
import { createManagementDemoState } from "./management-demo-state.ts";

const anchor = "2030-06-03";

function withActor(state, activeActorId) {
  return { ...state, activeActorId };
}

test("view adapters select fixture identities and preserve the dialog's omitted teacher", () => {
  const state = createManagementDemoState(anchor);
  assert.equal(activeDemoActor(state).role, "ADMIN");
  assert.deepEqual(demoStudents(state).map((student) => student.accountKind), ["FULL", "LITE", "FULL", "FULL"]);
  assert.equal(demoTeachers(state).length, 2);
  assert.equal(
    toManagementActivityInput(
      {
        name: "Fuerza",
        description: null,
        scheduleKind: "WEEKLY",
        allowsRecurring: true,
        cancelWindowHours: 4,
        capacity: 3,
        startsOn: "2030-06-05",
        endsOn: null,
      },
      state.activities[0],
    ).teacherId,
    "teacher-demo",
  );
  assert.equal(MANAGEMENT_DEMO_STORAGE_KEY.endsWith("-v2"), true);
});

test("management visibility is role-scoped before UI rendering", () => {
  const state = createManagementDemoState(anchor);
  assert.equal(visibleManagementActivityIds(state).size, state.activities.length);
  const teacher = visibleManagementActivityIds(withActor(state, "teacher-demo"));
  assert.deepEqual([...teacher], ["activity-strength"]);
  assert.equal(visibleManagementActivityIds(withActor(state, "student-full")).size, 0);
  assert.equal(rowsRevision([{ bookingId: "booking-1" }, { enrollmentId: "enrollment-1" }]), "booking-1|enrollment-1");
});

test("demo shell and local navigation graph contain no operational boundary imports", async () => {
  const root = new URL("../../", import.meta.url);
  const source = (path) => readFile(new URL(path, root), "utf8");
  const [shell, management, listView, sessionView] = await Promise.all([
    source("demo/turnos/BoxBookingDemo.tsx"),
    source("demo/turnos/BoxManagementDemo.tsx"),
    source("activity/views/ActivityListView.tsx"),
    source("activity/views/ActivitySessionListView.tsx"),
  ]);
  for (const value of [shell, management]) {
    assert.doesNotMatch(value, /@\/actions|@prisma|@\/lib\/auth|next\/cache|next\/navigation/);
  }
  assert.match(shell, /restoreManagementDemoState/);
  assert.match(shell, /serializeManagementDemoState/);
  assert.match(shell, /stateRef\.current/);
  assert.match(shell, /type: "student-enroll"/);
  assert.match(management, /type: "manual-book"/);
  assert.match(management, /type: "delete-activity"/);
  assert.match(listView, /onNavigate\?:/);
  assert.match(sessionView, /onNavigate\?:/);
  assert.match(listView, /event\.preventDefault\(\)/);
  assert.match(sessionView, /event\.preventDefault\(\)/);
  assert.match(listView, /notificationMode = "live"/);
  assert.match(listView, /van a ser notificados/);
  assert.match(listView, /En esta demo no se envían notificaciones/);
  assert.match(management, /notificationMode="simulated"/);
});
