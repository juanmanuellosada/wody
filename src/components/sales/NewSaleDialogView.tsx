"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import {
  resolveSaleToday,
  type ProductCatalogItem,
  type SaleDatePolicy,
  type SalePaymentMethod,
  type SaleRegistrationCallback,
} from "./sale-view-contracts";

export type {
  ProductCatalogItem,
  SaleDatePolicy,
  SalePaymentMethod,
  SaleRegistrationCallback,
  SaleRegistrationOptions,
  SaleRegistrationResult,
} from "./sale-view-contracts";

export interface NewSaleDialogViewProps {
  products: ProductCatalogItem[];
  open: boolean;
  onClose: () => void;
  datePolicy?: SaleDatePolicy;
  onRegisterSale: SaleRegistrationCallback;
}

const PAYMENT_METHOD_LABELS: Record<SalePaymentMethod, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  TARJETA: "Tarjeta (débito/crédito)",
  MERCADO_PAGO: "Mercado Pago",
};

const PAYMENT_METHODS: SalePaymentMethod[] = ["EFECTIVO", "TRANSFERENCIA", "TARJETA", "MERCADO_PAGO"];

function formatCode(code: number): string {
  return `#${String(code).padStart(4, "0")}`;
}

/** Typeahead de producto por nombre o código. */
function ProductSearch({
  products,
  value,
  onChange,
  disabled,
}: {
  products: ProductCatalogItem[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const selected = products.find((product) => product.id === value);
  const [query, setQuery] = useState(
    selected ? `${formatCode(selected.code)} — ${selected.description}` : "",
  );
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = query.trim()
    ? products.filter(
        (product) =>
          product.description.toLowerCase().includes(query.toLowerCase()) ||
          String(product.code).includes(query.trim()),
      )
    : products;

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery(selected ? `${formatCode(selected.code)} — ${selected.description}` : "");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, selected]);

  function handleSelect(product: ProductCatalogItem) {
    setQuery(`${formatCode(product.code)} — ${product.description}`);
    setOpen(false);
    onChange(product.id);
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          if (event.target.value === "") onChange("");
        }}
        onFocus={() => setOpen(true)}
        disabled={disabled}
        placeholder="Buscar por nombre o código..."
        autoComplete="off"
        className="w-full bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200 placeholder:text-gray-600 disabled:opacity-50"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 mt-0.5 bg-panel border border-edge shadow-2xl shadow-black/50 max-h-52 overflow-y-auto">
          {filtered.map((product) => (
            <li key={product.id}>
              <button
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  handleSelect(product);
                }}
                className={[
                  "w-full text-left px-3 py-2 text-sm font-body transition-colors duration-150 cursor-pointer flex items-center justify-between gap-2",
                  product.id === value
                    ? "bg-brand-red/15 text-white"
                    : "text-gray-300 hover:bg-elev hover:text-white",
                ].join(" ")}
              >
                <span>
                  {formatCode(product.code)} — {product.description}
                </span>
                <span className="text-xs text-gray-500 flex-shrink-0">stock {product.stock}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && filtered.length === 0 && query.trim() && (
        <div className="absolute z-50 left-0 right-0 mt-0.5 bg-panel border border-edge px-3 py-2 text-xs text-gray-500 font-body italic">
          Sin coincidencias.
        </div>
      )}
    </div>
  );
}

