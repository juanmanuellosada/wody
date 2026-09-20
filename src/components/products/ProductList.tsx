"use client";

import { createCategory, createProduct, deleteProduct, updateProduct } from "@/actions/product";
import { ProductListView } from "@/components/products/ProductListView";
import type { ProductListViewProps } from "@/components/products/ProductListView";

type Props = Omit<ProductListViewProps, "onDeleteProduct" | "onCreateProduct" | "onUpdateProduct" | "onCreateCategory">;

/** Production adapter retaining the public product-list API and live product actions. */
export function ProductList({ products, categories, previewCode }: Props) {
  return (
    <ProductListView
      products={products}
      categories={categories}
      previewCode={previewCode}
      onDeleteProduct={deleteProduct}
      onCreateProduct={createProduct}
      onUpdateProduct={updateProduct}
      onCreateCategory={createCategory}
    />
  );
}
