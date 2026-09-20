// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { TRAINING_DEMO_NAMESPACE, TRAINING_DEMO_VERSION } from "./training-demo-types.ts";
import type { TrainingDemoState } from "./training-demo-types";

/** A deterministic, fictional BOX tenant. It does not read time or storage. */
export function createTrainingDemoFixture(): TrainingDemoState {
  return {
    version: TRAINING_DEMO_VERSION,
    namespace: TRAINING_DEMO_NAMESPACE,
    selectedActorId: "a1",
    actors: [
      { id: "a1", name: "Martín Demo", role: "ADMIN", studentType: null, canCreateOwnRoutines: false },
      { id: "t1", name: "Carlos Entrenador", role: "TEACHER", studentType: null, canCreateOwnRoutines: false },
      { id: "t2", name: "Elena Profe", role: "TEACHER", studentType: null, canCreateOwnRoutines: false },
      { id: "s1", name: "Juan Pérez", role: "STUDENT", studentType: "PERSONALIZED", canCreateOwnRoutines: false },
      { id: "s2", name: "Ana General", role: "STUDENT", studentType: "GENERAL", canCreateOwnRoutines: false },
      { id: "s3", name: "Clara Propia", role: "STUDENT", studentType: "PERSONALIZED", canCreateOwnRoutines: true },
    ],
    teacherStudentLinks: [
      { teacherId: "t1", studentId: "s1" },
      { teacherId: "t1", studentId: "s2" },
      { teacherId: "t2", studentId: "s3" },
    ],
    groups: [
      { id: "g1", name: "Equipo Demo", teacherId: "t1", deletedAt: null },
      { id: "g2", name: "Equipo Elena", teacherId: "t2", deletedAt: null },
    ],
    memberships: [
      { groupId: "g1", studentId: "s1" },
      { groupId: "g2", studentId: "s3" },
    ],
    wods: [
      {
        id: "w1",
        title: "Base general",
        content: "3 rondas de técnica.",
        date: "2025-04-10",
        teacherId: "t1",
        targetType: "ALL",
        targetGroupId: null,
        targetStudentId: null,
      },
      {
        id: "w2",
        title: "Trabajo personalizado",
        content: "Movilidad y fuerza controlada.",
        date: "2025-04-11",
        teacherId: "t1",
        targetType: "PERSONALIZED",
        targetGroupId: null,
        targetStudentId: null,
      },
      {
        id: "w3",
        title: "Equipo Demo",
        content: "Intervalos por parejas.",
        date: "2025-04-12",
        teacherId: "t1",
        targetType: "GROUP",
        targetGroupId: "g1",
        targetStudentId: null,
      },
      {
        id: "w4",
        title: "Ajuste para Juan",
        content: "Escalá las repeticiones según técnica.",
        date: "2025-04-13",
        teacherId: "t1",
        targetType: "STUDENT",
        targetGroupId: null,
        targetStudentId: "s1",
      },
      {
        id: "w5",
        title: "Clase de Elena",
        content: "Práctica de levantamientos.",
        date: "2025-04-14",
        teacherId: "t2",
        targetType: "ALL",
        targetGroupId: null,
        targetStudentId: null,
      },
      {
        id: "w6",
        title: "Rutina propia de Clara",
        content: "Registro autónomo de práctica.",
        date: "2025-04-15",
        teacherId: "s3",
        targetType: "STUDENT",
        targetGroupId: null,
        targetStudentId: "s3",
      },
      {
        id: "w7",
        title: "Aviso administrativo",
        content: "Entrada de demostración para personal.",
        date: "2025-04-16",
        teacherId: "a1",
        targetType: "ALL",
        targetGroupId: null,
        targetStudentId: null,
      },
    ],
  };
}
