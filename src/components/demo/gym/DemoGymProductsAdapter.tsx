"use client";

import { useCallback, useState } from "react";
import { CategoryManagerView } from "@/components/products/CategoryManagerView";
import { ProductListView } from "@/components/products/ProductListView";
import { Button } from "@/components/ui/Button";
import { projectGymCatalogDemoManagement } from "@/components/demo/finance/gym-catalog-demo-adapters";
import { getGymDemoActorToken } from "@/components/demo/scenarios/gym-demo-directory";
import { useDemoGym } from "./DemoGymProvider";
import { useDemoGymFinance } from "./DemoGymFinanceProvider";
import { Warning } from "./DemoGymFeesAdapter";

/** Admin-only catalog mount over the isolated GYM finance ledger. */
export function DemoGymProductsAdapter() {
  const gym = useDemoGym();
  const finance = useDemoGymFinance();
  const [inlineCategoryId, setInlineCategoryId] = useState<string | null>(null);
  const actor = gym.selectedActor;
  const token = getGymDemoActorToken(actor.id);
  // The designated-admin guard runs before the state projector sees a ledger.
  const callbacks = actor.role === "ADMIN" && token ? finance.catalogCallbacks?.get(actor.id) ?? null : null;
  const management = callbacks && token ? projectGymCatalogDemoManagement(finance.state, token) : null;
  const hasCommittedInlineCategory = inlineCategoryId !== null && management?.success === true
    && management.categories.some((category) => category.id === inlineCategoryId);
  const managerKey = `${actor.id}:${finance.resetEpoch}:${hasCommittedInlineCategory ? inlineCategoryId : ""}`;

  const createCategoryForProduct = useCallback(async (name: string) => {
    if (!callbacks) return { success: false as const, error: "No autorizado." };
    const result = await callbacks.createCategory(name);
    if (result.success) setInlineCategoryId(result.category.id);
    return result;
  }, [callbacks]);

  if (!finance.ready || !gym.ready) return <Loading />;
  if (!callbacks || !management || !management.success) return <Failure error={management && !management.success ? management.error : "No tenés acceso para administrar el catálogo de demostración."} />;

  return (
    <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:py-10">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-heading font-black uppercase tracking-[0.1em] text-white">Productos</h1>
          <p className="mt-2 text-sm text-gray-500 font-body">Catálogo de demostración guardado solo en esta pestaña. No crea productos, ventas ni movimientos reales.</p>
        </div>
        {finance.warning && <Warning message={finance.warning} />}
        <div>
          <Button variant="ghost" size="sm" onClick={finance.reset}>Restablecer datos financieros</Button>
          <p className="mt-2 text-xs text-gray-500 font-body">Solo se restablecen catálogo, ventas, cuotas y gastos de demostración; entrenamiento, PRs, accesos y turnos no cambian.</p>
        </div>
        <ProductListView
          key={`${actor.id}:${finance.resetEpoch}`}
          products={management.products}
          categories={management.categories}
          previewCode={management.previewCode}
          onCreateProduct={callbacks.createProduct}
          onUpdateProduct={callbacks.updateProduct}
          onDeleteProduct={callbacks.deleteProduct}
          onCreateCategory={createCategoryForProduct}
        />
        <CategoryManagerView
          key={managerKey}
          initialCategories={management.categories}
          onCreateCategory={callbacks.createCategory}
          onUpdateCategory={callbacks.updateCategory}
          onDeleteCategory={callbacks.deleteCategory}
        />
      </div>
    </main>
  );
}

function Loading() { return <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:py-10"><p className="text-sm text-gray-500 font-body italic">Preparando catálogo de demostración…</p></main>; }
function Failure({ error }: { error: string }) { return <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:py-10"><p role="alert" className="border border-brand-red/40 bg-brand-red/10 p-3 text-sm font-body text-gray-200">{error}</p></main>; }
