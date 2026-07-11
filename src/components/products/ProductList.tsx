"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { deleteProduct } from "@/actions/product";
import { ProductDialog, type ProductCategoryOption, type ProductRow } from "@/components/products/ProductDialog";

interface Props {
  products: ProductRow[];
  categories: ProductCategoryOption[];
  previewCode: number;
}

function formatCode(code: number): string {
  return `#${String(code).padStart(4, "0")}`;
}

function formatAmount(value: number): string {
  return value.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function ProductList({ products, categories, previewCode }: Props) {
  const [editing, setEditing] = useState<ProductRow | "new" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  function handleDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    startDeleteTransition(async () => {
      const result = await deleteProduct(deleteTarget.id);
      if (!result.success) {
        setDeleteError(result.error);
      } else {
        setDeleteTarget(null);
      }
    });
  }

  return (
    <div className="border border-line">
      <div className="px-4 py-3 border-b border-line flex items-center justify-between">
        <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500">
          Productos
          <span className="ml-2 text-gray-600">({products.length})</span>
        </p>
        <Button variant="primary" size="sm" onClick={() => setEditing("new")} disabled={categories.length === 0}>
          Nuevo producto
        </Button>
      </div>

      {categories.length === 0 && (
        <p className="px-4 py-3 text-xs text-gray-500 font-body italic">
          Creá primero una categoría para poder cargar productos.
        </p>
      )}

      {products.length === 0 && categories.length > 0 ? (
        <p className="px-4 py-6 text-sm text-gray-500 font-body italic">
          Todavía no hay productos cargados.
        </p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-panel">
                  {["Código", "Descripción", "Categoría", "Precio", "Stock", ""].map((h) => (
                    <th
                      key={h}
                      className="text-left text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 px-4 py-3 border-b border-line"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b border-line last:border-0 hover:bg-hover transition-colors duration-200">
                    <td className="px-4 py-3 text-gray-400 font-body text-xs tabular-nums">{formatCode(p.code)}</td>
                    <td className="px-4 py-3 text-white font-heading font-bold">{p.description}</td>
                    <td className="px-4 py-3 text-gray-400 font-body text-xs">
                      {categories.find((c) => c.id === p.categoryId)?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-white font-heading font-bold tabular-nums">
                      ${formatAmount(p.salePrice)}
                    </td>
                    <td className={["px-4 py-3 font-heading font-bold tabular-nums", p.stock <= 0 ? "text-brand-red" : "text-white"].join(" ")}>
                      {p.stock}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setEditing(p)}>
                          Editar
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => {
                            setDeleteError(null);
                            setDeleteTarget(p);
                          }}
                        >
                          Eliminar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden flex flex-col divide-y divide-line">
            {products.map((p) => (
              <div key={p.id} className="px-4 py-3 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-white font-heading font-bold text-sm">{p.description}</p>
                    <p className="text-gray-500 text-xs font-body">
                      {formatCode(p.code)} · {categories.find((c) => c.id === p.categoryId)?.name ?? "—"}
                    </p>
                  </div>
                  <p className="text-white font-heading font-bold tabular-nums">${formatAmount(p.salePrice)}</p>
                </div>
                <p className={["text-xs font-body", p.stock <= 0 ? "text-brand-red" : "text-gray-600"].join(" ")}>
                  Stock: {p.stock}
                </p>
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(p)}>
                    Editar
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      setDeleteError(null);
                      setDeleteTarget(p);
                    }}
                  >
                    Eliminar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {editing && (
        <ProductDialog
          categories={categories}
          previewCode={previewCode}
          product={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar producto"
        message={deleteTarget ? `¿Eliminar "${deleteTarget.description}"? No afecta las ventas ya registradas.` : ""}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        variant="danger"
        loading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => {
          if (!isDeleting) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
      />

      {deleteError && (
        <div className="px-4 py-2 border-t border-line">
          <p className="text-xs font-heading font-bold text-brand-red uppercase tracking-wide" role="alert">
            {deleteError}
          </p>
        </div>
      )}
    </div>
  );
}
