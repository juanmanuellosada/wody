export const GYM_TRAINING_DEMO_VERSION = 1;
export const GYM_TRAINING_DEMO_NAMESPACE = "demo-gym-training/v1";
export const GYM_TRAINING_DEMO_KIND = "GYM";

export type GymTrainingWodTargetType = "ALL" | "PERSONALIZED" | "GROUP" | "STUDENT";

export type GymTrainingGroup = {
  id: string;
  name: string;
  teacherId: string;
  deletedAt: string | null;
};

export type GymTrainingGroupMembership = {
  groupId: string;
  studentId: string;
};

/** Date is a normalized UTC calendar key, matching the production @db.Date field. */
export type GymTrainingWod = {
  id: string;
  title: string;
  content: string;
  date: string;
  teacherId: string;
  targetType: GymTrainingWodTargetType;
  targetGroupId: string | null;
  targetStudentId: string | null;
};

/** This ledger deliberately excludes actor selection, profiles, links, tokens, and PRs. */
export type GymTrainingDemoState = {
  version: typeof GYM_TRAINING_DEMO_VERSION;
  namespace: typeof GYM_TRAINING_DEMO_NAMESPACE;
  kind: typeof GYM_TRAINING_DEMO_KIND;
  groups: GymTrainingGroup[];
  memberships: GymTrainingGroupMembership[];
  wods: GymTrainingWod[];
};

export type GymTrainingWodTarget =
  | { type: "ALL" }
  | { type: "PERSONALIZED" }
  | { type: "GROUP"; groupId: string }
  | { type: "STUDENT"; studentId: string }
  /** UI routes these to fixed routines; the dated ledger never persists them. */
  | { type: "MUSCULACION_LIBRE"; studentId: string }
  | { type: "MUSCULACION_LIBRE_GROUP"; groupId: string };

export type GymTrainingResult = { success: true } | { success: false; error: string };
export type GymTrainingWodResult = { success: true; wodId?: string } | { success: false; error: string };
export type GymTrainingGroupResult = { success: true; groupId?: string } | { success: false; error: string };
export type GymTrainingTransition<R> = { state: GymTrainingDemoState; result: R };

export type GymTrainingStaffWod = Readonly<GymTrainingWod & { targetGroupName: string | null; targetStudentName: string | null }>;
export type GymTrainingStaffGroup = Readonly<{
  id: string;
  name: string;
  students: readonly Readonly<{ id: string; name: string }>[];
  availableToAdd: readonly Readonly<{ id: string; name: string }>[];
}>;
export type GymTrainingStudentWod = Readonly<Omit<GymTrainingWod, "targetGroupId" | "targetStudentId"> & { targetGroupName: string | null; isOwn: boolean }>;

export type GymTrainingProjection =
  | Readonly<{
      success: true;
      actorId: string;
      staff: Readonly<{
        wods: readonly GymTrainingStaffWod[];
        groups: readonly GymTrainingStaffGroup[];
        students: readonly Readonly<{ id: string; name: string }>[];
      }>;
      student: Readonly<{ wods: readonly GymTrainingStudentWod[] }>;
    }>
  | Readonly<{ success: false; error: string }>;

export type GymFixedGroupAssignment =
  | Readonly<{ success: true; groupId: string; teacherId: string; eligibleStudentIds: readonly string[] }>
  | Readonly<{ success: false; error: string }>;
