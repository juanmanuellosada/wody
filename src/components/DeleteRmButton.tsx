"use client";

import { deleteRm } from "@/actions/rm";
import { DeleteRmButtonView } from "@/components/DeleteRmButtonView";

interface DeleteRmButtonProps {
  rmId: string;
}

/** Production adapter retaining the existing deletion prop and live action. */
export function DeleteRmButton({ rmId }: DeleteRmButtonProps) {
  return <DeleteRmButtonView rmId={rmId} onDeleteRm={deleteRm} />;
}
