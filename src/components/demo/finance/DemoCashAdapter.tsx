"use client";

import { useMemo } from "react";
import { CajaShell } from "@/components/caja/CajaShell";
import { RegisterPaymentSectionView } from "@/components/payments/RegisterPaymentSectionView";
import { Button } from "@/components/ui/Button";
import { selectFeeStudents, type FeeRole } from "./fees-contract";
import { projectFinancePaymentStudents } from "./finance-demo-adapters";
import { projectSaleDemoCatalog } from "./sale-demo-adapters";
import { demoFeeIdentities } from "./fees-fixtures";
import { NewSaleButtonView } from "@/components/sales/NewSaleButtonView";
import { useDemoFinance } from "./DemoFinanceProvider";
import { DemoExpenseAction, DemoRevenueAdapter } from "./DemoRevenueAdapter";

const identitiesByRole = {
  ADMIN: demoFeeIdentities.admin,
  TEACHER: demoFeeIdentities.teacher,
};

export function DemoCashAdapter({ role }: { role: FeeRole }) {
  const finance = useDemoFinance();
  const callback = finance.callbacks?.[role] ?? null;
  const saleCallback = finance.saleCallbacks?.[role] ?? null;
  const identity = identitiesByRole[role];
  const students = useMemo(() => {
    const visibleIds = new Set(selectFeeStudents(finance.state.students, identity).map((student) => student.id));
    return projectFinancePaymentStudents(finance.state).filter((student) => visibleIds.has(student.id));
  }, [finance.state, identity]);
  const saleCatalog = useMemo(() => projectSaleDemoCatalog(finance.state, identity), [finance.state, identity]);

  if (!finance.ready || !callback || !saleCallback) {
    return (
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:py-10">
        <p className="text-sm text-gray-500 font-body italic">Preparando caja ficticia…</p>
      </main>
    );
  }

  return (
    <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:py-10">
      <CajaShell
        key={finance.resetEpoch}
        saleAction={(
          <NewSaleButtonView
            key={finance.resetEpoch}
            products={saleCatalog}
            size="lg"
            datePolicy={finance.saleDatePolicy}
            onRegisterSale={saleCallback}
          />
        )}
        expenseAction={role === "ADMIN" ? <DemoExpenseAction /> : null}
        quotaAction={(
          <RegisterPaymentSectionView
            students={students}
            size="lg"
            variant="primary"
            label="Registrar cuota"
            datePolicy={{ today: () => finance.today }}
            onRegisterPayment={callback}
            onCancelPendingDuplicate={callback.cancelPendingDuplicate}
          />
        )}
      >
        <div className="flex flex-col gap-4">
          <p className="border border-brand-red/40 bg-brand-red/10 p-3 text-sm font-body text-gray-200">
            Datos ficticios guardados solo en esta pestaña. Registrar cuotas, ventas o gastos actualiza el informe local y no genera recibos, cobros ni checkout reales.
          </p>
          {finance.warning && (
            <p className="border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm font-body text-yellow-100" role="status">
              {finance.warning}
            </p>
          )}
          {role === "ADMIN" && <DemoRevenueAdapter />}
          <div>
            <Button variant="ghost" size="sm" onClick={finance.reset}>
              Restablecer datos financieros
            </Button>
            <p className="mt-2 text-xs text-gray-500 font-body">
              Solo se restablecen el catálogo, las ventas, las cuotas y los pagos ficticios de esta demostración; entrenamiento y turnos no cambian.
            </p>
          </div>
        </div>
      </CajaShell>
    </main>
  );
}
