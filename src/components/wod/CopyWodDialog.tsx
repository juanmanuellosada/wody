"use client";

import { CopyWodDialogView } from "@/components/wod/CopyWodDialogView";
import { copyWod } from "@/actions/wod";
import type { GymTerms } from "@/lib/gym-terms";
import type { GroupOption, SourceWod, StudentOption } from "@/components/wod/CopyWodDialogView";

interface CopyWodDialogProps {
  sourceWod: SourceWod;
  groups: GroupOption[];
  students: StudentOption[];
  onClose: () => void;
  demo?: boolean;
  terms: GymTerms;
}

// Production adapter: demo keeps its legacy close-without-live-copy behavior.
export function CopyWodDialog({
  sourceWod,
  groups,
  students,
  onClose,
  demo,
  terms,
}: CopyWodDialogProps) {
  return (
    <CopyWodDialogView
      sourceWod={sourceWod}
      groups={groups}
      students={students}
      onClose={onClose}
      terms={terms}
      onCopyWod={copyWod}
      legacyDemoNoOp={demo}
    />
  );
}
