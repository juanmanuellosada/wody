"use client";

import { useMemo, useState } from "react";
import { PaymentControlView } from "@/components/payments/PaymentControlView";
import { StudentTypeSelectView } from "@/components/StudentTypeSelectView";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DemoGymProfileEditorView } from "@/components/demo/gym/DemoGymProfileEditorView";
import {
  getFeeBlockStatus,
  projectFeeStudents,
  selectFeeStudents,
  type FeeRole,
  type FeeStatusFilter,
  type FeeStudentType,
  type FeeTeacher,
} from "./fees-contract";
import { demoFeeIdentities, demoFeeTeachers } from "./fees-fixtures";
import type { FinanceProfileCallbacks } from "./finance-profile-demo-adapters";
import { useDemoFinance } from "./DemoFinanceProvider";
import type { FinanceProfileResult } from "./finance-demo-types";

const statusKeys: FeeStatusFilter[] = ["all", "overdue", "due-soon", "ok", "exempt"];

const UNAVAILABLE_ERROR = "La edición de perfiles todavía no está disponible.";
const UNEXPECTED_ERROR = "No se pudo completar la operación.";

type FeeRowActionsProps = {
  studentId: string;
  isAdmin: boolean;
  callbacks: FinanceProfileCallbacks | null;
  name: string;
  blocked: boolean;
  paymentExempt: boolean;
  paymentExemptReason: string | null;
  assignedTeachers: FeeTeacher[];
  availableTeachers: FeeTeacher[];
};

/**
 * One "Editar" + (ADMIN-only) "Bloquear" row pair; the core, not this component, decides who may
 * act. Mirrors DemoGymFeeRowActions' wiring and reuses its presentation-only editor modal, since
 * BOX has no profile bridge to source the equivalent from.
 */
function DemoFeeRowActions({
  studentId,
  isAdmin,
  callbacks,
  name,
  blocked,
  paymentExempt,
  paymentExemptReason,
  assignedTeachers,
  availableTeachers,
}: FeeRowActionsProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState(name);
  const [addTeacherId, setAddTeacherId] = useState("");
  const [exemptReason, setExemptReason] = useState(paymentExemptReason ?? "");
  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: (actorCallbacks: FinanceProfileCallbacks) => Promise<FinanceProfileResult>): Promise<boolean> {
    if (!callbacks) {
      setError(UNAVAILABLE_ERROR);
      return false;
    }
    setPending(true);
    setError(null);
    // A callback that rejects or throws is still a failed command, not a silent one: without this
    // catch, and without pending clearing in `finally` regardless of outcome, the row (and the
    // block ConfirmDialog, whose close is chained off this promise) would stay stuck forever.
    try {
      const result = await action(callbacks);
      if (!result.success) {
        setError(result.error);
        return false;
      }
      return true;
    } catch {
      setError(UNEXPECTED_ERROR);
      return false;
    } finally {
      setPending(false);
    }
  }

  function openEditor() {
    setEditName(name);
    setExemptReason(paymentExemptReason ?? "");
    setAddTeacherId("");
    setError(null);
    setEditOpen(true);
  }

  function handleSaveName() {
    void run((c) => c.editStudent(studentId, editName));
  }
  function handleAssignTeacher() {
    if (!addTeacherId) return;
    const teacherId = addTeacherId;
    void run((c) => c.assignTeacher(studentId, teacherId)).then((ok) => { if (ok) setAddTeacherId(""); });
  }
  function handleUnassignTeacher(teacherId: string) {
    void run((c) => c.unassignTeacher(studentId, teacherId));
  }
  function handleToggleExempt() {
    const reason = exemptReason.trim() || null;
    void run((c) => c.setPaymentExempt(studentId, !paymentExempt, reason));
  }
  function handleConfirmBlock() {
    void run((c) => c.setBlocked(studentId, !blocked)).then(() => setBlockConfirmOpen(false));
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center justify-end gap-2 flex-wrap">
        <Button variant="ghost" size="sm" onClick={openEditor} disabled={pending}>
          Editar
        </Button>
        {isAdmin && (
          <Button variant="ghost" size="sm" onClick={() => setBlockConfirmOpen(true)} disabled={pending}>
            {blocked ? "Desbloquear" : "Bloquear"}
          </Button>
        )}
      </div>
      {!editOpen && error && (
        <p className="text-[10px] font-heading font-bold text-brand-red uppercase tracking-wide text-right" role="alert">
          {error}
        </p>
      )}
      {editOpen && (
        <DemoGymProfileEditorView
          isAdmin={isAdmin}
          name={editName}
          onNameChange={setEditName}
          onSaveName={handleSaveName}
          assignedTeachers={assignedTeachers}
          availableTeachers={availableTeachers}
          addTeacherId={addTeacherId}
          onAddTeacherIdChange={setAddTeacherId}
          onAssignTeacher={handleAssignTeacher}
          onUnassignTeacher={handleUnassignTeacher}
          paymentExempt={paymentExempt}
          paymentExemptReason={exemptReason}
          onPaymentExemptReasonChange={setExemptReason}
          onTogglePaymentExempt={handleToggleExempt}
          pending={pending}
          error={error}
          onClose={() => setEditOpen(false)}
        />
      )}
      <ConfirmDialog
        open={blockConfirmOpen}
        title={blocked ? "Desbloquear alumno" : "Bloquear alumno"}
        message={
          blocked
            ? "¿Desbloquear a este alumno? Va a poder ingresar de nuevo."
            : "¿Bloquear a este alumno? No va a poder ingresar hasta que lo desbloquees."
        }
        confirmLabel={blocked ? "Desbloquear" : "Bloquear"}
        variant={blocked ? "primary" : "danger"}
        loading={pending}
        onConfirm={handleConfirmBlock}
        onCancel={() => setBlockConfirmOpen(false)}
      />
    </div>
  );
}