function DialogForm({
  products,
  onClose,
  datePolicy,
  onRegisterSale,
  defaultSoldAt,
}: Omit<NewSaleDialogViewProps, "open"> & { defaultSoldAt: string }) {
  const today = () => resolveSaleToday(datePolicy);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitAmount, setUnitAmount] = useState("");
  const [soldAt, setSoldAt] = useState(defaultSoldAt);
  const [paymentMethod, setPaymentMethod] = useState<SalePaymentMethod>("EFECTIVO");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedProduct = products.find((product) => product.id === productId);

  function handleProductChange(id: string) {
    setProductId(id);
    setError(null);
    const product = products.find((candidate) => candidate.id === id);
    setUnitAmount(product ? String(product.salePrice) : "");
  }

  function validate():
    | { ok: false }
    | { ok: true; parsedQuantity: number; parsedUnitAmount: number } {
    if (!productId) {
      setError("Seleccioná un producto.");
      return { ok: false };
    }
    const parsedQuantity = parseInt(quantity, 10);
    if (!quantity.trim() || isNaN(parsedQuantity) || parsedQuantity < 1) {
      setError("La cantidad debe ser un entero mayor o igual a 1.");
      return { ok: false };
    }
    const parsedUnitAmount = parseFloat(unitAmount.replace(",", "."));
    if (!unitAmount.trim() || isNaN(parsedUnitAmount) || parsedUnitAmount < 0) {
      setError("El importe unitario debe ser mayor o igual a cero.");
      return { ok: false };
    }
    if (!soldAt) {
      setError("Ingresá la fecha de la venta.");
      return { ok: false };
    }
    if (!paymentMethod) {
      setError("Seleccioná el método de pago.");
      return { ok: false };
    }
    return { ok: true, parsedQuantity, parsedUnitAmount };
  }

  function handleConfirm() {
    const validation = validate();
    if (!validation.ok) return;
    setError(null);
    startTransition(async () => {
      const result = await onRegisterSale(productId, validation.parsedQuantity, validation.parsedUnitAmount, {
        soldAtStr: soldAt,
        paymentMethod,
      });
      if (!result.success) {
        setError(result.error);
      } else {
        onClose();
      }
    });
  }

  const parsedQuantityForDisplay = parseInt(quantity, 10);
  const parsedUnitAmountForDisplay = parseFloat(unitAmount.replace(",", "."));
  const total =
    !isNaN(parsedQuantityForDisplay) && !isNaN(parsedUnitAmountForDisplay)
      ? parsedQuantityForDisplay * parsedUnitAmountForDisplay
      : null;

  const willDeplete =
    !!selectedProduct &&
    !isNaN(parsedQuantityForDisplay) &&
    selectedProduct.stock - parsedQuantityForDisplay <= 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={(event) => event.target === event.currentTarget && !isPending && onClose()}
    >
      <div className="bg-panel border border-edge p-6 w-full max-w-md mx-4 flex flex-col gap-4">
        <h3 className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-white">
          Nueva venta
        </h3>

        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">
              Producto
            </label>
            <ProductSearch
              products={products}
              value={productId}
              onChange={handleProductChange}
              disabled={isPending}
            />
          </div>

          {selectedProduct && (
            <p className="text-xs text-gray-500 font-body">
              Precio: ${selectedProduct.salePrice.toLocaleString("es-AR")} · Stock actual: {" "}
              {selectedProduct.stock}
            </p>
          )}

          <div>
            <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">
              Cantidad
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={quantity}
              onChange={(event) => {
                const raw = event.target.value;
                if (raw === "" || /^\d*$/.test(raw)) setQuantity(raw);
              }}
              disabled={isPending}
              className="w-full bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200"
            />
          </div>

          <div>
            <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">
              Importe unitario
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-body pointer-events-none select-none">
                $
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={unitAmount}
                onChange={(event) => {
                  const raw = event.target.value;
                  if (raw === "" || /^\d*([.,]\d{0,2})?$/.test(raw)) setUnitAmount(raw);
                }}
                disabled={isPending}
                placeholder="Ej: 5000"
                className="w-full bg-elev border border-edge text-white text-sm font-body pl-7 pr-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200 placeholder:text-gray-600"
              />
            </div>
          </div>

          {total !== null && (
            <p className="text-sm font-body text-gray-300">
              Total: <span className="text-white font-heading font-bold">${total.toLocaleString("es-AR")}</span>
            </p>
          )}

          {willDeplete && (
            <div className="border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 flex items-start gap-2">
              <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full flex-shrink-0 mt-1" aria-hidden="true" />
              <p className="text-xs text-yellow-400 font-body">
                Esta venta deja el stock en {selectedProduct.stock - parsedQuantityForDisplay}. Se registra igual.
              </p>
            </div>
          )}

          <DatePicker
            value={soldAt}
            onChange={(date) => {
              const maxDate = today();
              if (date > maxDate) return;
              setSoldAt(date);
            }}
            disabled={isPending}
            label="Fecha de la venta"
            max={today()}
          />

          <div>
            <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">
              Método de pago
            </label>
            <select
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value as SalePaymentMethod)}
              disabled={isPending}
              className="w-full bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200 disabled:opacity-50 cursor-pointer"
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {PAYMENT_METHOD_LABELS[method]}
                </option>
              ))}
            </select>
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
            Registrar
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Controlled extracted presentation. Returning null remounts fresh defaults after every open. */
export function NewSaleDialogView({
  products,
  open,
  onClose,
  datePolicy,
  onRegisterSale,
}: NewSaleDialogViewProps) {
  if (!open) return null;
  return (
    <DialogForm
      products={products}
      onClose={onClose}
      datePolicy={datePolicy}
      onRegisterSale={onRegisterSale}
      defaultSoldAt={resolveSaleToday(datePolicy)}
    />
  );
}
