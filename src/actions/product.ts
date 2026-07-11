"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { gymPath } from "@/lib/gym";

export type ProductResult =
  | { success: true }
  | { success: false; error: string };

export type CreateProductResult =
  | { success: true; code: number }
  | { success: false; error: string };

/** Guard: ADMIN + canViewRevenue fresco de DB (gestión de productos/categorías). */
async function assertCanManageProducts() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { ok: false as const, error: "No autorizado." };
  }
  if (!session.user.gymId || !session.user.gymSlug) {
    return { ok: false as const, error: "No autorizado." };
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { canViewRevenue: true },
  });
  if (!dbUser?.canViewRevenue) {
    return { ok: false as const, error: "No autorizado." };
  }

  return { ok: true as const, session, gymId: session.user.gymId, gymSlug: session.user.gymSlug };
}

function revalidateProductViews(gymSlug: string) {
  revalidatePath(gymPath(gymSlug, "/productos"));
  revalidatePath(gymPath(gymSlug, "/caja"));
}

/** Devuelve una estimación del próximo código de producto para un gym (MAX(code) + 1 entre activos). */
export async function previewNextProductCode(gymId: string): Promise<number> {
  const row = await prisma.product.aggregate({
    where: { gymId, deletedAt: null },
    _max: { code: true },
  });
  return (row._max.code ?? 0) + 1;
}

export async function createProduct(data: {
  description: string;
  categoryId: string;
  salePrice: number;
  stock: number;
  code?: number;
}): Promise<CreateProductResult> {
  const check = await assertCanManageProducts();
  if (!check.ok) return { success: false, error: check.error };

  const description = data.description.trim();
  if (!description) return { success: false, error: "La descripción es obligatoria." };
  if (!Number.isFinite(data.salePrice) || data.salePrice < 0) {
    return { success: false, error: "El precio debe ser mayor o igual a cero." };
  }
  if (!Number.isInteger(data.stock)) {
    return { success: false, error: "El stock debe ser un número entero." };
  }
  if (data.code !== undefined && (!Number.isInteger(data.code) || data.code <= 0)) {
    return { success: false, error: "El código debe ser un número entero positivo." };
  }

  const gymId = check.gymId;

  const category = await prisma.productCategory.findFirst({
    where: { id: data.categoryId, gymId },
  });
  if (!category) return { success: false, error: "Categoría no encontrada." };

  // Código manual: se valida la unicidad directamente, sin tocar el contador.
  if (data.code !== undefined) {
    try {
      await prisma.product.create({
        data: {
          gymId,
          code: data.code,
          description,
          categoryId: data.categoryId,
          salePrice: data.salePrice,
          stock: data.stock,
        },
      });
      revalidateProductViews(check.gymSlug);
      return { success: true, code: data.code };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return { success: false, error: "Ya existe un producto con ese código en este gym." };
      }
      throw error;
    }
  }

  // Código autogenerado: mismo patrón transacción-con-fallback-P2002 que memberNumber (user.ts).
  const runCreate = () =>
    prisma.$transaction(async (tx) => {
      const gym = await tx.gym.update({
        where: { id: gymId },
        data: { nextProductCode: { increment: 1 } },
        select: { nextProductCode: true },
      });
      const assigned = gym.nextProductCode - 1;
      await tx.product.create({
        data: {
          gymId,
          code: assigned,
          description,
          categoryId: data.categoryId,
          salePrice: data.salePrice,
          stock: data.stock,
        },
      });
      return assigned;
    });

  try {
    const code = await runCreate();
    revalidateProductViews(check.gymSlug);
    return { success: true, code };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const maxRow = await prisma.product.aggregate({
        where: { gymId, deletedAt: null },
        _max: { code: true },
      });
      const correctNext = (maxRow._max.code ?? 0) + 1;
      await prisma.gym.update({ where: { id: gymId }, data: { nextProductCode: correctNext } });
      try {
        const code = await runCreate();
        revalidateProductViews(check.gymSlug);
        return { success: true, code };
      } catch (retryErr) {
        if (retryErr instanceof Prisma.PrismaClientKnownRequestError && retryErr.code === "P2002") {
          return {
            success: false,
            error: "El contador de códigos de producto del gym estaba desincronizado y el reintento también falló. Avisá al equipo técnico.",
          };
        }
        throw retryErr;
      }
    }
    throw error;
  }
}

