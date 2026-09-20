"use client";

import { createCategory, createProduct, updateProduct } from "@/actions/product";
import { ProductDialogView } from "@/components/products/ProductDialogView";
import type { ProductDialogViewProps } from "@/components/products/ProductDialogView";

export type { ProductCategoryOption, ProductRow } from "@/components/products/product-view-contracts";

/** Production adapter retaining the public dialog API and live product actions. */
export function ProductDialog({ categories, previewCode, product, onClose }: Omit<ProductDialogViewProps, "onCreateProduct" | "onUpdateProduct" | "onCreateCategory">) {
  return (
    <ProductDialogView
      categories={categories}
      previewCode={previewCode}
      product={product}
      onClose={onClose}
      onCreateProduct={createProduct}
      onUpdateProduct={updateProduct}
      onCreateCategory={createCategory}
    />
  );
}
