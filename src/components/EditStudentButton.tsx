"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { StudentEditor } from "@/components/StudentEditor";
import type { StudentType } from "@prisma/client";

interface TeacherOption {
  id: string;
  name: string;
}

interface EditStudentButtonProps {
  studentId: string;
  name: string;
  email: string;
  nextPaymentDate?: Date;
  blocked?: boolean;
  studentType: StudentType;
  canCreateOwnRoutines: boolean;
  paymentExempt?: boolean;
  paymentExemptReason?: string | null;
  assignedTeachers: TeacherOption[];
  allTeachers: TeacherOption[];
  isAdmin?: boolean;
  demo?: boolean;
}

export function EditStudentButton({
  studentId,
  name,
  email,
  nextPaymentDate,
  blocked,
  studentType,
  canCreateOwnRoutines,
  paymentExempt,
  paymentExemptReason,
  assignedTeachers,
  allTeachers,
  isAdmin,
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
          currentPaymentDate={nextPaymentDate}
          currentBlocked={blocked}
          currentStudentType={studentType}
          currentCanCreateOwnRoutines={canCreateOwnRoutines}
          currentPaymentExempt={paymentExempt ?? false}
          currentPaymentExemptReason={paymentExemptReason ?? null}
          assignedTeachers={assignedTeachers}
          allTeachers={allTeachers}
          isAdmin={isAdmin ?? false}
          onClose={() => setOpen(false)}
          demo={demo}
        />
      )}
    </>
  );
}
