// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { createTrainingDemoFixture } from "./training-demo-fixtures.ts";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { GYM_FIXED_DEMO_NAMESPACE, GYM_FIXED_DEMO_VERSION } from "./gym-fixed-demo-types.ts";
import type {
  GymFixedDemoGroup,
  GymFixedDemoGroupMembership,
  GymFixedDemoRosterRecord,
  GymFixedDemoState,
  GymFixedDemoTeacherStudentLink,
} from "./gym-fixed-demo-types";

export const GYM_FIXED_DEMO_GYM_ID = "gym-fixed-gym";
const FOREIGN_GYM_ID = "gym-fixed-foreign-gym";

/**
 * Names are derived from the existing fictional training fixture only; every
 * identifier and authorization boundary below belongs to this GYM namespace.
 */
function derivedNames(): { admin: string; teacher: string; secondTeacher: string; personalized: string; general: string } {
  const actors = createTrainingDemoFixture().actors;
  const nameFor = (id: string) => actors.find((actor) => actor.id === id)?.name ?? id;
  return {
    admin: nameFor("a1"),
    teacher: nameFor("t1"),
    secondTeacher: nameFor("t2"),
    personalized: nameFor("s1"),
    general: nameFor("s2"),
  };
}

/**
 * Fixture directory data is separate from the persisted ledger. State captures
 * routines only; a future provider can replace this read-only context with live
 * group/link queries without importing finance, access, or BOX state.
 */
export function getGymFixedDemoRoster(): GymFixedDemoRosterRecord[] {
  const names = derivedNames();
  return [
    { id: "gym-fixed-admin", gymId: GYM_FIXED_DEMO_GYM_ID, name: names.admin, role: "ADMIN", studentType: null, accountKind: "FULL", deletedAt: null },
    { id: "gym-fixed-teacher-linked", gymId: GYM_FIXED_DEMO_GYM_ID, name: names.teacher, role: "TEACHER", studentType: null, accountKind: "FULL", deletedAt: null },
    { id: "gym-fixed-teacher-unlinked", gymId: GYM_FIXED_DEMO_GYM_ID, name: names.secondTeacher, role: "TEACHER", studentType: null, accountKind: "FULL", deletedAt: null },
    { id: "gym-fixed-student-general", gymId: GYM_FIXED_DEMO_GYM_ID, name: names.general, role: "STUDENT", studentType: "GENERAL", accountKind: "FULL", deletedAt: null },
    { id: "gym-fixed-student-personalized", gymId: GYM_FIXED_DEMO_GYM_ID, name: names.personalized, role: "STUDENT", studentType: "PERSONALIZED", accountKind: "FULL", deletedAt: null },
    { id: "gym-fixed-student-muslib", gymId: GYM_FIXED_DEMO_GYM_ID, name: "Mica Musculación", role: "STUDENT", studentType: "MUSCULACION_LIBRE", accountKind: "FULL", deletedAt: null },
    { id: "gym-fixed-student-muslib-lite", gymId: GYM_FIXED_DEMO_GYM_ID, name: "Leo Lite", role: "STUDENT", studentType: "MUSCULACION_LIBRE", accountKind: "LITE", deletedAt: null },
    { id: "gym-fixed-student-muslib-archived", gymId: GYM_FIXED_DEMO_GYM_ID, name: "Ana Archivada", role: "STUDENT", studentType: "MUSCULACION_LIBRE", accountKind: "FULL", deletedAt: "2025-04-01T00:00:00.000Z" },
    { id: "gym-fixed-foreign-teacher", gymId: FOREIGN_GYM_ID, name: "Profe Ajena", role: "TEACHER", studentType: null, accountKind: "FULL", deletedAt: null },
    { id: "gym-fixed-foreign-student", gymId: FOREIGN_GYM_ID, name: "Alumno Ajeno", role: "STUDENT", studentType: "MUSCULACION_LIBRE", accountKind: "FULL", deletedAt: null },
  ];
}

export function getGymFixedDemoTeacherStudentLinks(): GymFixedDemoTeacherStudentLink[] {
  return [
    { teacherId: "gym-fixed-teacher-linked", studentId: "gym-fixed-student-general" },
    { teacherId: "gym-fixed-teacher-linked", studentId: "gym-fixed-student-personalized" },
    { teacherId: "gym-fixed-teacher-linked", studentId: "gym-fixed-student-muslib" },
    { teacherId: "gym-fixed-teacher-linked", studentId: "gym-fixed-student-muslib-lite" },
  ];
}

export function getGymFixedDemoGroups(): GymFixedDemoGroup[] {
  return [
    { id: "gym-fixed-group-linked", teacherId: "gym-fixed-teacher-linked", name: "Musculación mañana", deletedAt: null },
    { id: "gym-fixed-group-unlinked", teacherId: "gym-fixed-teacher-unlinked", name: "Musculación tarde", deletedAt: null },
    { id: "gym-fixed-group-foreign", teacherId: "gym-fixed-foreign-teacher", name: "Grupo ajeno", deletedAt: null },
  ];
}

export function getGymFixedDemoGroupMemberships(): GymFixedDemoGroupMembership[] {
  return [
    { groupId: "gym-fixed-group-linked", studentId: "gym-fixed-student-muslib" },
    { groupId: "gym-fixed-group-linked", studentId: "gym-fixed-student-muslib-lite" },
    { groupId: "gym-fixed-group-linked", studentId: "gym-fixed-student-general" },
    { groupId: "gym-fixed-group-linked", studentId: "gym-fixed-student-personalized" },
    { groupId: "gym-fixed-group-foreign", studentId: "gym-fixed-foreign-student" },
  ];
}

/** A deterministic fictional GYM ledger. It never reads a clock, storage, or another demo's state. */
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
