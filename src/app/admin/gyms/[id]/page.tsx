import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { GymForm } from "@/components/admin/GymForm";
import type { GymRow } from "@/actions/super-admin/gym";

interface Props {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function EditGymPage({ params }: Props) {
  const { id } = await params;
  const gym = await prisma.gym.findUnique({ where: { id } });

  if (!gym) notFound();

  const gymRow: GymRow = {
    id: gym.id,
    name: gym.name,
    slug: gym.slug,
    kind: gym.kind,
    logo: gym.logo,
    primaryColor: gym.primaryColor,
    blockedAt: gym.blockedAt,
    autoBlockAfterDays: gym.autoBlockAfterDays,
    subscriptionNextPaymentDate: gym.subscriptionNextPaymentDate,
    subscriptionMonthlyAmount: gym.subscriptionMonthlyAmount,
    createdAt: gym.createdAt,
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-brand-red mb-1">
          <Link href="/admin/gyms" className="hover:underline">Gyms</Link>
          {" / "}Editar
        </p>
        <h1 className="text-2xl font-heading font-black uppercase tracking-[0.1em] text-white">
          {gym.name}
        </h1>
        <p className="text-xs text-gray-500 font-body mt-1">Slug: {gym.slug}</p>
      </div>

      <GymForm gym={gymRow} />
    </div>
  );
}
