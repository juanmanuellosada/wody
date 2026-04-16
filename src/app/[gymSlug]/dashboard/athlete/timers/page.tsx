import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { gymPath } from "@/lib/gym";
import { TimersClient } from "@/components/timers/TimersClient";

interface Props {
  params: Promise<{ gymSlug: string }>;
}

export default async function TimersPage({ params }: Props) {
  const { gymSlug } = await params;
  const session = await auth();

  if (!session?.user || session.user.gymSlug !== gymSlug) {
    redirect(gymPath(gymSlug, "/login"));
  }

  return <TimersClient />;
}
