export type FixedRoutineResult =
  | { success: true; id?: string }
  | { success: false; error: string };

export interface FixedRoutineStudentOption {
  id: string;
  name: string;
}

export interface FixedRoutineRenewalRoutine {
  id: string;
  studentId: string;
  studentName: string;
  renewAt: Date;
  overdue: boolean;
}

export type FixedRoutineCreate = (
  studentId: string,
  title: string,
  content: string,
  renewAt: string,
) => Promise<FixedRoutineResult>;

export type FixedRoutineUpdate = (
  routineId: string,
  title: string,
  content: string,
  renewAt: string,
) => Promise<FixedRoutineResult>;

export type FixedRoutineDelete = (routineId: string) => Promise<FixedRoutineResult>;

export interface FixedRoutineStudentViewRoutine {
  id: string;
  title: string;
  content: string;
  renewAt: Date | string;
  teacher: { name: string } | null;
}
