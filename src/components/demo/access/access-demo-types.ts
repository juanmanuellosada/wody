import type { FeeStudent } from "../finance/fees-contract";

export const ACCESS_DEMO_NAMESPACE = "wody-box-access-demo-v1";
export const ACCESS_DEMO_VERSION = 1;
export const ACCESS_DEMO_STORAGE_KEY = ACCESS_DEMO_NAMESPACE;
export const ACCESS_DEMO_DEFAULT_ANCHOR = "2030-06-03";

export type AccessDecision = "GRANT" | "DENY";
export type AccessLogState = "PENDING" | "GRANTED" | "DENIED";

/** The local ledger deliberately contains no copied profile, payment, or QR data. */
export type AccessDemoLog = {
  id: string;
  userId: string;
  at: string;
  state: AccessLogState;
  decidedById: string | null;
  decidedAt: string | null;
};

export type AccessDemoState = {
  version: typeof ACCESS_DEMO_VERSION;
  namespace: typeof ACCESS_DEMO_NAMESPACE;
  logs: AccessDemoLog[];
};

export type AccessDemoActor = {
  readonly id: string;
  readonly role: "ADMIN" | "TEACHER" | "STUDENT" | "ACCESS";
};

export type AccessStudent = FeeStudent;

export type AccessUserDto = {
  id: string;
  name: string;
  role: "STUDENT";
  memberNumber: number;
  nextPaymentDate: string;
  blockedAt: string | null;
};

export type AccessLookupResult =
  | { success: true; user: AccessUserDto; alDia: boolean }
  | { success: false; error: string };

export type AccessCommandResult =
  | { success: true; logId: string; state: "GRANTED" | "DENIED" }
  | { success: false; error: string };

export type AccessDecisionResult =
  | { success: true; logId: string; state: "GRANTED" | "DENIED" }
  | { success: false; error: string };

export type AccessHistoryRow = AccessDemoLog & { user: AccessUserDto | null; decidedByName: string | null };
export type AccessDailyFeed = { pending: AccessHistoryRow[]; recent: AccessHistoryRow[]; date: string };

/**
 * Mirrors production's non-student rule: once not blocked, non-students are
 * considered current. Demo manual lookup intentionally exposes students only.
 */
export type AccessPaymentSubject = Pick<FeeStudent, "nextPaymentDate" | "paymentExempt" | "blocked"> & {
  role?: "ADMIN" | "TEACHER" | "STUDENT" | "ACCESS";
};
