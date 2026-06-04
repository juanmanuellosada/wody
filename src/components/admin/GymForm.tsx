"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DatePicker } from "@/components/ui/DatePicker";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { createGym, updateGym, blockGym, unblockGym } from "@/actions/super-admin/gym";
import type { GymRow } from "@/actions/super-admin/gym";
import { compressImage } from "@/lib/image-compress";

interface Props {
  gym?: GymRow;
}

export function GymForm({ gym }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isBlockPending, startBlockTransition] = useTransition();
  const isEdit = !!gym;

  const [name, setName] = useState(gym?.name ?? "");
  const [slug, setSlug] = useState(gym?.slug ?? "");
  const [kind, setKind] = useState<"GYM" | "BOX">((gym?.kind as "GYM" | "BOX") ?? "BOX");
  const [primaryColor, setPrimaryColor] = useState(gym?.primaryColor ?? "#E31414");
  const [autoBlockAfterDays, setAutoBlockAfterDays] = useState(gym?.autoBlockAfterDays ?? 45);
  const initialPaymentDate = gym?.subscriptionNextPaymentDate
    ? gym.subscriptionNextPaymentDate.toISOString().split("T")[0]
    : "";
  const [subscriptionNextPaymentDate, setSubscriptionNextPaymentDate] = useState(initialPaymentDate);
  const [hasPaymentDate, setHasPaymentDate] = useState(!!initialPaymentDate);
  const todayStr = new Date().toISOString().split("T")[0];
  const [subscriptionMonthlyAmount, setSubscriptionMonthlyAmount] = useState(
    gym?.subscriptionMonthlyAmount != null ? gym.subscriptionMonthlyAmount / 100 : ""
  );
  const [logoFile, setLogoFile] = useState<File | null>(null);

  // Admin inicial (solo en alta)
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminName, setAdminName] = useState("");

  const [selfManagedBilling, setSelfManagedBilling] = useState(gym?.selfManagedBilling ?? false);
  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);
  const [unblockConfirmOpen, setUnblockConfirmOpen] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const compressedLogo = logoFile ? await compressImage(logoFile) : undefined;

      if (isEdit) {
        const result = await updateGym({
          id: gym!.id,
          name,
          kind,
          primaryColor,
          autoBlockAfterDays,
          subscriptionNextPaymentDate: hasPaymentDate ? (subscriptionNextPaymentDate || null) : null,
          subscriptionMonthlyAmount:
            subscriptionMonthlyAmount !== ""
              ? Math.round(Number(subscriptionMonthlyAmount) * 100)
              : null,
          selfManagedBilling,
          logoFile: compressedLogo,
        });
        if (result.success) {
          toast.success("Gym actualizado.");
          router.refresh();
        } else {
          toast.error(result.error);
        }
      } else {
        const result = await createGym({
          name,
          slug,
          kind,
          primaryColor,
          adminEmail,
          adminPassword,
          adminName,
          autoBlockAfterDays,
          subscriptionNextPaymentDate: hasPaymentDate ? (subscriptionNextPaymentDate || undefined) : undefined,
          subscriptionMonthlyAmount:
            subscriptionMonthlyAmount !== ""
              ? Math.round(Number(subscriptionMonthlyAmount) * 100)
              : undefined,
          logoFile: compressedLogo,
        });
        if (result.success) {
          toast.success("Gym creado.");
          router.push("/admin/gyms");
          router.refresh();
        } else {
          toast.error(result.error);
        }
      }
    });
  }

  function handleBlock() {
    startBlockTransition(async () => {
      const result = await blockGym(gym!.id);
      if (result.success) {
        toast.success("Gym bloqueado.");
        setBlockConfirmOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
        setBlockConfirmOpen(false);
      }
    });
  }

  function handleUnblock() {
    startBlockTransition(async () => {
      const result = await unblockGym(gym!.id);
      if (result.success) {
        toast.success("Gym desbloqueado.");
        setUnblockConfirmOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
        setUnblockConfirmOpen(false);
      }
    });
  }

  const isBlocked = gym?.blockedAt !== null;

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 max-w-2xl">
        <Input
          label="Nombre del gym"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        {isEdit ? (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400">
              Slug
            </label>
            <p className="bg-elev border border-edge px-4 py-3 text-sm text-gray-500 font-body">
              {gym!.slug}
              <span className="ml-2 text-gray-700 text-xs">(inmutable)</span>
            </p>
          </div>
        ) : (
          <Input
            label="Slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
            required
            placeholder="mi-gym"
            hint="Único, en minúsculas con guiones. No se puede cambiar luego."
          />
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400">
            Tipo
          </label>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as "GYM" | "BOX")}
            className="bg-elev text-white font-body border border-edge px-4 py-3 text-sm focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red/20 transition-all duration-200"
          >
            <option value="BOX">BOX (CrossFit / Funcional)</option>
            <option value="GYM">GYM (Gimnasio tradicional)</option>
          </select>
        </div>

        <ColorPicker
          label="Color primario"
          value={primaryColor}
          onChange={setPrimaryColor}
        />

        <div className="flex flex-col gap-3">
          <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400">
            Logo (imagen)
          </label>
          {gym?.logo && (
            <p className="text-xs text-gray-500 font-body">
              Logo actual:{" "}
              <a href={gym.logo} target="_blank" rel="noopener noreferrer" className="text-brand-red hover:underline">
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
          label="Auto-bloqueo (días de atraso)"
          type="number"
          value={autoBlockAfterDays}
          onChange={(e) => setAutoBlockAfterDays(Number(e.target.value))}
          hint="Días desde el vencimiento de cuota para auto-bloquear alumnos."
        />

        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={selfManagedBilling}
              onChange={(e) => setSelfManagedBilling(e.target.checked)}
              className="w-4 h-4 accent-brand-red"
            />
            <span className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400">
              Cobro manual (sin Mercado Pago)
            </span>
          </label>
          {selfManagedBilling && (
            <p className="text-xs text-gray-500 font-body">
              El gym paga por fuera de MP. El vencimiento lo gobierna la fecha de próximo pago, que se mueve a mano al cobrar.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={hasPaymentDate}
              onChange={(e) => {
                setHasPaymentDate(e.target.checked);
                if (e.target.checked && !subscriptionNextPaymentDate) {
                  setSubscriptionNextPaymentDate(todayStr);
                }
              }}
              className="w-4 h-4 accent-brand-red"
            />
            <span className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400">
              {selfManagedBilling ? "Próximo pago del gym (cobro manual)" : "Próximo pago de suscripción (opcional)"}
            </span>
          </label>
          {hasPaymentDate && (
            <DatePicker
              value={subscriptionNextPaymentDate || todayStr}
              onChange={setSubscriptionNextPaymentDate}
            />
          )}
        </div>

        <Input
          label="Monto mensual suscripción en pesos (opcional)"
          type="number"
          value={subscriptionMonthlyAmount}
          onChange={(e) => setSubscriptionMonthlyAmount(e.target.value)}
          placeholder="15000"
          hint="Valor en pesos (no centavos). Se guarda multiplicado por 100."
        />

        {/* Admin inicial — solo en alta */}
        {!isEdit && (
          <>
            <div className="border-t border-line pt-5 mt-2">
              <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400 mb-4">
                Admin inicial
              </p>
              <div className="flex flex-col gap-4">
                <Input
                  label="Nombre del admin"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  required
                />
                <Input
                  label="Email del admin"
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  required
                />
                <Input
                  label="Contraseña del admin"
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  required
                  showPasswordToggle
                  hint="Mínimo 8 caracteres."
                />
              </div>
            </div>
          </>
        )}

        <div className="flex flex-wrap gap-3 pt-2">
          <Button type="submit" loading={isPending}>
            {isEdit ? "Guardar cambios" : "Crear gym"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push("/admin/gyms")}
            disabled={isPending}
          >
            Cancelar
          </Button>
        </div>
      </form>

      {/* Block / unblock — solo en edición */}
      {isEdit && (
        <div className="border-t border-line pt-6 mt-6 max-w-2xl">
          <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-4">
            Estado del gym
          </p>
          {isBlocked ? (
            <div className="flex items-center gap-4">
              <span className="text-xs font-heading font-bold uppercase tracking-[0.15em] px-2 py-0.5 bg-brand-red/15 text-brand-red border border-brand-red/30">
                Bloqueado
              </span>
              <Button
                variant="secondary"
                size="sm"
                loading={isBlockPending}
                onClick={() => setUnblockConfirmOpen(true)}
              >
                Desbloquear
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <span className="text-xs font-heading font-bold uppercase tracking-[0.15em] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                Activo
              </span>
              <Button
                variant="danger"
                size="sm"
                loading={isBlockPending}
                onClick={() => setBlockConfirmOpen(true)}
              >
                Bloquear gym
              </Button>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={blockConfirmOpen}
        title="Bloquear gym"
        message={`¿Bloquear "${gym?.name}"? El gym desaparecerá de la landing y sus usuarios no podrán loguearse. Sus datos no se borran.`}
        confirmLabel="Bloquear"
        variant="danger"
        loading={isBlockPending}
        onConfirm={handleBlock}
        onCancel={() => setBlockConfirmOpen(false)}
      />
      <ConfirmDialog
        open={unblockConfirmOpen}
        title="Desbloquear gym"
        message={`¿Desbloquear "${gym?.name}"? El gym volverá a aparecer en la landing.`}
        confirmLabel="Desbloquear"
        loading={isBlockPending}
        onConfirm={handleUnblock}
        onCancel={() => setUnblockConfirmOpen(false)}
      />
    </>
  );
}
