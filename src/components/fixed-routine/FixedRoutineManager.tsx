"use client";

import { createFixedRoutine, deleteFixedRoutine, updateFixedRoutine } from "@/actions/fixed-routine";
import { FixedRoutineManagerView } from "./FixedRoutineManagerView";
import type {
  FixedRoutineRenewalRoutine,
  FixedRoutineStudentOption,
} from "./fixed-routine-view-contracts";

export interface FixedRoutineManagerProps {
  muslibStudents: FixedRoutineStudentOption[];
  renewalRoutines: FixedRoutineRenewalRoutine[];
}

export function FixedRoutineManager({
  muslibStudents,
  renewalRoutines,
}: FixedRoutineManagerProps) {
  return (
    <FixedRoutineManagerView
      muslibStudents={muslibStudents}
      renewalRoutines={renewalRoutines}
      createFixedRoutine={createFixedRoutine}
      updateFixedRoutine={updateFixedRoutine}
      deleteFixedRoutine={deleteFixedRoutine}
    />
  );
}
