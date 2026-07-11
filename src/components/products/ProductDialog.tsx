"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { createProduct, updateProduct, createCategory } from "@/actions/product";

export interface ProductCategoryOption {
  id: string;
  name: string;
}

export interface ProductRow {
  id: string;
  code: number;
  description: string;
  categoryId: string;
  salePrice: number;
  stock: number;
}

interface Props {
  categories: ProductCategoryOption[];
  previewCode: number;
  /** Presente = modo edición. */
  product?: ProductRow;
  onClose: () => void;
}

export function ProductDialog({ categories: initialCategories, previewCode, product, onClose }: Props) {
  const isEdit = !!product;
  const [categories, setCategories] = useState(initialCategories);
  const [description, setDescription] = useState(product?.description ?? "");
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? categories[0]?.id ?? "");
  const [salePrice, setSalePrice] = useState(product ? String(product.salePrice) : "");
  const [stock, setStock] = useState(product ? String(product.stock) : "0");
  const [manualCode, setManualCode] = useState(isEdit);
  const [code, setCode] = useState(String(product?.code ?? previewCode));
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isCreatingCategory, startCategoryTransition] = useTransition();

  function handleCreateCategory() {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    setError(null);
    startCategoryTransition(async () => {
      const result = await createCategory(trimmed);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setCategories((prev) => [...prev, result.category]);
      setCategoryId(result.category.id);
      setNewCategoryName("");
      setAddingCategory(false);
    });
  }

  function validate():
    | { ok: false }
    | { ok: true; parsedPrice: number; parsedStock: number; parsedCode?: number } {
    if (!description.trim()) {
      setError("La descripción es obligatoria.");
      return { ok: false };
    }
    if (!categoryId) {
      setError("Seleccioná una categoría.");
      return { ok: false };
    }
    const parsedPrice = parseFloat(salePrice.replace(",", "."));
    if (!salePrice.trim() || isNaN(parsedPrice) || parsedPrice < 0) {
      setError("El precio debe ser mayor o igual a cero.");
      return { ok: false };
    }
    const parsedStock = parseInt(stock, 10);
    if (stock.trim() === "" || isNaN(parsedStock) || !Number.isInteger(parsedStock)) {
      setError("El stock debe ser un número entero.");
      return { ok: false };
    }
    let parsedCode: number | undefined;
    if (isEdit || manualCode) {
      parsedCode = parseInt(code, 10);
      if (!code.trim() || isNaN(parsedCode) || parsedCode <= 0) {
        setError("El código debe ser un número entero positivo.");
        return { ok: false };
      }
    }
    return { ok: true, parsedPrice, parsedStock, parsedCode };
  }

  function handleConfirm() {
    const v = validate();
    if (!v.ok) return;
    setError(null);
    startTransition(async () => {
      const result = isEdit
        ? await updateProduct(product!.id, {
            description: description.trim(),
            categoryId,
            salePrice: v.parsedPrice,
            stock: v.parsedStock,
            code: v.parsedCode,
          })
        : await createProduct({
            description: description.trim(),
            categoryId,
            salePrice: v.parsedPrice,
            stock: v.parsedStock,
            code: v.parsedCode,
          });
      if (!result.success) {
        setError(result.error);
      } else {
        onClose();
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={(e) => e.target === e.currentTarget && !isPending && onClose()}
    >
      <div className="bg-panel border border-edge p-6 w-full max-w-md mx-4 flex flex-col gap-4">
        <h3 className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-white">
          {isEdit ? "Editar producto" : "Nuevo producto"}
        </h3>

        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">
              Descripción
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isPending}
              placeholder="Ej: Proteína x1kg"
              autoFocus
              className="w-full bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200 placeholder:text-gray-600"
            />
          </div>

          <div>
            <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">
              Categoría
            </label>
            {categories.length > 0 && (
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={isPending}
                className="w-full bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200 cursor-pointer mb-2"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
            {addingCategory ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  disabled={isCreatingCategory}
                  placeholder="Nombre de la categoría"
                  className="flex-1 bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200 placeholder:text-gray-600"
                />
                <Button variant="secondary" size="sm" onClick={handleCreateCategory} loading={isCreatingCategory}>
                  Crear
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAddingCategory(false);
                    setNewCategoryName("");
                  }}
                  disabled={isCreatingCategory}
                >
                  Cancelar
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingCategory(true)}
                disabled={isPending}
                className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 hover:text-brand-red transition-colors duration-200 cursor-pointer"
              >
                + Nueva categoría
              </button>
            )}
          </div>

          <div>
            <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">
              Precio de venta
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-body pointer-events-none select-none">
                $
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={salePrice}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "" || /^\d*([.,]\d{0,2})?$/.test(raw)) {
                    setSalePrice(raw);
                  }
                }}
                disabled={isPending}
                placeholder="Ej: 5000"
                className="w-full bg-elev border border-edge text-white text-sm font-body pl-7 pr-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200 placeholder:text-gray-600"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">
              Stock
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={stock}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "" || /^-?\d*$/.test(raw)) setStock(raw);
              }}
              disabled={isPending}
              className="w-full bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200"
            />
          </div>

          <div>
            <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">
              Código
            </label>
            {!isEdit && (
              <label className="flex items-center gap-2 mb-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={manualCode}
                  onChange={(e) => setManualCode(e.target.checked)}
                  disabled={isPending}
                />
                <span className="text-xs text-gray-400 font-body">Ingresar código manualmente</span>
              </label>
            )}
            {isEdit || manualCode ? (
              <input
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "" || /^\d*$/.test(raw)) setCode(raw);
                }}
                disabled={isPending}
                className="w-full bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200"
              />
            ) : (
              <p className="text-xs text-gray-500 font-body italic">
                Se asignará automáticamente: #{String(previewCode).padStart(4, "0")}
              </p>
            )}
          </div>
        </div>

        {error && (
          <p className="text-xs font-heading font-bold text-brand-red uppercase tracking-wide" role="alert">
            {error}
          </p>
        )}

        <div className="flex gap-3 justify-end">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" onClick={handleConfirm} loading={isPending}>
            {isEdit ? "Guardar" : "Crear"}
          </Button>
        </div>
      </div>
    </div>
  );
}
