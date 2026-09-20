"use client";

import { createRm, updateRm } from "@/actions/rm";
import { RmFormView } from "@/components/RmFormView";
import type { GymTerms } from "@/lib/gym-terms";

interface RmFormProps {
  editId?: string;
  defaultExercise?: string;
  defaultWeight?: number;
  defaultDate?: string;
  onCancel?: () => void;
  onSuccess?: () => void;
  terms: GymTerms;
}

/** Production adapter retaining the public form contract and live action signatures. */
export function RmForm(props: RmFormProps) {
  return <RmFormView {...props} onCreateRm={createRm} onUpdateRm={updateRm} />;
}
