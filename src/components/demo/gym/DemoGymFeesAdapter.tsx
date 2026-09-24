"use client";

import { useMemo, useState } from "react";
import { PaymentControlView } from "@/components/payments/PaymentControlView";
import { RegisterPaymentSectionView } from "@/components/payments/RegisterPaymentSectionView";
import { StudentTypeSelectView } from "@/components/StudentTypeSelectView";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { FeeStatusFilter, FeeStudentType } from "@/components/demo/finance/fees-contract";
import { projectGymFinanceFeesData, projectGymFinancePaymentStudentSelection, type GymFinanceFeesProfileOverride } from "@/components/demo/finance/gym-finance-demo-projection";
import { getGymDemoActorToken } from "@/components/demo/scenarios/gym-demo-directory";
import { DemoGymProfileEditorView } from "./DemoGymProfileEditorView";
import { useDemoGym } from "./DemoGymProvider";
import { useDemoGymFinance } from "./DemoGymFinanceProvider";
import { useDemoGymProfile, type GymDemoProfileActorCallbacks, type GymDemoProfileCallbackResult } from "./DemoGymProfileProvider";

const statusKeys: FeeStatusFilter[] = ["all", "overdue", "due-soon", "ok", "exempt"];

const UNAVAILABLE_ERROR = "La edición de perfiles todavía no está disponible.";
const UNEXPECTED_ERROR = "No se pudo completar la operación.";

type FeeRowActionsProps = {
  studentId: string;
  isAdmin: boolean;
  callbacks: GymDemoProfileActorCallbacks | null;
  name: string;
  blockedAt: string | null;
  paymentExempt: boolean;
  paymentExemptReason: string | null;
};

/**
 * One "Editar" + (ADMIN-only) "Bloquear" row pair; the core, not this component, decides who may
 * act. Exported only so its wiring can be tested in isolation from the full Cuotas screen.
 */
