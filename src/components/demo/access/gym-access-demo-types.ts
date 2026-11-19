import type { FeeStudent } from "../finance/fees-contract";

/** Isolated from BOX access: own namespace, own storage key, never reads/writes wody-box-access-demo-v1. */
export const GYM_ACCESS_DEMO_NAMESPACE = "wody-gym-access-demo-v1";
export const GYM_ACCESS_DEMO_VERSION = 1;
export const GYM_ACCESS_DEMO_STORAGE_KEY = GYM_ACCESS_DEMO_NAMESPACE;

export type GymAccessDecision = "GRANT" | "DENY";
export type GymAccessLogState = "PENDING" | "GRANTED" | "DENIED";

/** The local ledger deliberately contains no copied profile, payment, or QR data. */
export type GymAccessDemoLog = {
  id: string;
  userId: string;
  at: string;
  state: GymAccessLogState;
  decidedById: string | null;
  decidedAt: string | null;
};

export type GymAccessDemoState = {
  version: typeof GYM_ACCESS_DEMO_VERSION;
  namespace: typeof GYM_ACCESS_DEMO_NAMESPACE;
  logs: GymAccessDemoLog[];
};

/** Raw GYM finance roster shape; blocked/paymentExempt are overridden by the profile bridge before use. */
export type GymAccessStudent = FeeStudent;

/**
 * Display-only overlay for the two profile-bridge-governed fields. Built by the adapter from
 * DemoGymProfileProvider's `profileState.students`, the same source DemoGymFeesAdapter's
 * profileOverrides map uses for Cuotas, and threaded as a plain parameter — never cached.
 */
export type GymAccessProfileOverride = { blocked: boolean; paymentExempt: boolean };

export type GymAccessUserDto = {
  id: string;
  name: string;
  role: "STUDENT";
  memberNumber: number;
  nextPaymentDate: string;
  blockedAt: string | null;
};

export type GymAccessLookupResult =
  | { success: true; user: GymAccessUserDto; alDia: boolean }
  | { success: false; error: string };

export type GymAccessCommandResult =
  | { success: true; logId: string; state: "GRANTED" | "DENIED" }
  | { success: false; error: string };

export type GymAccessDecisionResult =
  | { success: true; logId: string; state: "GRANTED" | "DENIED" }
  | { success: false; error: string };

export type GymAccessHistoryRow = GymAccessDemoLog & { user: GymAccessUserDto | null; decidedByName: string | null };
export type GymAccessDailyFeed = { pending: GymAccessHistoryRow[]; recent: GymAccessHistoryRow[]; date: string };