/** Client-only demo adapter: it reads and writes only shared fictional finance state, local to this tab. */
export function DemoFeesAdapter({ role }: { role: FeeRole }) {
  const finance = useDemoFinance();
  const today = finance.today;
  const [activeFilter, setActiveFilter] = useState<FeeStatusFilter>("all");
  const [activeType, setActiveType] = useState<FeeStudentType | "">("");

  const activeStudents = useMemo(() => (
    selectFeeStudents(finance.state.students, demoFeeIdentities[role === "ADMIN" ? "admin" : "teacher"])
  ), [finance.state.students, role]);
  const projection = useMemo(
    () => finance.ready ? projectFeeStudents(activeStudents, today, activeFilter, activeType) : null,
    [activeFilter, activeStudents, activeType, finance.ready, today],
  );
  const profileCallbacks = finance.profileCallbacks?.[role] ?? null;

  if (!finance.ready || !projection) {
    return (
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:py-10">
        <p className="text-sm text-gray-500 font-body italic">Preparando datos ficticios de cuotas…</p>
      </main>
    );
  }

  const rows = projection.rows.map((row) => ({
    ...row,
    blockStatus: getFeeBlockStatus(row, today, 45),
  }));
  const isAdmin = role === "ADMIN";
  const rowActions = Object.fromEntries(rows.map((row) => {
    const assignedIds = new Set(row.assignedTeachers.map((teacher) => teacher.id));
    return [row.id, (
      <DemoFeeRowActions
        key={row.id}
        studentId={row.id}
        isAdmin={isAdmin}
        callbacks={profileCallbacks}
        name={row.name}
        blocked={row.blocked}
        paymentExempt={row.paymentExempt}
        paymentExemptReason={row.paymentExemptReason}
        assignedTeachers={row.assignedTeachers}
        availableTeachers={demoFeeTeachers.filter((teacher) => !assignedIds.has(teacher.id))}
      />
    )];
  }));
  const hasAnyStudents = activeStudents.length > 0;

  return (
    <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:py-10">
      <PaymentControlView
        rows={rows}
        counts={projection.counts}
        activeFilter={activeFilter}
        typeControl={(
          <StudentTypeSelectView
            gymKind="BOX"
            value={activeType}
            onChange={(next) => setActiveType(next as FeeStudentType | "")}
          />
        )}
        statusTiles={statusKeys.map((key) => ({ key, onSelect: () => setActiveFilter(key) }))}
        emptyMessage={hasAnyStudents ? "No hay alumnos en este estado." : role === "ADMIN" ? "No hay alumnos cargados todavía." : "No tenés alumnos asignados."}
        rowActions={rowActions}
        notice={(
          <p className="border border-brand-red/40 bg-brand-red/10 p-3 text-sm font-body text-gray-200">
            Datos ficticios. Podés editar el nombre, bloquear o desbloquear, marcar exenciones de pago y asignar o quitar profes; los cambios quedan solo en esta pestaña y no modifican datos reales.
          </p>
        )}
      />
    </main>
  );
}
