// RM records were added in v2. Older v1 payloads are rejected and reset to fixtures.
export const TRAINING_DEMO_VERSION = 2;
export const TRAINING_DEMO_NAMESPACE = "demo-box-training";
export const TRAINING_DEMO_STORAGE_KEY = "wody-box-training-demo-v2";

export type TrainingRole = "ADMIN" | "TEACHER" | "STUDENT";
export type TrainingStudentType = "GENERAL" | "PERSONALIZED";
export type TrainingWodTargetType = "ALL" | "PERSONALIZED" | "GROUP" | "STUDENT";

export type TrainingActor = {
  id: string;
  name: string;
  role: TrainingRole;
  studentType: TrainingStudentType | null;
  canCreateOwnRoutines: boolean;
};

export type TrainingTeacherStudentLink = {
  teacherId: string;
  studentId: string;
};

export type TrainingGroup = {
  id: string;
  name: string;
  teacherId: string;
  deletedAt: string | null;
};

export type TrainingGroupMembership = {
  groupId: string;
  studentId: string;
};

/** Dates are UTC calendar-day keys, never local Date instances. */
export type TrainingWod = {
  id: string;
  title: string;
  content: string;
  date: string;
  teacherId: string;
  targetType: TrainingWodTargetType;
  targetGroupId: string | null;
  targetStudentId: string | null;
};

/** RM ownership mirrors production's userId check; an owner may hold any training role. */
export type TrainingRm = {
  id: string;
  exercise: string;
  weight: number;
  date: string;
  createdAt: string;
  ownerId: string;
};

export type TrainingDemoState = {
  version: typeof TRAINING_DEMO_VERSION;
  namespace: typeof TRAINING_DEMO_NAMESPACE;
  selectedActorId: string;
  actors: TrainingActor[];
  teacherStudentLinks: TrainingTeacherStudentLink[];
  groups: TrainingGroup[];
  memberships: TrainingGroupMembership[];
  wods: TrainingWod[];
  rms: TrainingRm[];
};

export type TrainingWodTarget =
  | { type: "ALL" }
  | { type: "PERSONALIZED" }
  | { type: "GROUP"; groupId: string }
  | { type: "STUDENT"; studentId: string }
  | { type: "MUSCULACION_LIBRE"; studentId: string }
  | { type: "MUSCULACION_LIBRE_GROUP"; groupId: string };

export type TrainingResult = { success: true } | { success: false; error: string };
export type TrainingWodResult =
  | { success: true; wodId?: string }
  | { success: false; error: string };
export type TrainingGroupResult =
  | { success: true; groupId?: string }
  | { success: false; error: string };
export type TrainingRmResult =
  | { success: true }
  | { success: false; error: string };
export type TrainingFixedRoutineResult =
  | { success: true; id?: string }
  | { success: false; error: string };
export type TrainingFixedRoutineGroupResult =
  | { success: true; count: number }
  | { success: false; error: string };

export type TrainingTransition<R> = {
  state: TrainingDemoState;
  result: R;
};

export type TrainingDemoCommand =
  | { type: "select-actor"; actorId: string }
  | { type: "reset" }
  | { type: "create-wod"; id: string; date: string; title: string; content: string; target: TrainingWodTarget }
  | { type: "update-wod"; wodId: string; title: string; content: string; date?: string; target?: TrainingWodTarget }
  | { type: "delete-wod"; wodId: string }
  | { type: "copy-wod"; id: string; sourceWodId: string; targetDate: string; target?: TrainingWodTarget }
  | { type: "create-group"; id: string; name: string }
  | { type: "rename-group"; groupId: string; name: string }
  | { type: "delete-group"; groupId: string; deletedAt: string }
  | { type: "assign-student"; studentId: string; groupId: string }
  | { type: "remove-student"; studentId: string; groupId: string }
  | { type: "create-rm"; id: string; exercise: string; weight: number; date: string; createdAt: string }
  | { type: "update-rm"; rmId: string; exercise: string; weight: number; date: string }
  | { type: "delete-rm"; rmId: string };

export type TrainingWodViewRow = Omit<TrainingWod, "date"> & {
  date: Date;
  targetGroupName: string | null;
  targetStudentName: string | null;
};

export type TrainingGroupViewRow = {
  id: string;
  name: string;
  students: Array<{ id: string; name: string }>;
  availableToAdd: Array<{ id: string; name: string }>;
};

export type TrainingStudentWodRow = {
  id: string;
  title: string;
  content: string;
  date: Date;
  teacherId: string;
  targetType: TrainingWodTargetType;
  targetGroupName: string | null;
  isOwn: boolean;
};

export type TrainingRmViewRow = Omit<TrainingRm, "date" | "createdAt" | "ownerId"> & {
  date: Date;
  createdAt: Date;
};

export type TrainingViewProjections = {
  selectedActor: TrainingActor;
  staff: {
    wods: TrainingWodViewRow[];
    groups: TrainingGroupViewRow[];
    students: Array<{ id: string; name: string }>;
  };
  student: {
    wods: TrainingStudentWodRow[];
  };
  /** Every actor sees and can mutate only their own RM history. */
  rms: TrainingRmViewRow[];
};

export type TrainingRmCallbacks = {
  createRm: (formData: FormData) => Promise<TrainingRmResult>;
  updateRm: (rmId: string, formData: FormData) => Promise<TrainingRmResult>;
  deleteRm: (rmId: string) => Promise<TrainingRmResult>;
};

export type TrainingViewCallbacks = {
  onCreateWod: (date: string, title: string, content: string, target: TrainingWodTarget) => Promise<TrainingWodResult>;
  onUpdateWod: (wodId: string, title: string, content: string, date?: string, target?: TrainingWodTarget) => Promise<TrainingWodResult>;
  onDeleteWod: (wodId: string) => Promise<TrainingWodResult>;
  onCreateFixedRoutine: (studentId: string, title: string, content: string, renewAt?: string) => Promise<TrainingFixedRoutineResult>;
  onCreateFixedRoutineForGroup: (groupId: string, title: string, content: string, renewAt?: string) => Promise<TrainingFixedRoutineGroupResult>;
  onCopyWod: (sourceWodId: string, targetDate: string, target?: TrainingWodTarget) => Promise<TrainingWodResult>;
  onCreateGroup: (name: string) => Promise<TrainingGroupResult>;
  onDeleteGroup: (groupId: string) => Promise<TrainingGroupResult>;
  onRenameGroup: (groupId: string, name: string) => Promise<TrainingGroupResult>;
  onAssignStudentToGroup: (studentId: string, groupId: string) => Promise<TrainingGroupResult>;
  onRemoveStudentFromGroup: (studentId: string, groupId: string) => Promise<TrainingGroupResult>;
  rm: TrainingRmCallbacks;
};
