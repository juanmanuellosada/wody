import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { getPersonalTrainingActorToken } from "../training/personal-training-demo-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { createTrainingDemoFixture } from "../training/training-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import { getGymFixedDemoActorToken } from "../training/gym-fixed-demo-state.ts";
// @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
import {
  GYM_DEMO_ADMIN_ID,
  GYM_DEMO_ARCHIVED_STUDENT_ID,
  GYM_DEMO_FINANCE_ADMIN_IDS,
  GYM_DEMO_GENERAL_STUDENT_ID,
  GYM_DEMO_GYM_ID,
  GYM_DEMO_HISTORICAL_MUSLIB_LITE_STUDENT_ID,
  GYM_DEMO_MUSLIB_STUDENT_ID,
  GYM_DEMO_PERSONALIZED_STUDENT_ID,
  GYM_DEMO_PRIMARY_TEACHER_ID,
  GYM_DEMO_UNLINKED_PERSONALIZED_STUDENT_ID,
  getGymDemoActorToken,
  getGymDemoProfile,
  getGymDemoProfiles,
  getGymDemoTeacherStudentLinks,
  resolveGymDemoActor,
} from "./gym-demo-directory.ts";

test("canonical GYM directory has a stable local fixture matrix without ledger fields", () => {
  const profiles = getGymDemoProfiles();
  assert.equal(profiles.length, 9);
  assert.equal(new Set(profiles.map((profile) => profile.id)).size, 9);
  assert.equal(new Set(profiles.map((profile) => profile.memberNumber)).size, 9);
  assert.deepEqual(profiles.map((profile) => profile.memberNumber), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.ok(profiles.every((profile) => profile.gymId === GYM_DEMO_GYM_ID));
  assert.deepEqual(Object.fromEntries(["ADMIN", "TEACHER", "STUDENT"].map((role) => [role, profiles.filter((profile) => profile.role === role).length])), {
    ADMIN: 1,
    TEACHER: 2,
    STUDENT: 6,
  });
  assert.deepEqual(
    profiles.filter((profile) => profile.role === "STUDENT" && profile.accountKind === "FULL" && profile.deletedAt === null)
      .map((profile) => profile.studentType),
    ["GENERAL", "PERSONALIZED", "PERSONALIZED", "MUSCULACION_LIBRE"],
  );
  const lite = getGymDemoProfile(GYM_DEMO_HISTORICAL_MUSLIB_LITE_STUDENT_ID);
  const archived = getGymDemoProfile(GYM_DEMO_ARCHIVED_STUDENT_ID);
  assert.deepEqual({ type: lite?.studentType, kind: lite?.accountKind, deletedAt: lite?.deletedAt }, {
    type: "MUSCULACION_LIBRE", kind: "LITE", deletedAt: null,
  });
  assert.equal(archived?.role, "STUDENT");
  assert.ok(archived?.deletedAt);
  assert.ok(profiles.every((profile) => !Object.hasOwn(profile, "email")));
  assert.ok(profiles.every((profile) => !Object.hasOwn(profile, "paymentExempt") && !Object.hasOwn(profile, "memberBookings")));
  assert.deepEqual(GYM_DEMO_FINANCE_ADMIN_IDS, [GYM_DEMO_ADMIN_ID]);
});

test("display profiles and links detach from authority while links retain valid same-gym roles", () => {
  const profiles = getGymDemoProfiles();
  const links = getGymDemoTeacherStudentLinks();
  assert.notEqual(profiles, getGymDemoProfiles());
  assert.notEqual(links, getGymDemoTeacherStudentLinks());
  for (const link of links) {
    const teacher = getGymDemoProfile(link.teacherId);
    const student = getGymDemoProfile(link.studentId);
    assert.equal(teacher?.gymId, GYM_DEMO_GYM_ID);
    assert.ok(teacher?.role === "ADMIN" || teacher?.role === "TEACHER");
    assert.equal(student?.gymId, GYM_DEMO_GYM_ID);
    assert.equal(student?.role, "STUDENT");
  }
  assert.ok(links.some((link) => link.teacherId === GYM_DEMO_PRIMARY_TEACHER_ID && link.studentId === GYM_DEMO_PERSONALIZED_STUDENT_ID));
  assert.equal(links.some((link) => link.studentId === GYM_DEMO_UNLINKED_PERSONALIZED_STUDENT_ID), false);

  const displayedAdmin = profiles.find((profile) => profile.id === GYM_DEMO_ADMIN_ID);
  displayedAdmin.role = "STUDENT";
  links[0].teacherId = "forged-teacher";
  assert.equal(getGymDemoProfile(GYM_DEMO_ADMIN_ID)?.role, "ADMIN");
  assert.equal(getGymDemoTeacherStudentLinks()[0].teacherId, GYM_DEMO_PRIMARY_TEACHER_ID);

  const canonical = resolveGymDemoActor(getGymDemoActorToken(GYM_DEMO_ADMIN_ID));
  assert.ok(canonical && Object.isFrozen(canonical));
  assert.equal(Reflect.set(canonical, "role", "STUDENT"), false);
  assert.equal(resolveGymDemoActor(getGymDemoActorToken(GYM_DEMO_ADMIN_ID))?.role, "ADMIN");
});

test("opaque tokens are stable only for active FULL profiles and resolve to minimal frozen authority", () => {
  const activeFull = getGymDemoProfiles().filter((profile) => profile.deletedAt === null && profile.accountKind === "FULL");
  assert.equal(activeFull.length, 7);
  for (const profile of activeFull) {
    const token = getGymDemoActorToken(profile.id);
    assert.ok(token);
    assert.equal(token, getGymDemoActorToken(profile.id));
    assert.deepEqual(resolveGymDemoActor(token), {
      id: profile.id,
      gymId: GYM_DEMO_GYM_ID,
      role: profile.role,
      studentType: profile.studentType,
      accountKind: "FULL",
      canCreateOwnRoutines: false,
    });
  }
  assert.equal(getGymDemoActorToken(GYM_DEMO_HISTORICAL_MUSLIB_LITE_STUDENT_ID), null);
  assert.equal(getGymDemoActorToken(GYM_DEMO_ARCHIVED_STUDENT_ID), null);
  assert.equal(resolveGymDemoActor(getGymDemoProfile(GYM_DEMO_ADMIN_ID)), null, "a trusted display projection is not authority");
  assert.equal(resolveGymDemoActor(Object.freeze({ id: GYM_DEMO_ADMIN_ID, role: "ADMIN" })), null, "role payloads are not authority");
  assert.equal(resolveGymDemoActor(Object.freeze({ ...getGymDemoActorToken(GYM_DEMO_ADMIN_ID) })), null, "copied token shape is not authority");
});

test("unknown lookups and resolvers deny coercion, getters, symbols, poison proxies, and revoked proxies without hooks", () => {
  let hooks = 0;
  const getterPayload = Object.defineProperty({}, "id", { enumerable: true, get() { hooks += 1; throw new Error("must not read"); } });
  const poison = new Proxy({}, {
    get() { hooks += 1; throw new Error("must not get"); },
    getPrototypeOf() { hooks += 1; throw new Error("must not inspect"); },
    ownKeys() { hooks += 1; throw new Error("must not enumerate"); },
  });
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  for (const value of ["constructor", "__proto__", getterPayload, Symbol("id"), poison, revoked.proxy]) {
    assert.equal(getGymDemoProfile(value), null);
    assert.equal(getGymDemoActorToken(value), null);
    assert.equal(resolveGymDemoActor(value), null);
  }
  assert.equal(hooks, 0);
});

test("foreign PERSONAL, BOX, and prepared-GYM factory values cannot enter this directory", () => {
  const personalToken = getPersonalTrainingActorToken();
  const boxActor = createTrainingDemoFixture().actors[0];
  const preparedGymValue = getGymFixedDemoActorToken("gym-fixed-admin");
  for (const foreign of [personalToken, boxActor, preparedGymValue, Object.freeze(Object.create(null))]) {
    assert.equal(resolveGymDemoActor(foreign), null);
  }
});

test("directory module has no runtime dependency or browser, storage, action, or database surface", () => {
  const source = readFileSync(new URL("./gym-demo-directory.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /^\s*import\s/m);
  assert.doesNotMatch(source, /(?:@\/|from\s+["'])/);
  assert.doesNotMatch(source, /\b(?:window|document|localStorage|sessionStorage|globalThis|prisma)\b/);
  assert.equal(getGymDemoProfile(GYM_DEMO_GENERAL_STUDENT_ID)?.studentType, "GENERAL");
  assert.equal(getGymDemoProfile(GYM_DEMO_MUSLIB_STUDENT_ID)?.studentType, "MUSCULACION_LIBRE");
});
