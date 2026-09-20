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

export type ProductResult =
  | { success: true }
  | { success: false; error: string };

export type CreateProductResult =
  | { success: true; code: number }
  | { success: false; error: string };

export type CreateCategoryResult =
  | { success: true; category: ProductCategoryOption }
  | { success: false; error: string };

export interface ProductInput {
  description: string;
  categoryId: string;
  salePrice: number;
  stock: number;
  code?: number;
}

export type CreateProductCallback = (data: ProductInput) => Promise<CreateProductResult>;
export type UpdateProductCallback = (productId: string, data: ProductInput) => Promise<ProductResult>;
export type DeleteProductCallback = (productId: string) => Promise<ProductResult>;
export type CreateCategoryCallback = (name: string) => Promise<CreateCategoryResult>;
export type UpdateCategoryCallback = (categoryId: string, name: string) => Promise<ProductResult>;
export type DeleteCategoryCallback = (categoryId: string) => Promise<ProductResult>;
