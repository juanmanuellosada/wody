import type { ReactNode } from "react";

export type AccessDecision = "GRANT" | "DENY";
export type AccessDisplayRole =
  | "ADMIN"
  | "TEACHER"
  | "STUDENT"
  | "ACCESS"
  | "SUPERADMIN";

export type AccessOperationResult =
  | { success: true }
  | { success: false; error: string };

export type AccessLookupUser = {
  id: string;
  name: string;
  role: AccessDisplayRole;
  memberNumber: number;
  nextPaymentDate: string;
  blockedAt: string | null;
};

export type AccessLookupResult =
  | { success: true; user: AccessLookupUser; alDia: boolean }
  | { success: false; error: string };

export type AccessPendingUser = {
  id: string;
  name: string;
  role: "ADMIN" | "TEACHER" | "STUDENT" | "ACCESS";
  memberNumber: number;
  nextPaymentDate: string;
  blockedAt: string | null;
};

export type AccessPendingLog = {
  id: string;
  at: string;
  user: AccessPendingUser;
};

export type AccessRecentLog = {
  id: string;
  at: string;
  state: "GRANTED" | "DENIED";
  decidedAt: string | null;
  user: { id: string; name: string; memberNumber: number };
};

export type AccessHistoryRow = {
  id: string;
  at: string;
  state: "PENDING" | "GRANTED" | "DENIED";
  decidedAt: string | null;
  user: { id: string; name: string; memberNumber: number };
  decidedBy: { name: string } | null;
};

export type AccessKioskViewProps = {
  qrSlot: ReactNode;
  qrDescription: string;
  pending: AccessPendingLog[];
  recent: AccessRecentLog[];
  toast: AccessRecentLog | null;
  selectedDate: string;
  todayStr: string;
  isToday: boolean;
  onSelectedDateChange: (date: string) => void;
  onDecideCheckin: (
    logId: string,
    decision: AccessDecision,
  ) => Promise<AccessOperationResult>;
  onLookupForKiosk: (input: string) => Promise<AccessLookupResult>;
  onCreateManualCheckin: (
    userId: string,
    decision: AccessDecision,
  ) => Promise<AccessOperationResult>;
};
