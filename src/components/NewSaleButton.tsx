"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { NewSaleDialog } from "@/components/NewSaleDialog";
import type { ProductCatalogItem } from "@/actions/product";

interface Props {
  products: ProductCatalogItem[];
  size?: "sm" | "md" | "lg";
}

/**
 * "Nueva venta" button — disponible en Caja para ADMIN y TEACHER,
 * independientemente de canViewRevenue.
 */
export function NewSaleButton({ products, size = "sm" }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" size={size} onClick={() => setOpen(true)}>
        Nueva venta
      </Button>
      <NewSaleDialog products={products} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
