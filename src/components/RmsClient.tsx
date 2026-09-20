"use client";

import { createRm, updateRm, deleteRm } from "@/actions/rm";
import { RmsView } from "@/components/RmsView";
import type { GymTerms } from "@/lib/gym-terms";

interface RmData {
  id: string;
  exercise: string;
  weight: number;
  date: string; // ISO string
  createdAt: string;
}

interface RmsClientProps {
  rms: RmData[];
  athleteName: string;
  gymName: string;
  gymSlug: string;
  terms: GymTerms;
}

/** Production adapter retaining the historical public props and server actions. */
export function RmsClient({ rms, athleteName, gymName, gymSlug, terms }: RmsClientProps) {
  return (
    <RmsView
      rms={rms}
      athleteName={athleteName}
      gymName={gymName}
      gymSlug={gymSlug}
      terms={terms}
      onCreateRm={createRm}
      onUpdateRm={updateRm}
      onDeleteRm={deleteRm}
    />
  );
}
