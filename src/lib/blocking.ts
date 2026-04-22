import type { Role } from "@prisma/client";
import { getTodayArgentina } from "@/lib/dates";

type BlockStatusInput = {
  role: Role;
  blockedAt: Date | null;
  nextPaymentDate: Date;
};

export type BlockStatus =
  | { blocked: false }
  | { blocked: true; kind: "manual" }
  | { blocked: true; kind: "overdue"; days: number };

export function getBlockStatus(
  user: BlockStatusInput,
  autoBlockAfterDays: number,
  today: Date = getTodayArgentina()
): BlockStatus {
  if (user.blockedAt) {
    return { blocked: true, kind: "manual" };
  }

  if (user.role === "STUDENT") {
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysOverdue = Math.round(
      (today.getTime() - user.nextPaymentDate.getTime()) / msPerDay
    );
    if (daysOverdue > autoBlockAfterDays) {
      return { blocked: true, kind: "overdue", days: daysOverdue };
    }
  }

  return { blocked: false };
}
