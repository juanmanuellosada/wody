export const PERSONAL_TRAINING_DEMO_VERSION = 1;
export const PERSONAL_TRAINING_DEMO_NAMESPACE = "demo-personal-training/v1";

/** The PERSONAL ledger persists only own routines, never an active actor or capabilities. */
export type PersonalTrainingDemoState = {
  version: typeof PERSONAL_TRAINING_DEMO_VERSION;
  namespace: typeof PERSONAL_TRAINING_DEMO_NAMESPACE;
  wods: PersonalTrainingWod[];
};

/** Stored date values are normalized UTC calendar-day keys. */
export type PersonalTrainingWod = {
  id: string;
  title: string;
  content: string;
  date: string;
  teacherId: string;
  targetType: "STUDENT";
  targetGroupId: null;
  targetStudentId: string;
  deletedAt: string | null;
};

declare const personalTrainingActor: unique symbol;
/** Opaque immutable capability for the one canonical PERSONAL student. */
export type PersonalTrainingActorToken = { readonly [personalTrainingActor]: true };

export type PersonalTrainingWodTarget = { type: "STUDENT"; studentId: string };

export type PersonalTrainingWodResult =
  | { success: true; wodId?: string }
  | { success: false; error: string };

export type PersonalTrainingCopyResult =
  | { success: true; count: number; wodIds: string[] }
  | { success: false; error: string };

export type PersonalTrainingTransition<R> = {
  state: PersonalTrainingDemoState;
  result: R;
};

export type PersonalTrainingCreateWodCommand = {
  id: string;
  date: string;
  title: string;
  content: string;
  target: PersonalTrainingWodTarget;
};

export type PersonalTrainingUpdateWodCommand = {
  wodId: string;
  title: string;
  content: string;
  date?: string;
  target?: PersonalTrainingWodTarget;
};

export type PersonalTrainingDeleteWodCommand = { wodId: string };

/** One command makes all requested copies or none of them. Duplicate dates remain valid. */
export type PersonalTrainingCopyToDatesCommand = {
  sourceWodId: string;
  ids: string[];
  targetDates: string[];
  target?: PersonalTrainingWodTarget;
};

export type PersonalTrainingWodViewRow = {
  id: string;
  title: string;
  content: string;
  date: Date;
  targetType: "STUDENT";
  targetGroupId: null;
  targetStudentId: string;
  targetGroupName: null;
  targetStudentName: null;
};
