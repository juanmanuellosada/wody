import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gymPath, hasAccessControl, isPersonalGym } from "@/lib/gym";
import { AccessHistoryTable } from "@/components/access/AccessHistoryTable";

interface Props {
  params: Promise<{ gymSlug: string }>;
}

export default async function IngresosHistorialPage({ params }: Props) {
  const { gymSlug } = await params;
  if (!hasAccessControl(gymSlug)) notFound();
  const session = await auth();

  if (session?.user && session.user.gymKind && isPersonalGym(session.user.gymKind)) {
    redirect("/personal/dashboard/mis-rutinas");
  }

  if (
    !session?.user ||
    (session.user.role !== "ACCESS" && session.user.role !== "ADMIN")
  ) {
    redirect(gymPath(gymSlug, "/login"));
  }

  if (!session.user.gymId) {
    redirect(gymPath(gymSlug, "/login"));
  }

  const logs = await prisma.accessLog.findMany({
    where: { gymId: session.user.gymId },
    orderBy: { at: "desc" },
    take: 200,
    select: {
      id: true,
      at: true,
      state: true,
      decidedAt: true,
      user: {
        select: { id: true, name: true, memberNumber: true },
      },
      decidedBy: {
        select: { name: true },
      },
    },
  });

  return (
    <AccessHistoryTable
      logs={logs.map((log) => ({
        ...log,
        at: log.at.toISOString(),
        decidedAt: log.decidedAt?.toISOString() ?? null,
      }))}
    />
  );
}
