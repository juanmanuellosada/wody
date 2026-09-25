import {
  assignFinanceStudentTeacher,
  editFinanceStudentName,
  setFinanceStudentBlocked,
  setFinanceStudentPaymentExempt,
  unassignFinanceStudentTeacher,
  // @ts-expect-error Node's native type-stripping test runner requires explicit extensions.
} from "./finance-demo-state.ts";
import type { FinanceDemoState, FinanceProfileResult } from "./finance-demo-types";

export type FinanceProfileCallbacks = {
  editStudent: (studentId: string, name: string) => Promise<FinanceProfileResult>;
  setBlocked: (studentId: string, blocked: boolean) => Promise<FinanceProfileResult>;
  setPaymentExempt: (studentId: string, exempt: boolean, reason: string | null) => Promise<FinanceProfileResult>;
  assignTeacher: (studentId: string, teacherId: string) => Promise<FinanceProfileResult>;
  unassignTeacher: (studentId: string, teacherId: string) => Promise<FinanceProfileResult>;
};

export type FinanceProfileCallbackFactoryOptions = {
  getState: () => FinanceDemoState;
  commit: (state: FinanceDemoState) => void;
  /** A fixed local identity; each command is independently checked against the frozen roster. */
  actor: unknown;
};

/**
 * Bridges the row-action UI to fresh local-state transactions. `options.getState()` is called at
 * dispatch time in every callback below, never cached, so authorization always reads the current
 * assignment — the same call-time pattern the payment callback factory already uses.
 */
export function createFinanceProfileCallbackFactory(options: FinanceProfileCallbackFactoryOptions): FinanceProfileCallbacks {
  function run(transition: { state: FinanceDemoState; result: FinanceProfileResult }): FinanceProfileResult {
    if (transition.result.success) options.commit(transition.state);
    return transition.result;
  }

  return {
    editStudent: async (studentId, name) =>
      run(editFinanceStudentName(options.getState(), { actor: options.actor, studentId, name })),
    setBlocked: async (studentId, blocked) =>
      run(setFinanceStudentBlocked(options.getState(), { actor: options.actor, studentId, blocked })),
    setPaymentExempt: async (studentId, exempt, reason) =>
      run(setFinanceStudentPaymentExempt(options.getState(), { actor: options.actor, studentId, exempt, reason })),
    assignTeacher: async (studentId, teacherId) =>
      run(assignFinanceStudentTeacher(options.getState(), { actor: options.actor, studentId, teacherId })),
    unassignTeacher: async (studentId, teacherId) =>
      run(unassignFinanceStudentTeacher(options.getState(), { actor: options.actor, studentId, teacherId })),
  };
}
