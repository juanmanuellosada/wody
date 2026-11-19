export const GYM_FIXED_DEMO_VERSION = 1;
export const GYM_FIXED_DEMO_NAMESPACE = "demo-gym-fixed-routines/v1";

export type GymFixedDemoRole = "ADMIN" | "TEACHER" | "STUDENT";
export type GymFixedDemoStudentType = "GENERAL" | "PERSONALIZED" | "MUSCULACION_LIBRE";
export type GymFixedDemoAccountKind = "FULL" | "LITE";

/** Fixture-only directory data. It is not persisted with the fixed-routine ledger. */
export type GymFixedDemoRosterRecord = {
  id: string;
  gymId: string;
  name: string;
  role: GymFixedDemoRole;
  studentType: GymFixedDemoStudentType | null;
  accountKind: GymFixedDemoAccountKind;
  deletedAt: string | null;
};

export type GymFixedDemoTeacherStudentLink = {
  teacherId: string;
  studentId: string;
};

export type GymFixedDemoGroup = {
  id: string;
  teacherId: string;
  name: string;
  deletedAt: string | null;
};

export type GymFixedDemoGroupMembership = {
  groupId: string;
  studentId: string;
};

/** DateTime fields are ISO instants; renewAt mirrors Prisma's @db.Date as a UTC calendar key. */
export type GymFixedDemoRoutine = {
  id: string;
  gymId: string;
  studentId: string;
  teacherId: string;
  title: string;
  content: string;
  assignedAt: string;
  renewAt: string;
  deletedAt: string | null;
};

/** The isolated local ledger deliberately carries no selected actor or roster. */
export type GymFixedDemoState = {
  version: typeof GYM_FIXED_DEMO_VERSION;
  namespace: typeof GYM_FIXED_DEMO_NAMESPACE;
  fixedRoutines: GymFixedDemoRoutine[];
};

export type GymFixedDemoResult =
  | { success: true; id?: string }
  | { success: false; error: string };

export type GymFixedDemoGroupResult =
  | { success: true; count: number }
  | { success: false; error: string };

export type GymFixedDemoTransition<R> = {
  state: GymFixedDemoState;
  result: R;
};

export type GymFixedDemoCreateCommand = {
  id: string;
  studentId: string;
  title: string;
  content: string;
  renewAt?: string;
};

export type GymFixedDemoUpdateCommand = {
  routineId: string;
  title: string;
  content: string;
  /** Empty text preserves the existing renewal date, matching updateFixedRoutine. */
  renewAt?: string;
};

export type GymFixedDemoRenewCommand = {
  routineId: string;
  renewAt: string;
};

export type GymFixedDemoDeleteCommand = {
  routineId: string;
};

export type GymFixedDemoCreateGroupCommand = {
  groupId: string;
  /** One explicit, non-colliding ID per eligible member, in membership order. */
  ids: string[];
  title: string;
  content: string;
  renewAt?: string;
};

export type GymFixedDemoStudentRoutineDto = {
  id: string;
  title: string;
  content: string;
  assignedAt: Date;
  renewAt: Date;
  teacherName: string | null;
};

export type GymFixedDemoRenewalDto = {
  id: string;
  studentId: string;
  studentName: string;
  renewAt: Date;
  overdue: boolean;
};

export type GymFixedDemoAssignmentContext = {
  muslibStudents: Array<{ id: string; name: string; accountKind: GymFixedDemoAccountKind }>;
  groups: Array<{ id: string; name: string }>;
};
