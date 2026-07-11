import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gymPath, isPersonalGym } from "@/lib/gym";
import { previewNextProductCode } from "@/actions/product";
import { ProductList } from "@/components/products/ProductList";
import { CategoryManager } from "@/components/products/CategoryManager";

interface Props {
  params: Promise<{ gymSlug: string }>;
}

export default async function ProductosPage({ params }: Props) {
  const { gymSlug } = await params;
  const session = await auth();

  if (session?.user && session.user.gymKind && isPersonalGym(session.user.gymKind)) {
    redirect("/personal/dashboard/mis-rutinas");
  }

  if (!session?.user || session.user.role !== "ADMIN") {
    redirect(gymPath(gymSlug, "/login"));
  }

  if (!session.user.gymId) {
    redirect(gymPath(gymSlug, "/login"));
  }

  const gymId = session.user.gymId;

  // Lee canViewRevenue fresco desde la DB (no confiar en el token, que puede
  // estar stale si el admin fue designado/revocado recién).
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { canViewRevenue: true },
  });
  if (!dbUser?.canViewRevenue) {
    redirect(gymPath(gymSlug, "/caja"));
  }

  const [categories, products, previewCode] = await Promise.all([
    prisma.productCategory.findMany({
      where: { gymId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.product.findMany({
      where: { gymId, deletedAt: null },
      orderBy: { code: "asc" },
      select: { id: true, code: true, description: true, categoryId: true, salePrice: true, stock: true },
    }),
    previewNextProductCode(gymId),
  ]);

  const productRows = products.map((p) => ({
    id: p.id,
    code: p.code,
    description: p.description,
    categoryId: p.categoryId,
    salePrice: Number(p.salePrice),
    stock: p.stock,
  }));

  return (
    <div className="flex flex-col gap-8">
      <div className="border border-line bg-panel p-6 sm:p-8">
        <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-brand-red mb-1">
          Catálogo
        </p>
        <h1 className="text-2xl sm:text-3xl font-heading font-black uppercase tracking-[0.1em] text-white">
          Productos
        </h1>
      </div>

      <CategoryManager initialCategories={categories} />

      <ProductList products={productRows} categories={categories} previewCode={previewCode} />
    </div>
  );
}
