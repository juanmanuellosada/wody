"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { UpgradeLiteDialog } from "@/components/UpgradeLiteDialog";
import type { GymTerms } from "@/lib/gym-terms";

interface TeacherOption {
  id: string;
  name: string;
}

interface UpgradeLiteDialogButtonProps {
  userId: string;
  userName: string;
  assignedTeachers: TeacherOption[];
  terms: GymTerms;
}

export function UpgradeLiteDialogButton({
  userId,
  userName,
  assignedTeachers,
  terms,
}: UpgradeLiteDialogButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Convertir
      </Button>
      {open && (
        <UpgradeLiteDialog
          userId={userId}
          userName={userName}
          assignedTeachers={assignedTeachers}
          terms={terms}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
