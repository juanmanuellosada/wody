"use client";

import { createCategory, deleteCategory, updateCategory } from "@/actions/product";
import { CategoryManagerView } from "@/components/products/CategoryManagerView";
import type { CategoryManagerViewProps } from "@/components/products/CategoryManagerView";

type Props = Omit<CategoryManagerViewProps, "onCreateCategory" | "onDeleteCategory" | "onUpdateCategory">;

/** Production adapter retaining the public category-manager API and live product actions. */
export function CategoryManager({ initialCategories }: Props) {
  return (
    <CategoryManagerView
      initialCategories={initialCategories}
      onCreateCategory={createCategory}
      onDeleteCategory={deleteCategory}
      onUpdateCategory={updateCategory}
    />
  );
}
