// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { GYM_DEMO_HISTORICAL_MUSLIB_LITE_STUDENT_ID, GYM_DEMO_MUSLIB_STUDENT_ID, GYM_DEMO_PERSONALIZED_STUDENT_ID, GYM_DEMO_PRIMARY_TEACHER_ID, GYM_DEMO_SECONDARY_TEACHER_ID } from "../scenarios/gym-demo-directory.ts";
// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { GYM_TRAINING_DEMO_KIND, GYM_TRAINING_DEMO_NAMESPACE, GYM_TRAINING_DEMO_VERSION } from "./gym-training-demo-types.ts";
import type { GymTrainingDemoState } from "./gym-training-demo-types";

/** A deterministic GYM dated-training ledger; canonical identity remains in gym-demo-directory.ts. */
export function createGymTrainingDemoFixture(): GymTrainingDemoState {
  return {
    version: GYM_TRAINING_DEMO_VERSION,
    namespace: GYM_TRAINING_DEMO_NAMESPACE,
    kind: GYM_TRAINING_DEMO_KIND,
    groups: [
      { id: "gym-dated-group-strength", name: "Fuerza mañana", teacherId: GYM_DEMO_PRIMARY_TEACHER_ID, deletedAt: null },
      { id: "gym-dated-group-mobility", name: "Movilidad tarde", teacherId: GYM_DEMO_SECONDARY_TEACHER_ID, deletedAt: null },
    ],
    memberships: [
      { groupId: "gym-dated-group-strength", studentId: GYM_DEMO_PERSONALIZED_STUDENT_ID },
      { groupId: "gym-dated-group-strength", studentId: GYM_DEMO_MUSLIB_STUDENT_ID },
      // This historical LITE member remains eligible for the fixed-routine bridge, not dated WOD visibility.
      { groupId: "gym-dated-group-strength", studentId: GYM_DEMO_HISTORICAL_MUSLIB_LITE_STUDENT_ID },
    ],
    wods: [
      { id: "gym-dated-all", title: "Entrada general", content: "Activación de movilidad.", date: "2025-05-01", teacherId: GYM_DEMO_PRIMARY_TEACHER_ID, targetType: "ALL", targetGroupId: null, targetStudentId: null },
      { id: "gym-dated-personalized", title: "Seguimiento personalizado", content: "Tres series controladas.", date: "2025-05-02", teacherId: GYM_DEMO_PRIMARY_TEACHER_ID, targetType: "PERSONALIZED", targetGroupId: null, targetStudentId: null },
      { id: "gym-dated-group", title: "Bloque de fuerza", content: "Trabajo por estaciones.", date: "2025-05-03", teacherId: GYM_DEMO_PRIMARY_TEACHER_ID, targetType: "GROUP", targetGroupId: "gym-dated-group-strength", targetStudentId: null },
      { id: "gym-dated-direct", title: "Ajuste individual", content: "Técnica y pausa.", date: "2025-05-04", teacherId: GYM_DEMO_PRIMARY_TEACHER_ID, targetType: "STUDENT", targetGroupId: null, targetStudentId: GYM_DEMO_PERSONALIZED_STUDENT_ID },
      { id: "gym-dated-general", title: "Circuito base", content: "Cuatro ejercicios simples.", date: "2025-05-05", teacherId: GYM_DEMO_SECONDARY_TEACHER_ID, targetType: "ALL", targetGroupId: null, targetStudentId: null },
    ],
  };
}
