import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RmsClient } from "@/components/RmsClient";
import { gymPath } from "@/lib/gym";
import { gymTerms } from "@/lib/gym-terms";

interface Props {
  params: Promise<{ gymSlug: string }>;
}

export default async function RmsPage({ params }: Props) {
  const { gymSlug } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect(gymPath(gymSlug, "/login"));
  }

  const [rms, gym] = await Promise.all([
    prisma.rM.findMany({
      where: { studentId: session.user.id },
      orderBy: { date: "desc" },
      select: { id: true, exercise: true, weight: true, date: true, createdAt: true },
    }),
    prisma.gym.findUnique({ where: { slug: gymSlug }, select: { name: true, kind: true } }),
  ]);
  const terms = gymTerms(gym?.kind ?? "BOX");

  return (
    <RmsClient
      rms={rms.map((rm) => ({
        ...rm,
        date: rm.date.toISOString(),
        createdAt: rm.createdAt.toISOString(),
      }))}
      athleteName={session.user.name ?? "Atleta"}
      gymName={gym?.name ?? "WODY"}
      gymSlug={gymSlug}
      terms={terms}
    />
  );
}
