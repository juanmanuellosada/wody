import { listAllGyms } from "@/actions/super-admin/gym";
import { GymsTable } from "@/components/admin/GymsTable";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminGymsPage() {
  const gyms = await listAllGyms();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-brand-red mb-1">
            Super Admin
          </p>
          <h1 className="text-2xl font-heading font-black uppercase tracking-[0.1em] text-white">
            Gyms
          </h1>
          <p className="text-xs text-gray-500 font-body mt-1">
            {gyms.filter((g) => !g.blockedAt).length} activo(s) · {gyms.filter((g) => g.blockedAt).length} bloqueado(s)
          </p>
        </div>
        <Link
          href="/admin/gyms/new"
          className="px-5 py-2.5 bg-brand-red text-white text-xs font-heading font-bold uppercase tracking-[0.15em] hover:bg-brand-red-dark transition-colors duration-200"
        >
          + Nuevo Gym
        </Link>
      </div>

      <GymsTable gyms={gyms} />
    </div>
  );
}
