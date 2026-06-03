import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gymPath } from "@/lib/gym";
import { getMyPersonalSubscriptionStatus } from "@/actions/personal-billing";
import { PersonalBillingPage } from "@/components/personal/PersonalBillingPage";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ gymSlug: string }>;
}

export default async function PersonalSuscripcionPage({ params }: Props) {
  const { gymSlug } = await params;

  if (gymSlug !== "personal") {
    redirect("/");
  }

  const session = await auth();
  if (!session?.user) {
    redirect(gymPath(gymSlug, "/login"));
  }

  if (session.user.role !== "STUDENT" || !session.user.canCreateOwnRoutines) {
    redirect("/");
  }

  const personalGym = await prisma.gym.findFirst({ where: { kind: "PERSONAL" } });
  if (!personalGym || session.user.gymId !== personalGym.id) {
    redirect("/");
  }

  const [status, dbUser] = await Promise.all([
    getMyPersonalSubscriptionStatus(),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { paymentExemptReason: true, email: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <PersonalBillingPage
        trialEndsAt={status.trialEndsAt}
        paymentExempt={status.paymentExempt}
        paymentExemptReason={dbUser?.paymentExemptReason ?? null}
        mpSubscriptionStatus={status.mpSubscriptionStatus}
        mpPreapprovalId={status.mpPreapprovalId}
        daysLeftInTrial={status.daysLeftInTrial}
        payerEmail={dbUser?.email ?? session.user.email ?? ""}
      />

      <div className="max-w-2xl mx-auto w-full border-t border-line pt-4">
        <Link
          href={gymPath(gymSlug, "/dashboard/mis-rutinas")}
          className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 hover:text-white transition-colors duration-200"
        >
          ← Volver al inicio
        </Link>
      </div>
    </div>
  );
}
