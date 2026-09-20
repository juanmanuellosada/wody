// @ts-expect-error Node's native type-stripping test runner requires the explicit extension.
import { assignTrainingStudentToGroup, copyTrainingWod, createTrainingGroup, createTrainingRm, createTrainingWod, deleteTrainingGroup, deleteTrainingRm, deleteTrainingWod, removeTrainingStudentFromGroup, renameTrainingGroup, updateTrainingRm, updateTrainingWod } from "./training-demo-state.ts";
import type {
  TrainingDemoState,
  TrainingFixedRoutineGroupResult,
  TrainingFixedRoutineResult,
  TrainingGroupResult,
  TrainingRmResult,
  TrainingViewCallbacks,
  TrainingWodResult,
  TrainingWodTarget,
} from "./training-demo-types";

export type TrainingCallbackFactoryOptions = {
  getState: () => TrainingDemoState;
  commit: (state: TrainingDemoState) => void;
  nextId?: (kind: "wod" | "group" | "rm", state: TrainingDemoState) => string;
  now?: () => Date;
};

function defaultId(kind: "wod" | "group" | "rm", state: TrainingDemoState): string {
  const existing = new Set(
    kind === "wod"
      ? state.wods.map((wod) => wod.id)
      : kind === "group"
        ? state.groups.map((group) => group.id)
        : state.rms.map((rm) => rm.id),
  );
  let suffix = 1;
  while (existing.has(`${kind}-local-${suffix}`)) suffix += 1;
  return `${kind}-local-${suffix}`;
}

function isoNow(now: () => Date): string {
  return now().toISOString();
}

function unsupportedFixedRoutine(): TrainingFixedRoutineResult {
  return { success: false, error: "Las rutinas de musculación no están disponibles en el demo BOX." };
}

function unsupportedFixedRoutineGroup(): TrainingFixedRoutineGroupResult {
  return { success: false, error: "Las rutinas de musculación no están disponibles en el demo BOX." };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Reject files and malformed FormData-like inputs before parsing their values. */
function readFormDataText(formData: unknown, name: string): string | undefined {
  if (!isRecord(formData) || typeof formData.get !== "function") return undefined;
  try {
    const value = formData.get(name);
    return typeof value === "string" ? value : undefined;
  } catch {
    return undefined;
  }
}

type RmFormValues =
  | { success: true; exercise: string; weight: number; date: string }
  | { success: false; error: string };

function resolveRmFormData(formData: unknown): RmFormValues {
  const exercise = readFormDataText(formData, "exercise");
  const weightRaw = readFormDataText(formData, "weight");
  const date = readFormDataText(formData, "date");
  if (typeof exercise !== "string") return { success: false, error: "El ejercicio no puede estar vacío." };
  if (typeof weightRaw !== "string") return { success: false, error: "El peso debe ser mayor a 0." };
  if (typeof date !== "string") return { success: false, error: "La fecha es obligatoria." };
  const weight = parseFloat(weightRaw);
  if (!Number.isFinite(weight)) return { success: false, error: "El peso debe ser mayor a 0." };
  return { success: true, exercise, weight, date };
}

/**
 * Adapts the stable extracted view callbacks to a current-state transaction.
 * Each callback reads state at invocation time, so rapid sequential calls do not
 * close over an obsolete React render.
 */
export function createTrainingCallbackFactory(options: TrainingCallbackFactoryOptions): TrainingViewCallbacks {
  const nextId = options.nextId ?? defaultId;
  const now = options.now ?? (() => new Date());

  function commitWod(result: { state: TrainingDemoState; result: TrainingWodResult }): TrainingWodResult {
    if (result.result.success) options.commit(result.state);
    return result.result;
  }

  function commitGroup(result: { state: TrainingDemoState; result: TrainingGroupResult }): TrainingGroupResult {
    if (result.result.success) options.commit(result.state);
    return result.result;
  }

  function commitRm(result: { state: TrainingDemoState; result: TrainingRmResult }): TrainingRmResult {
    if (result.result.success) options.commit(result.state);
    return result.result;
  }

  return {
    onCreateWod: async (date: string, title: string, content: string, target: TrainingWodTarget) => {
      const state = options.getState();
      return commitWod(createTrainingWod(state, nextId("wod", state), date, title, content, target));
    },
    onUpdateWod: async (wodId: string, title: string, content: string, date?: string, target?: TrainingWodTarget) =>
      commitWod(updateTrainingWod(options.getState(), wodId, title, content, date, target)),
    onDeleteWod: async (wodId: string) => commitWod(deleteTrainingWod(options.getState(), wodId)),
    onCreateFixedRoutine: async () => unsupportedFixedRoutine(),
    onCreateFixedRoutineForGroup: async () => unsupportedFixedRoutineGroup(),
    onCopyWod: async (sourceWodId: string, targetDate: string, target?: TrainingWodTarget) => {
      const state = options.getState();
      return commitWod(copyTrainingWod(state, nextId("wod", state), sourceWodId, targetDate, target));
    },
    onCreateGroup: async (name: string) => {
      const state = options.getState();
      return commitGroup(createTrainingGroup(state, nextId("group", state), name));
    },
    onDeleteGroup: async (groupId: string) => commitGroup(deleteTrainingGroup(options.getState(), groupId, isoNow(now))),
    onRenameGroup: async (groupId: string, name: string) => commitGroup(renameTrainingGroup(options.getState(), groupId, name)),
    onAssignStudentToGroup: async (studentId: string, groupId: string) =>
      commitGroup(assignTrainingStudentToGroup(options.getState(), studentId, groupId)),
    onRemoveStudentFromGroup: async (studentId: string, groupId: string) =>
      commitGroup(removeTrainingStudentFromGroup(options.getState(), studentId, groupId)),
    rm: {
      createRm: async (formData: FormData) => {
        const values = resolveRmFormData(formData);
        if (!values.success) return values;
        const state = options.getState();
        return commitRm(createTrainingRm(state, nextId("rm", state), values.exercise, values.weight, values.date, isoNow(now)));
      },
      updateRm: async (rmId: string, formData: FormData) => {
        const values = resolveRmFormData(formData);
        if (!values.success) return values;
        return commitRm(updateTrainingRm(options.getState(), rmId, values.exercise, values.weight, values.date));
      },
      deleteRm: async (rmId: string) => commitRm(deleteTrainingRm(options.getState(), rmId)),
    },
  };
}