export async function updateProduct(
  productId: string,
  data: { description?: string; categoryId?: string; salePrice?: number; stock?: number; code?: number }
): Promise<ProductResult> {
  const check = await assertCanManageProducts();
  if (!check.ok) return { success: false, error: check.error };

  const product = await prisma.product.findFirst({ where: { id: productId, deletedAt: null } });
  if (!product || product.gymId !== check.gymId) {
    return { success: false, error: "Producto no encontrado." };
  }

  const updateData: Prisma.ProductUpdateInput = {};

  if (data.description !== undefined) {
    const trimmed = data.description.trim();
    if (!trimmed) return { success: false, error: "La descripción no puede estar vacía." };
    updateData.description = trimmed;
  }
  if (data.categoryId !== undefined) {
    const category = await prisma.productCategory.findFirst({
      where: { id: data.categoryId, gymId: check.gymId },
    });
    if (!category) return { success: false, error: "Categoría no encontrada." };
    updateData.category = { connect: { id: data.categoryId } };
  }
  if (data.salePrice !== undefined) {
    if (!Number.isFinite(data.salePrice) || data.salePrice < 0) {
      return { success: false, error: "El precio debe ser mayor o igual a cero." };
    }
    updateData.salePrice = data.salePrice;
  }
  if (data.stock !== undefined) {
    if (!Number.isInteger(data.stock)) {
      return { success: false, error: "El stock debe ser un número entero." };
    }
    updateData.stock = data.stock;
  }
  if (data.code !== undefined) {
    if (!Number.isInteger(data.code) || data.code <= 0) {
      return { success: false, error: "El código debe ser un número entero positivo." };
    }
    updateData.code = data.code;
  }

  if (Object.keys(updateData).length === 0) {
    return { success: false, error: "No hay cambios para guardar." };
  }

  try {
    await prisma.product.update({ where: { id: productId }, data: updateData });
    revalidateProductViews(check.gymSlug);
    return { success: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { success: false, error: "Ya existe un producto con ese código en este gym." };
    }
    throw error;
  }
}

/** Baja lógica (soft-delete) de un producto: no rompe ventas históricas que lo referencian. */
export async function deleteProduct(productId: string): Promise<ProductResult> {
  const check = await assertCanManageProducts();
  if (!check.ok) return { success: false, error: check.error };

  const product = await prisma.product.findFirst({ where: { id: productId, deletedAt: null } });
  if (!product || product.gymId !== check.gymId) {
    return { success: false, error: "Producto no encontrado." };
  }

  await prisma.product.update({ where: { id: productId }, data: { deletedAt: new Date() } });
  revalidateProductViews(check.gymSlug);
  return { success: true };
}

export type CreateCategoryResult =
  | { success: true; category: { id: string; name: string } }
  | { success: false; error: string };

export async function createCategory(name: string): Promise<CreateCategoryResult> {
  const check = await assertCanManageProducts();
  if (!check.ok) return { success: false, error: check.error };

  const trimmed = name.trim();
  if (!trimmed) return { success: false, error: "El nombre es obligatorio." };

  try {
    const category = await prisma.productCategory.create({
      data: { gymId: check.gymId, name: trimmed },
      select: { id: true, name: true },
    });
    revalidateProductViews(check.gymSlug);
    return { success: true, category };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { success: false, error: "Ya existe una categoría con ese nombre en este gym." };
    }
    throw error;
  }
}

/** Impide eliminar una categoría que todavía tiene productos asociados (incluso inactivos: la FK es Restrict a nivel DB). */
export async function deleteCategory(categoryId: string): Promise<ProductResult> {
  const check = await assertCanManageProducts();
  if (!check.ok) return { success: false, error: check.error };

  const category = await prisma.productCategory.findFirst({
    where: { id: categoryId, gymId: check.gymId },
  });
  if (!category) return { success: false, error: "Categoría no encontrada." };

  const productsCount = await prisma.product.count({
    where: { categoryId },
  });
  if (productsCount > 0) {
    return {
      success: false,
      error: "No podés eliminar una categoría con productos asociados, incluso si están inactivos.",
    };
  }

  try {
    await prisma.productCategory.delete({ where: { id: categoryId } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return {
        success: false,
        error: "No podés eliminar una categoría con productos asociados, incluso si están inactivos.",
      };
    }
    throw error;
  }
  revalidateProductViews(check.gymSlug);
  return { success: true };
}

export interface ProductCatalogItem {
  id: string;
  code: number;
  description: string;
  salePrice: number;
  stock: number;
  categoryName: string;
}

/**
 * Lectura del catálogo de productos del gym, para cualquiera con acceso a
 * Caja (ADMIN + TEACHER) — usado por el diálogo "Nueva venta". Solo lectura:
 * la gestión (crear/editar/eliminar) queda restringida a designados.
 */
export async function getProductCatalog(): Promise<ProductCatalogItem[]> {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")) {
    return [];
  }
  if (!session.user.gymId) return [];

  const products = await prisma.product.findMany({
    where: { gymId: session.user.gymId, deletedAt: null },
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      description: true,
      salePrice: true,
      stock: true,
      category: { select: { name: true } },
    },
  });

  return products.map((p) => ({
    id: p.id,
    code: p.code,
    description: p.description,
    salePrice: Number(p.salePrice),
    stock: p.stock,
    categoryName: p.category.name,
  }));
}
