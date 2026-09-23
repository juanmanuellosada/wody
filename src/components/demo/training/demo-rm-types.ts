export type DemoRmKind = "GYM" | "PERSONAL";

export type DemoRmLedgerRow = {
  id: string;
  studentId: string;
  exercise: string;
  weight: number;
  date: string;
};

export type DemoRmState = {
  version: 1;
  namespace: string;
  kind: DemoRmKind;
  rms: DemoRmLedgerRow[];
};

/** Opaque capability issued only by its owning demo RM core instance. */
export type DemoRmActorToken = object;

export type DemoRmResult =
  | { success: true }
  | { success: true; id: string }
  | { success: false; error: string };

export type DemoRmCommand = {
  id: string;
  exercise: string;
  weight: string;
  date: string;
};

export type DemoRmViewRow = {
  id: string;
  exercise: string;
  weight: number;
  date: Date;
  createdAt: Date;
};

export type DemoRmProjectionResult =
  | { success: true; rms: DemoRmViewRow[] }
  | { success: false; error: string };

export type DemoRmCoreConfig = {
  kind: DemoRmKind;
  ownerIds: string[];
};
