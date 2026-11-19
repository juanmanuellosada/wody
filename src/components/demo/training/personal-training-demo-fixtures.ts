// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { PERSONAL_TRAINING_DEMO_NAMESPACE, PERSONAL_TRAINING_DEMO_VERSION } from "./personal-training-demo-types.ts";
import type { PersonalTrainingDemoState } from "./personal-training-demo-types";

/** Deterministic PERSONAL-only data; it shares neither the BOX roster nor BOX state. */
export function createPersonalTrainingDemoFixture(): PersonalTrainingDemoState {
  return {
    version: PERSONAL_TRAINING_DEMO_VERSION,
    namespace: PERSONAL_TRAINING_DEMO_NAMESPACE,
    wods: [
      {
        id: "personal-wod-current",
        title: "Rutina actual",
        content: "Movilidad y fuerza controlada.",
        date: "2025-05-10",
        teacherId: "personal-student-owner",
        targetType: "STUDENT",
        targetGroupId: null,
        targetStudentId: "personal-student-owner",
        deletedAt: null,
      },
      {
        id: "personal-wod-past",
        title: "Rutina anterior",
        content: "Trabajo de base.",
        date: "2025-04-12",
        teacherId: "personal-student-owner",
        targetType: "STUDENT",
        targetGroupId: null,
        targetStudentId: "personal-student-owner",
        deletedAt: null,
      },
      {
        id: "personal-wod-deleted",
        title: "Rutina archivada",
        content: "No debe aparecer en Mis rutinas.",
        date: "2025-03-10",
        teacherId: "personal-student-owner",
        targetType: "STUDENT",
        targetGroupId: null,
        targetStudentId: "personal-student-owner",
        deletedAt: "2025-04-01T12:00:00.000Z",
      },
    ],
  };
}
