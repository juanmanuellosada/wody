"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { createWhitelistEntry } from "@/actions/super-admin/signup-request";

export function WhitelistForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [type, setType] = useState<"GYM" | "PERSONAL">("GYM");
  const [email, setEmail] = useState("");
  const [contactName, setContactName] = useState("");
  const [gymName, setGymName] = useState("");
  const [gymKindSuggested, setGymKindSuggested] = useState<"GYM" | "BOX">("BOX");
  const [message, setMessage] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const base = { email, contactName, message: message || undefined };
      const result =
        type === "PERSONAL"
          ? await createWhitelistEntry({ type: "PERSONAL", ...base })
          : await createWhitelistEntry({
              type: "GYM",
              ...base,
              gymName,
              gymKindSuggested,
            });

      if (result.success) {
        toast.success(
          type === "PERSONAL"
            ? "Entrada de whitelist Personal creada. Se envió el email al usuario."
            : "Entrada de whitelist creada. Se envió el email de onboarding."
        );
        router.push("/admin/signup-requests");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Tipo selector */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400">
          Tipo de lead
        </span>
        <div className="flex gap-3" role="radiogroup" aria-label="Tipo de lead">
          {(["GYM", "PERSONAL"] as const).map((t) => (
            <label
              key={t}
              className={[
                "flex-1 flex items-center justify-center gap-2 px-4 py-3 border text-xs font-heading font-bold uppercase tracking-[0.1em] cursor-pointer transition-all duration-200",
                type === t
                  ? t === "PERSONAL"
                    ? "bg-purple-500/10 border-purple-500/50 text-purple-300"
                    : "bg-blue-500/10 border-blue-500/50 text-blue-300"
                  : "bg-elev border-edge text-gray-400 hover:border-white/20",
                isPending ? "cursor-not-allowed opacity-50" : "",
              ].join(" ")}
            >
              <input
                type="radio"
                name="type"
                value={t}
                checked={type === t}
                onChange={() => setType(t)}
                disabled={isPending}
                className="sr-only"
              />
              {t === "GYM" ? "Gym / Box" : "Wody Personal"}
            </label>
          ))}
        </div>
      </div>

      <Input
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        placeholder={type === "PERSONAL" ? "usuario@email.com" : "dueño@gym.com"}
      />

      <Input
        label="Nombre de contacto"
        value={contactName}
        onChange={(e) => setContactName(e.target.value)}
        required
        placeholder="Juan García"
      />

      {type === "GYM" && (
        <>
          <Input
            label="Nombre del gym"
            value={gymName}
            onChange={(e) => setGymName(e.target.value)}
            required
            placeholder="Atlas CrossFit"
          />

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="gymKindSuggested"
              className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400"
            >
              Tipo de centro
            </label>
            <select
              id="gymKindSuggested"
              value={gymKindSuggested}
              onChange={(e) => setGymKindSuggested(e.target.value as "GYM" | "BOX")}
              className="bg-elev text-white font-body border border-edge px-4 py-3 text-sm focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red/20 transition-all duration-200"
            >
              <option value="BOX">Box (CrossFit / Funcional)</option>
              <option value="GYM">Gym (Gimnasio tradicional)</option>
            </select>
          </div>
        </>
      )}

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="message"
          className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400"
        >
          Notas internas (opcional)
        </label>
        <textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          placeholder="Comentarios sobre esta entry..."
          disabled={isPending}
          className="bg-elev text-white font-body w-full border border-edge px-4 py-3 text-sm placeholder:text-gray-600 focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red/20 disabled:opacity-50 transition-all duration-200 resize-none"
        />
      </div>

      <div className="flex flex-wrap gap-3 pt-2">
        <Button type="submit" loading={isPending}>
          Crear y enviar email
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push("/admin/signup-requests")}
          disabled={isPending}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
