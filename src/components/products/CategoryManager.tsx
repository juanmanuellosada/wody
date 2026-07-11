"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { createCategory, deleteCategory } from "@/actions/product";
import type { ProductCategoryOption } from "@/components/products/ProductDialog";

interface Props {
  initialCategories: ProductCategoryOption[];
}

export function CategoryManager({ initialCategories }: Props) {
  const [categories, setCategories] = useState(initialCategories);
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, startCreateTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<ProductCategoryOption | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  function handleCreate() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setCreateError(null);
    startCreateTransition(async () => {
      const result = await createCategory(trimmed);
      if (!result.success) {
        setCreateError(result.error);
        return;
      }
      setCategories((prev) => [...prev, result.category]);
      setNewName("");
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    startDeleteTransition(async () => {
      const result = await deleteCategory(deleteTarget.id);
      if (!result.success) {
        setDeleteError(result.error);
      } else {
        setCategories((prev) => prev.filter((c) => c.id !== deleteTarget.id));
        setDeleteTarget(null);
      }
    });
  }

  return (
    <div className="border border-line p-4 flex flex-col gap-3">
      <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500">
        Categorías
      </p>

      {categories.length === 0 ? (
        <p className="text-sm text-gray-500 font-body italic">Todavía no hay categorías.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-2 bg-elev border border-edge px-3 py-1.5 text-xs font-body text-gray-300"
            >
              {c.name}
              <button
                type="button"
                onClick={() => {
                  setDeleteError(null);
                  setDeleteTarget(c);
                }}
                className="text-gray-500 hover:text-brand-red transition-colors duration-200 cursor-pointer"
                aria-label={`Eliminar categoría ${c.name}`}
              >
                &#215;
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          disabled={isCreating}
          placeholder="Nueva categoría"
          className="flex-1 bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200 placeholder:text-gray-600"
        />
        <Button variant="secondary" size="sm" onClick={handleCreate} loading={isCreating}>
          Agregar
        </Button>
      </div>

      {createError && (
        <p className="text-xs font-heading font-bold text-brand-red uppercase tracking-wide" role="alert">
          {createError}
        </p>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar categoría"
        message={deleteTarget ? `¿Eliminar la categoría "${deleteTarget.name}"?` : ""}
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
        <p className="text-xs font-heading font-bold text-brand-red uppercase tracking-wide" role="alert">
          {deleteError}
        </p>
      )}
    </div>
  );
}
