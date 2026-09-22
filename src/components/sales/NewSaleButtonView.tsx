"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { NewSaleDialogView } from "./NewSaleDialogView";
import type {
  ProductCatalogItem,
  SaleDatePolicy,
  SaleRegistrationCallback,
} from "./sale-view-contracts";

export interface NewSaleButtonViewProps {
  products: ProductCatalogItem[];
  size?: "sm" | "md" | "lg";
  datePolicy?: SaleDatePolicy;
  onRegisterSale: SaleRegistrationCallback;
}

/** Reusable Caja action that owns only local open/close presentation state. */
export function NewSaleButtonView({
  products,
  size = "sm",
  datePolicy,
  onRegisterSale,
}: NewSaleButtonViewProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" size={size} onClick={() => setOpen(true)}>
        Nueva venta
      </Button>
      <NewSaleDialogView
        products={products}
        open={open}
        onClose={() => setOpen(false)}
        datePolicy={datePolicy}
        onRegisterSale={onRegisterSale}
      />
    </>
  );
}
