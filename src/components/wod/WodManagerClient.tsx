"use client";

import { WodManagerView } from "@/components/wod/WodManagerView";
import { createWod, updateWod, deleteWod, copyWod } from "@/actions/wod";
import { createFixedRoutine, createFixedRoutineForGroup } from "@/actions/fixed-routine";
import type { WodTarget } from "@/actions/wod";
import type { GymTerms } from "@/lib/gym-terms";
import type { GroupOption, StudentOption, WodForManager } from "@/components/wod/WodManagerView";

interface WodManagerClientProps {
  wods: WodForManager[];
  groups: GroupOption[];
  students: StudentOption[];
  muslibStudents?: StudentOption[];
  terms: GymTerms;
  demo?: boolean;
  // Cuando se pasa, todos los WODs se crean/editan contra este target
  // y se oculta el selector. Se usa en la pantalla "Mis rutinas".
  lockedTarget?: WodTarget;
}

// Production adapter: demo preserves the historical no-op contract while the
// action-free view always invokes the callbacks supplied by its caller.
export function WodManagerClient({ wods, groups, students, muslibStudents, terms, demo, lockedTarget }: WodManagerClientProps) {
  return (
    <WodManagerView
      wods={wods}
      groups={groups}
      students={students}
      muslibStudents={muslibStudents}
      terms={terms}
      lockedTarget={lockedTarget}
      onCreateWod={createWod}
      onUpdateWod={updateWod}
      onDeleteWod={deleteWod}
      onCreateFixedRoutine={createFixedRoutine}
      onCreateFixedRoutineForGroup={createFixedRoutineForGroup}
      onCopyWod={copyWod}
      legacyDemoNoOp={demo}
      disableDelete={demo}
    />
  );
}
