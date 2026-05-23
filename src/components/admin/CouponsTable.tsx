"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteCoupon } from "@/actions/super-admin/coupon";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import type { CouponRow } from "@/actions/super-admin/coupon";

interface Props {
  coupons: CouponRow[];
}

export function CouponsTable({ coupons }: Props) {
  const router = useRouter();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const toDelete = coupons.find((c) => c.id === deleteId);

  function handleDelete() {
    if (!deleteId) return;
    startTransition(async () => {
      const result = await deleteCoupon(deleteId);
      if (result.success) {
        toast.success("Cupón eliminado.");
        setDeleteId(null);
        router.refresh();
      } else {
        toast.error(result.error);
        setDeleteId(null);
      }
    });
  }

  return (
    <>
      <div className="overflow-x-auto border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-panel">
              {["Slug", "Nombre", "Regla", "Estado", "Vence", "Orden", "Canjes", ""].map((h) => (
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
            {coupons.map((c) => (
              <tr key={c.id} className="border-b border-line hover:bg-hover transition-colors duration-200">
                <td className="px-4 py-3.5 text-gray-400 font-body text-xs">{c.slug}</td>
                <td className="px-4 py-3.5 text-white font-heading font-bold">{c.name}</td>
                <td className="px-4 py-3.5 text-gray-400 font-body text-xs">{c.rule}</td>
                <td className="px-4 py-3.5">
                  <span
                    className={[
                      "text-xs font-heading font-bold uppercase tracking-[0.15em] px-2 py-0.5",
                      c.active
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                        : "bg-gray-800 text-gray-500 border border-gray-700",
                    ].join(" ")}
                  >
                    {c.active ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-gray-400 font-body text-xs">
                  {c.expiresAt ? c.expiresAt.toLocaleDateString("es-AR") : "—"}
                </td>
                <td className="px-4 py-3.5 text-gray-400 font-body text-xs tabular-nums">
                  {c.sortOrder}
                </td>
                <td className="px-4 py-3.5 text-gray-400 font-body text-xs tabular-nums">
                  {c.redemptionCount}
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex gap-2">
                    <Link
                      href={`/admin/coupons/${c.id}`}
                      className="text-xs font-heading font-bold uppercase tracking-[0.1em] text-gray-400 hover:text-white transition-colors duration-200 px-3 py-1.5 border border-edge hover:border-brand-red"
                    >
                      Editar
                    </Link>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setDeleteId(c.id)}
                    >
                      Borrar
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {coupons.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-600 font-body text-xs">
                  No hay cupones.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={deleteId !== null}
        title="Borrar cupón"
        message={
          toDelete
            ? `¿Borrar el cupón "${toDelete.name}"? Esta acción es irreversible.${toDelete.redemptionCount > 0 ? ` Tiene ${toDelete.redemptionCount} canje(s) — se mostrará un error.` : ""}`
            : ""
        }
        confirmLabel="Borrar"
        variant="danger"
        loading={isPending}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </>
  );
}
