import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RmsClient } from "@/components/RmsClient";
import { gymPath } from "@/lib/gym";

interface Props {
  params: Promise<{ gymSlug: string }>;
}

export default async function RmsPage({ params }: Props) {
  const { gymSlug } = await params;
  const session = await auth();

  if (!session?.user || session.user.role !== "STUDENT") {
    redirect(gymPath(gymSlug, "/login"));
  }

  const rms = await prisma.rM.findMany({
    where: { studentId: session.user.id },
    orderBy: { date: "desc" },
    select: { id: true, exercise: true, weight: true, date: true, createdAt: true },
  });

  return (
    <RmsClient
      rms={rms.map((rm) => ({
        ...rm,
        date: rm.date.toISOString(),
        createdAt: rm.createdAt.toISOString(),
      }))}
      athleteName={session.user.name ?? "Atleta"}
    />
  );
}
