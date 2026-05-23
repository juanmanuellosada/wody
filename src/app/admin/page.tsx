import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const gyms = await prisma.gym.findMany({
    where: { blockedAt: null, kind: { not: "PERSONAL" } },
    select: {
      id: true,
      name: true,
      slug: true,
      subscriptionNextPaymentDate: true,
      subscriptionMonthlyAmount: true,
    },
  });

  // Prisma doesn't support NULLS LAST in orderBy for DateTime? columns directly.
  // Sort in JS: non-null dates ascending, then nulls.
  const sorted = [...gyms].sort((a, b) => {
    const da = a.subscriptionNextPaymentDate;
    const db = b.subscriptionNextPaymentDate;
    if (da === null && db === null) return a.name.localeCompare(b.name);
    if (da === null) return 1;
    if (db === null) return -1;
    const diff = da.getTime() - db.getTime();
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name);
  });

  const now = new Date();

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="border border-line bg-panel p-6">
        <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-brand-red mb-1">
          Panel Super Admin
        </p>
        <h1 className="text-2xl font-heading font-black uppercase tracking-[0.1em] text-white">
          Suscripciones
        </h1>
        <p className="text-xs text-gray-500 font-body mt-1">
          {sorted.length} gym(s) activo(s)
        </p>
      </div>

      {/* Quick links */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/admin/gyms/new"
          className="px-5 py-2.5 bg-brand-red text-white text-xs font-heading font-bold uppercase tracking-[0.15em] hover:bg-brand-red-dark transition-colors duration-200"
        >
          + Nuevo Gym
        </Link>
        <Link
          href="/admin/coupons/new"
          className="px-5 py-2.5 bg-elev border border-edge text-white text-xs font-heading font-bold uppercase tracking-[0.15em] hover:border-brand-red hover:text-brand-red transition-colors duration-200"
        >
          + Nuevo Cupón
        </Link>
      </div>

      {/* Subscriptions table */}
      <section>
        <h2 className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-gray-400 mb-4">
          Próximos cobros
        </h2>
        <div className="overflow-x-auto border border-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-panel">
                {["Gym", "Slug", "Próximo pago", "Monto mensual", "Estado"].map((h) => (
                  <th
                    key={h}
                    className="text-left text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 px-4 py-3 border-b border-line"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((gym) => {
                const overdue =
                  gym.subscriptionNextPaymentDate !== null &&
                  gym.subscriptionNextPaymentDate < now;
                return (
                  <tr
                    key={gym.id}
                    className="border-b border-line hover:bg-hover transition-colors duration-200"
                  >
                    <td className="px-4 py-3.5">
                      <Link
                        href={`/admin/gyms/${gym.id}`}
                        className="text-white font-heading font-bold hover:text-brand-red transition-colors duration-200"
                      >
                        {gym.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-gray-500 font-body text-xs">
                      {gym.slug}
                    </td>
                    <td className="px-4 py-3.5 font-body text-xs">
                      {gym.subscriptionNextPaymentDate ? (
                        <span className={overdue ? "text-brand-red font-bold" : "text-gray-300"}>
                          {gym.subscriptionNextPaymentDate.toLocaleDateString("es-AR")}
                        </span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-gray-300 font-body text-xs tabular-nums">
                      {gym.subscriptionMonthlyAmount != null
                        ? `$${(gym.subscriptionMonthlyAmount / 100).toLocaleString("es-AR")}`
                        : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      {overdue ? (
                        <span className="text-xs font-heading font-bold uppercase tracking-[0.15em] px-2 py-0.5 bg-brand-red/15 text-brand-red border border-brand-red/30">
                          Vencido
                        </span>
                      ) : (
                        <span className="text-xs font-heading font-bold uppercase tracking-[0.15em] px-2 py-0.5 bg-white/5 text-gray-400 border border-edge">
                          Al día
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-600 font-body text-xs">
                    No hay gyms activos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
