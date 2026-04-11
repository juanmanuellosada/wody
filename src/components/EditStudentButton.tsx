"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { StudentEditor } from "@/components/StudentEditor";

interface EditStudentButtonProps {
  studentId: string;
  name: string;
  email: string;
  demo?: boolean;
}

export function EditStudentButton({ studentId, name, email, demo }: EditStudentButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Editar
      </Button>
      {open && (
        <StudentEditor
          studentId={studentId}
          currentName={name}
          currentEmail={email}
          onClose={() => setOpen(false)}
          demo={demo}
        />
      )}
    </>
  );
}
