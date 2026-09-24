"use client";

import { useMemo, useState } from "react";
import { PaymentControlView } from "@/components/payments/PaymentControlView";
import { RegisterPaymentSectionView } from "@/components/payments/RegisterPaymentSectionView";
import { StudentTypeSelectView } from "@/components/StudentTypeSelectView";
import type { FeeStatusFilter, FeeStudentType } from "@/components/demo/finance/fees-contract";
import { projectGymFinanceFeesData, projectGymFinancePaymentStudentSelection } from "@/components/demo/finance/gym-finance-demo-projection";
import { getGymDemoActorToken } from "@/components/demo/scenarios/gym-demo-directory";
import { useDemoGym } from "./DemoGymProvider";
import { useDemoGymFinance } from "./DemoGymFinanceProvider";

const statusKeys: FeeStatusFilter[] = ["all", "overdue", "due-soon", "ok", "exempt"];

/** GYM Cuotas bridge: canonical selected identity scopes both list and payment picker. */
export function DemoGymFeesAdapter() {
  const gym = useDemoGym();
  const finance = useDemoGymFinance();
  const [activeFilter, setActiveFilter] = useState<FeeStatusFilter>("all");
  const [activeType, setActiveType] = useState<FeeStudentType | "">("");
  const actor = gym.selectedActor;
  const token = getGymDemoActorToken(actor.id);
  const callbacks = token ? finance.paymentCallbacks?.get(actor.id) ?? null : null;
  const fees = useMemo(() => token && finance.ready
    ? projectGymFinanceFeesData(finance.state, token, finance.today, activeFilter, activeType)
    : null, [activeFilter, activeType, finance.ready, finance.state, finance.today, token]);
  const paymentStudents = useMemo(() => token && finance.ready
    ? projectGymFinancePaymentStudentSelection(finance.state, token)
    : null, [finance.ready, finance.state, token]);

  if (!finance.ready || !gym.ready || !token || !fees || !paymentStudents || actor.role === "STUDENT") return <Loading />;
  if (!fees.success || !paymentStudents.success || !callbacks) return <Failure error={!fees.success ? fees.error : !paymentStudents.success ? paymentStudents.error : "No se pudo preparar el registro de cuotas."} />;

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
          notice={<p className="border border-brand-red/40 bg-brand-red/10 p-3 text-sm font-body text-gray-200">Datos de demostración guardados solo en esta pestaña. La edición de perfiles, bloqueos, exenciones y asignaciones se incorporarán con el puente de perfiles.</p>}
        />
        <RegisterPaymentSectionView
          key={`${actor.id}:${finance.resetEpoch}`}
          students={paymentStudents.students}
          size="lg"
          variant="primary"
          label="Registrar cuota"
          datePolicy={{ today: () => finance.today }}
          onRegisterPayment={callbacks}
          onCancelPendingDuplicate={callbacks.cancelPendingDuplicate}
        />
        {finance.warning && <Warning message={finance.warning} />}
      </div>
    </main>
  );
}

function Loading() { return <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:py-10"><p className="text-sm text-gray-500 font-body italic">Preparando cuotas de demostración…</p></main>; }
function Failure({ error }: { error: string }) { return <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:py-10"><p role="alert" className="border border-brand-red/40 bg-brand-red/10 p-3 text-sm font-body text-gray-200">{error}</p></main>; }
export function Warning({ message }: { message: string }) { return <p className="border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm font-body text-yellow-100" role="status">{message}</p>; }
