import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { gymPath } from "@/lib/gym";

export const dynamic = "force-dynamic";

export default async function BillingReturnPage() {
  const session = await auth();

  if (!session) {
    redirect("/");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/");
  }

  let slug = session.user.gymSlug;

  if (!slug) {
    // Fallback: resolve slug from gymId if not in session (defensive)
    const gymId = session.user.gymId;
    if (!gymId) {
      redirect("/");
    }
    const gym = await prisma.gym.findUnique({
      where: { id: gymId },
      select: { slug: true },
    });
    if (!gym) {
      redirect("/");
    }
    slug = gym.slug;
  }

  redirect(gymPath(slug, "/admin/billing?success=1"));
}