export function DemoGymFeeRowActions({
  studentId,
  isAdmin,
  callbacks,
  name,
  blockedAt,
  paymentExempt,
  paymentExemptReason,
}: FeeRowActionsProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState(name);
  const [exemptReason, setExemptReason] = useState(paymentExemptReason ?? "");
  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: (actorCallbacks: GymDemoProfileActorCallbacks) => Promise<GymDemoProfileCallbackResult>): Promise<boolean> {
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
    setError(null);
    setEditOpen(true);
  }

  function handleSaveName() {
    void run((c) => c.editStudent(studentId, editName));
  }
  function handleToggleExempt() {
    const reason = exemptReason.trim() || null;
    void run((c) => c.setPaymentExempt(studentId, !paymentExempt, reason));
  }
  function handleConfirmBlock() {
    void run((c) => c.setBlocked(studentId, blockedAt === null)).then(() => setBlockConfirmOpen(false));
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center justify-end gap-2 flex-wrap">
        <Button variant="ghost" size="sm" onClick={openEditor} disabled={pending}>
          Editar
        </Button>
        {isAdmin && (
          <Button variant="ghost" size="sm" onClick={() => setBlockConfirmOpen(true)} disabled={pending}>
            {blockedAt !== null ? "Desbloquear" : "Bloquear"}
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
        title={blockedAt !== null ? "Desbloquear alumno" : "Bloquear alumno"}
        message={
          blockedAt !== null
            ? "¿Desbloquear a este alumno? Va a poder ingresar de nuevo."
            : "¿Bloquear a este alumno? No va a poder ingresar hasta que lo desbloquees."
        }
        confirmLabel={blockedAt !== null ? "Desbloquear" : "Bloquear"}
        variant={blockedAt !== null ? "primary" : "danger"}
        loading={pending}
        onConfirm={handleConfirmBlock}
        onCancel={() => setBlockConfirmOpen(false)}
      />
    </div>
  );
}

/** GYM Cuotas bridge: canonical selected identity scopes both list and payment picker. */
export function DemoGymFeesAdapter() {
  const gym = useDemoGym();
  const finance = useDemoGymFinance();
  const { profileState, commandCallbacks: profileCommandCallbacks } = useDemoGymProfile();
  const [activeFilter, setActiveFilter] = useState<FeeStatusFilter>("all");
  const [activeType, setActiveType] = useState<FeeStudentType | "">("");
  const actor = gym.selectedActor;
  const token = getGymDemoActorToken(actor.id);
  const paymentCallbacks = token ? finance.paymentCallbacks?.get(actor.id) ?? null : null;
  const profileActorCallbacks = profileCommandCallbacks?.get(actor.id) ?? null;
  // Display-level overlay for the three bridge-editable, Cuotas-visible attributes. Canonical-only
  // fields (id, email, accountKind, deletedAt, memberNumber, role) are never sourced from here.
  const profileOverrides = useMemo(() => new Map<string, GymFinanceFeesProfileOverride>(
    profileState.students.map((student) => [student.id, {
      name: student.name,
      blocked: student.blockedAt !== null,
      paymentExempt: student.paymentExempt,
      paymentExemptReason: student.paymentExemptReason,
    }]),
  ), [profileState]);
  // Threads the bridge's teacher-student links into the same scoping/authorization resolution
  // canRecordFinancePayment uses, so a TEACHER never sees a student they cannot charge or vice
  // versa. Omitted, both fall back to the canonical directory link set (see gym-finance-demo-projection.ts).
  const fees = useMemo(() => token && finance.ready
    ? projectGymFinanceFeesData(finance.state, token, finance.today, activeFilter, activeType, profileOverrides, profileState.links)
    : null, [activeFilter, activeType, finance.ready, finance.state, finance.today, token, profileOverrides, profileState.links]);
  const paymentStudents = useMemo(() => token && finance.ready
    ? projectGymFinancePaymentStudentSelection(finance.state, token, profileOverrides, profileState.links)
    : null, [finance.ready, finance.state, token, profileOverrides, profileState.links]);
  const profileStudentsById = useMemo(() => new Map(profileState.students.map((s) => [s.id, s])), [profileState]);
  const rowActions = useMemo(() => Object.fromEntries((fees?.success ? fees.rows : []).map((row) => [row.id, (
    // Keyed by actor, not just row.id: local edit-modal/pending/error state is UI state for the
    // profile bridge, which the outer route remount already scopes to actor+finance.resetEpoch
    // (DemoGymFinanceRoute.tsx), but that is this component's caller's behavior, not a guarantee
    // this component owns. Scoping the key here too means a stale open editor or lingering error
    // cannot survive a persona switch even if a future caller mounts this without that remount.
    // finance.resetEpoch is deliberately NOT part of this key: it invalidates financial/payment
    // state (why RegisterPaymentSectionView below keys on it), not profile-bridge edits, which
    // finance.reset() never touches. The profile bridge has its own resetEpoch, but nothing in the
    // UI calls profile.reset() yet, so adding it now would guard a path that cannot occur; revisit
    // if/when a profile reset control is wired in.
    <DemoGymFeeRowActions
      key={`${actor.id}:${row.id}`}
      studentId={row.id}
      isAdmin={actor.role === "ADMIN"}
      callbacks={profileActorCallbacks}
      name={row.name}
      blockedAt={profileStudentsById.get(row.id)?.blockedAt ?? null}
      paymentExempt={row.paymentExempt}
      paymentExemptReason={row.paymentExemptReason}
    />
  )])), [fees, profileStudentsById, actor.id, actor.role, profileActorCallbacks]);

  if (!finance.ready || !gym.ready || !token || !fees || !paymentStudents || actor.role === "STUDENT") return <Loading />;
  if (!fees.success || !paymentStudents.success || !paymentCallbacks) return <Failure error={!fees.success ? fees.error : !paymentStudents.success ? paymentStudents.error : "No se pudo preparar el registro de cuotas."} />;

  return (
    <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:py-10">
      <div className="flex flex-col gap-6">
        <PaymentControlView
          rows={fees.rows}
          counts={fees.counts}
          activeFilter={activeFilter}
          typeControl={<StudentTypeSelectView gymKind="GYM" value={activeType} onChange={(next) => setActiveType(next as FeeStudentType | "")} />}
          statusTiles={statusKeys.map((key) => ({ key, onSelect: () => setActiveFilter(key) }))}
          emptyMessage={actor.role === "TEACHER" ? "No tenés alumnos asignados." : "No hay alumnos cargados todavía."}
          rowActions={rowActions}
          notice={<p className="border border-brand-red/40 bg-brand-red/10 p-3 text-sm font-body text-gray-200">Datos de demostración guardados solo en esta pestaña. Podés editar el nombre, bloquear o desbloquear y marcar exenciones de pago; los cambios se guardan en el puente de perfiles de esta pestaña.</p>}
        />
        <RegisterPaymentSectionView
          key={`${actor.id}:${finance.resetEpoch}`}
          students={paymentStudents.students}
          size="lg"
          variant="primary"
          label="Registrar cuota"
          datePolicy={{ today: () => finance.today }}
          onRegisterPayment={paymentCallbacks}
          onCancelPendingDuplicate={paymentCallbacks.cancelPendingDuplicate}
        />
        {finance.warning && <Warning message={finance.warning} />}
      </div>
    </main>
  );
}

function Loading() { return <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:py-10"><p className="text-sm text-gray-500 font-body italic">Preparando cuotas de demostración…</p></main>; }
function Failure({ error }: { error: string }) { return <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:py-10"><p role="alert" className="border border-brand-red/40 bg-brand-red/10 p-3 text-sm font-body text-gray-200">{error}</p></main>; }
export function Warning({ message }: { message: string }) { return <p className="border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm font-body text-yellow-100" role="status">{message}</p>; }
