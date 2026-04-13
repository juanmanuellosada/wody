"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { StudentEditor } from "@/components/StudentEditor";

interface TeacherOption {
  id: string;
  name: string;
}

interface EditStudentButtonProps {
  studentId: string;
  name: string;
  email: string;
  assignedTeachers: TeacherOption[];
  allTeachers: TeacherOption[];
  demo?: boolean;
}

export function EditStudentButton({
  studentId,
  name,
  email,
  assignedTeachers,
  allTeachers,
  demo,
}: EditStudentButtonProps) {
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
          assignedTeachers={assignedTeachers}
          allTeachers={allTeachers}
          onClose={() => setOpen(false)}
          demo={demo}
        />
      )}
    </>
  );
}
