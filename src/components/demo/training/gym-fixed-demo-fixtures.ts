// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { GYM_DEMO_GYM_ID, getGymDemoProfiles, getGymDemoTeacherStudentLinks } from "../scenarios/gym-demo-directory.ts";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { createGymTrainingDemoFixture } from "./gym-training-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { GYM_FIXED_DEMO_NAMESPACE, GYM_FIXED_DEMO_VERSION } from "./gym-fixed-demo-types.ts";
import type {
  GymFixedDemoGroup,
  GymFixedDemoGroupMembership,
  GymFixedDemoRosterRecord,
  GymFixedDemoState,
  GymFixedDemoTeacherStudentLink,
} from "./gym-fixed-demo-types";

/** Compatibility alias: fixed routines and the canonical GYM directory share one tenant ID. */
export const GYM_FIXED_DEMO_GYM_ID = GYM_DEMO_GYM_ID;

/**
 * Compatibility display fixture only. Canonical directory profiles are the
 * sole identity, link, and token authority; these fresh copies cannot grant a
 * capability or add a foreign profile.
 */
export function getGymFixedDemoRoster(): GymFixedDemoRosterRecord[] {
  return getGymDemoProfiles().map((profile) => ({
    id: profile.id,
    gymId: profile.gymId,
    name: profile.name,
    role: profile.role,
    studentType: profile.studentType,
    accountKind: profile.accountKind,
    deletedAt: profile.deletedAt,
  }));
}

/** Compatibility display rows derived from the canonical GYM directory. */
export function getGymFixedDemoTeacherStudentLinks(): GymFixedDemoTeacherStudentLink[] {
  return getGymDemoTeacherStudentLinks().map((link) => ({ ...link }));
}

/**
 * Test-only historical projection of the INITIAL dated GYM fixture. It is not
 * an authority source: current group checks must use supplied training state.
 */
export function getGymFixedDemoGroups(): GymFixedDemoGroup[] {
  return createGymTrainingDemoFixture().groups.map((group) => ({ ...group }));
}

/** Test-only INITIAL dated-fixture projection; never use for runtime eligibility. */
export function getGymFixedDemoGroupMemberships(): GymFixedDemoGroupMembership[] {
  return createGymTrainingDemoFixture().memberships.map((membership) => ({ ...membership }));
}

/** A deterministic isolated fixed-routine ledger; canonical identity and groups are external context. */
export function createGymFixedDemoFixture(): GymFixedDemoState {
  return {
    version: GYM_FIXED_DEMO_VERSION,
    namespace: GYM_FIXED_DEMO_NAMESPACE,
    fixedRoutines: [
      {
        id: "gym-fixed-history", gymId: GYM_FIXED_DEMO_GYM_ID, studentId: "gym-fixed-student-muslib", teacherId: "gym-fixed-teacher-linked",
        title: "Base inicial", content: "Movilidad y técnica.", assignedAt: "2025-04-01T10:00:00.000Z", renewAt: "2025-05-01", deletedAt: null,
      },
      {
        id: "gym-fixed-active", gymId: GYM_FIXED_DEMO_GYM_ID, studentId: "gym-fixed-student-muslib", teacherId: "gym-fixed-teacher-linked",
        title: "Fuerza continua", content: "Sentadilla y press.", assignedAt: "2025-05-01T10:00:00.000Z", renewAt: "2025-05-30", deletedAt: null,
      },
      {
        id: "gym-fixed-deleted", gymId: GYM_FIXED_DEMO_GYM_ID, studentId: "gym-fixed-student-muslib", teacherId: "gym-fixed-teacher-unlinked",
        title: "Rutina retirada", content: "No debe proyectarse.", assignedAt: "2025-05-02T10:00:00.000Z", renewAt: "2025-05-31", deletedAt: "2025-05-03T10:00:00.000Z",
      },
      {
        id: "gym-fixed-other-teacher", gymId: GYM_FIXED_DEMO_GYM_ID, studentId: "gym-fixed-student-personalized", teacherId: "gym-fixed-teacher-unlinked",
        title: "Seguimiento individual", content: "Trabajo controlado.", assignedAt: "2025-05-04T10:00:00.000Z", renewAt: "2025-06-03", deletedAt: null,
      },
    ],
  };
}
