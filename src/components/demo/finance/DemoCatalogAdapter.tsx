"use client";

import { useCallback, useState } from "react";
import { CategoryManagerView } from "@/components/products/CategoryManagerView";
import { ProductListView } from "@/components/products/ProductListView";
import { Button } from "@/components/ui/Button";
import { projectCatalogDemoManagement } from "./catalog-demo-adapters";
import { financeCatalogSaleActors } from "./catalog-sales-contract";
import { useDemoFinance } from "./DemoFinanceProvider";

/** Mounts the extracted catalog presentation over the designated fictional admin's local state. */
export function DemoCatalogAdapter() {
  const finance = useDemoFinance();
  const [inlineCategoryId, setInlineCategoryId] = useState<string | null>(null);
  const management = projectCatalogDemoManagement(finance.state, financeCatalogSaleActors.admin);
  const callbacks = finance.catalogCallbacks;
  const hasCommittedInlineCategory = inlineCategoryId !== null
    && management?.categories.some((category) => category.id === inlineCategoryId) === true;
  const managerKey = `${finance.resetEpoch}:${hasCommittedInlineCategory ? inlineCategoryId : ""}`;

  const createCategoryForProduct = useCallback(async (name: string) => {
    if (!callbacks) return { success: false as const, error: "No autorizado." };
    const result = await callbacks.createCategory(name);
    if (result.success) setInlineCategoryId(result.category.id);
    return result;
  }, [callbacks]);

  if (!finance.ready) {
    return (
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:py-10">
        <p className="text-sm text-gray-500 font-body italic">Preparando catálogo ficticio…</p>
      </main>
    );
  }

  if (!callbacks || !management) {
    return (
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:py-10">
        <p className="border border-brand-red/40 bg-brand-red/10 p-3 text-sm font-body text-gray-200" role="alert">
          No tenés acceso para administrar el catálogo de demostración.
        </p>
      </main>
    );
  }

  return (
    <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:py-10">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-heading font-black uppercase tracking-[0.1em] text-white">Productos</h1>
          <p className="mt-2 text-sm text-gray-500 font-body">
            Catálogo ficticio guardado solo en esta pestaña. No crea productos, ventas ni movimientos reales.
          </p>
        </div>

        {finance.warning && (
          <p className="border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm font-body text-yellow-100" role="status">
            {finance.warning}
          </p>
        )}

        <div>
          <Button variant="ghost" size="sm" onClick={finance.reset}>
            Restablecer datos financieros
          </Button>
          <p className="mt-2 text-xs text-gray-500 font-body">
            Solo se restablecen el catálogo, las cuotas y los pagos ficticios de esta demostración; entrenamiento y turnos no cambian.
          </p>
        </div>

        <ProductListView
          key={finance.resetEpoch}
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
