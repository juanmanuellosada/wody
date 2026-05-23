"use client";

import Link from "next/link";
import type { GymRow } from "@/actions/super-admin/gym";

interface Props {
  gyms: GymRow[];
}

const KIND_LABEL: Record<string, string> = {
  GYM: "Gym",
  BOX: "Box",
  PERSONAL: "Personal",
};

export function GymsTable({ gyms }: Props) {
  return (
    <div className="overflow-x-auto border border-line">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-panel">
            {["Nombre", "Slug", "Tipo", "Próximo pago", "Monto", "Estado", ""].map((h) => (
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
          {gyms.map((gym) => {
            const blocked = gym.blockedAt !== null;
            return (
              <tr
                key={gym.id}
                className={[
                  "border-b border-line hover:bg-hover transition-colors duration-200",
                  blocked ? "opacity-60" : "",
                ].join(" ")}
              >
                <td className="px-4 py-3.5">
                  <Link
                    href={`/admin/gyms/${gym.id}`}
                    className="text-white font-heading font-bold hover:text-brand-red transition-colors duration-200"
                  >
                    {gym.name}
                  </Link>
                </td>
                <td className="px-4 py-3.5 text-gray-500 font-body text-xs">{gym.slug}</td>
                <td className="px-4 py-3.5 text-gray-400 font-body text-xs">
                  {KIND_LABEL[gym.kind] ?? gym.kind}
                </td>
                <td className="px-4 py-3.5 text-gray-300 font-body text-xs">
                  {gym.subscriptionNextPaymentDate
                    ? gym.subscriptionNextPaymentDate.toLocaleDateString("es-AR")
                    : <span className="text-gray-600">—</span>}
                </td>
                <td className="px-4 py-3.5 text-gray-300 font-body text-xs tabular-nums">
                  {gym.subscriptionMonthlyAmount != null
                    ? `$${(gym.subscriptionMonthlyAmount / 100).toLocaleString("es-AR")}`
                    : <span className="text-gray-600">—</span>}
                </td>
                <td className="px-4 py-3.5">
                  <span
                    className={[
                      "text-xs font-heading font-bold uppercase tracking-[0.15em] px-2 py-0.5 border",
                      blocked
                        ? "bg-brand-red/15 text-brand-red border-brand-red/30"
                        : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
                    ].join(" ")}
                  >
                    {blocked ? "Bloqueado" : "Activo"}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <Link
                    href={`/admin/gyms/${gym.id}`}
                    className="text-xs font-heading font-bold uppercase tracking-[0.1em] text-gray-400 hover:text-white transition-colors duration-200 px-3 py-1.5 border border-edge hover:border-brand-red"
                  >
                    Editar
                  </Link>
                </td>
              </tr>
            );
          })}
          {gyms.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-gray-600 font-body text-xs">
                No hay gyms.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
