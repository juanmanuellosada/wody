"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { createCoupon, updateCoupon } from "@/actions/super-admin/coupon";
import type { CouponRow } from "@/actions/super-admin/coupon";
import type { CouponRule } from "@prisma/client";
import { compressImage } from "@/lib/image-compress";

const COUPON_RULES: { value: CouponRule; label: string }[] = [
  { value: "ONCE_PER_USER", label: "Una vez por usuario" },
  { value: "ONCE_PER_USER_PER_MONTH", label: "Una vez por usuario por mes" },
  { value: "ONCE_GLOBAL", label: "Una sola vez global" },
  { value: "UNLIMITED", label: "Ilimitado" },
];

interface Props {
  coupon?: CouponRow;
  nextSortOrder?: number;
}

export function CouponForm({ coupon, nextSortOrder }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEdit = !!coupon;

  const [slug, setSlug] = useState(coupon?.slug ?? "");
  const [name, setName] = useState(coupon?.name ?? "");
  const [description, setDescription] = useState(coupon?.description ?? "");
  const [instagramHandle, setInstagramHandle] = useState(coupon?.instagramHandle ?? "");
  const [instagramUrl, setInstagramUrl] = useState(coupon?.instagramUrl ?? "");
  const [rule, setRule] = useState<CouponRule>(coupon?.rule ?? "ONCE_PER_USER");
  const [active, setActive] = useState(coupon?.active ?? true);
  const [sortOrder, setSortOrder] = useState(coupon?.sortOrder ?? nextSortOrder ?? 0);
  const [requiresConsumedSlug, setRequiresConsumedSlug] = useState(coupon?.requiresConsumedSlug ?? "");
  const [hideWhenConsumed, setHideWhenConsumed] = useState(coupon?.hideWhenConsumed ?? false);
  const initialExpiresAt = coupon?.expiresAt ? coupon.expiresAt.toISOString().split("T")[0] : "";
  const [expiresAt, setExpiresAt] = useState(initialExpiresAt);
  const [hasExpiresAt, setHasExpiresAt] = useState(!!initialExpiresAt);
  const todayStr = new Date().toISOString().split("T")[0];
  const [fixedCode, setFixedCode] = useState(coupon?.fixedCode ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(coupon?.websiteUrl ?? "");
  const [restrictions, setRestrictions] = useState(coupon?.restrictions ?? "");
  const [logoFile, setLogoFile] = useState<File | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const compressedLogo = logoFile ? await compressImage(logoFile) : undefined;
      const base = {
        name,
        description,
        instagramHandle,
        instagramUrl,
        rule,
        active,
        sortOrder,
        requiresConsumedSlug: requiresConsumedSlug || undefined,
        hideWhenConsumed,
        expiresAt: hasExpiresAt ? (expiresAt || undefined) : undefined,
        fixedCode: fixedCode || undefined,
        websiteUrl: websiteUrl || undefined,
        restrictions: restrictions || undefined,
        logoFile: compressedLogo,
      };

      const result = isEdit
        ? await updateCoupon({ id: coupon!.id, ...base })
        : await createCoupon({ slug, ...base });

      if (result.success) {
        toast.success(isEdit ? "Cupón actualizado." : "Cupón creado.");
        router.push("/admin/coupons");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 max-w-2xl">
      {!isEdit && (
        <Input
          label="Slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          required
          placeholder="promo-2026"
          hint="Único, en minúsculas con guiones. No se puede cambiar luego."
        />
      )}

      <Input
        label="Nombre"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400">
          Descripción
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={3}
          className="bg-elev text-white font-body w-full border border-edge px-4 py-3 text-sm placeholder:text-gray-600 focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red/20 transition-all duration-200 resize-y"
        />
      </div>

      <Input
        label="Instagram Handle"
        value={instagramHandle}
        onChange={(e) => setInstagramHandle(e.target.value)}
        placeholder="@ejemplo"
      />
      <Input
        label="Instagram URL"
        value={instagramUrl}
        onChange={(e) => setInstagramUrl(e.target.value)}
        placeholder="https://instagram.com/ejemplo"
        type="url"
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400">
          Regla
        </label>
        <select
          value={rule}
          onChange={(e) => setRule(e.target.value as CouponRule)}
          className="bg-elev text-white font-body border border-edge px-4 py-3 text-sm focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red/20 transition-all duration-200"
        >
          {COUPON_RULES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <Input
        label="Sort order"
        type="number"
        value={sortOrder}
        onChange={(e) => setSortOrder(Number(e.target.value))}
        hint="Menor número = antes en la lista."
      />

      <div className="flex flex-col gap-3">
        <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400">
          Logo (imagen)
        </label>
        {coupon?.logoKey && (
          <p className="text-xs text-gray-500 font-body">
            Logo actual:{" "}
            <a href={coupon.logoKey} target="_blank" rel="noopener noreferrer" className="text-brand-red hover:underline">
              ver
            </a>
          </p>
        )}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
          className="text-xs text-gray-400 font-body file:mr-3 file:px-3 file:py-1.5 file:text-xs file:font-heading file:font-bold file:uppercase file:tracking-[0.1em] file:bg-elev file:text-white file:border file:border-edge file:cursor-pointer hover:file:border-brand-red"
        />
        <p className="text-xs text-gray-600 font-body">PNG, JPEG, WebP o SVG. Se comprime automáticamente al subir.</p>
      </div>

      <Input
        label="Código fijo (opcional)"
        value={fixedCode}
        onChange={(e) => setFixedCode(e.target.value)}
        hint="Si se define, se muestra directamente sin generar redemptions."
      />

      <Input
        label="Website URL (opcional)"
        type="url"
        value={websiteUrl}
        onChange={(e) => setWebsiteUrl(e.target.value)}
        placeholder="https://tienda.ejemplo.com"
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400">
          Restricciones (letra chica, opcional)
        </label>
        <textarea
          value={restrictions}
          onChange={(e) => setRestrictions(e.target.value)}
          rows={2}
          className="bg-elev text-white font-body w-full border border-edge px-4 py-3 text-sm placeholder:text-gray-600 focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red/20 transition-all duration-200 resize-y"
        />
      </div>

      <Input
        label="Requiere slug consumido (opcional)"
        value={requiresConsumedSlug}
        onChange={(e) => setRequiresConsumedSlug(e.target.value)}
        hint="Slug del cupón que el usuario debe haber consumido primero."
      />

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={hasExpiresAt}
            onChange={(e) => {
              setHasExpiresAt(e.target.checked);
              if (e.target.checked && !expiresAt) {
                setExpiresAt(todayStr);
              }
            }}
            className="w-4 h-4 accent-brand-red"
          />
          <span className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400">
            Vence el (opcional)
          </span>
        </label>
        {hasExpiresAt && (
          <DatePicker
            value={expiresAt || todayStr}
            onChange={setExpiresAt}
          />
        )}
      </div>

      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="w-4 h-4 accent-brand-red"
          />
          <span className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400">
            Activo
          </span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={hideWhenConsumed}
            onChange={(e) => setHideWhenConsumed(e.target.checked)}
            className="w-4 h-4 accent-brand-red"
          />
          <span className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400">
            Ocultar cuando ya fue consumido
          </span>
        </label>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={isPending}>
          {isEdit ? "Guardar cambios" : "Crear cupón"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push("/admin/coupons")}
          disabled={isPending}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
