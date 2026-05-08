"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { submitJoinRequest } from "@/actions/join-request";

interface Props {
  gymSlug: string;
  teachers: Array<{ id: string; name: string }>;
}

export function JoinRequestForm({ gymSlug, teachers }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [teacherIds, setTeacherIds] = useState<string[]>([]);
  const [nextPaymentDate, setNextPaymentDate] = useState(() => {
    // Compute "today" in Argentina (UTC-3) at render time.
    const nowUTC = new Date();
    const argNow = new Date(nowUTC.getTime() - 3 * 60 * 60 * 1000);
    const y = argNow.getUTCFullYear();
    const m = String(argNow.getUTCMonth() + 1).padStart(2, "0");
    const d = String(argNow.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });
  const [honeypot, setHoneypot] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (submitted) {
    return (
      <div
        role="status"
        className="px-4 py-3 text-sm font-heading font-bold text-green-500 border border-green-500/40 bg-green-500/5 uppercase tracking-wide"
      >
        Solicitud recibida. Te avisamos por mail cuando el admin la apruebe.
      </div>
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await submitJoinRequest({
        gymSlug,
        name,
        email,
        password,
        passwordConfirmation,
        teacherIds: teacherIds.length > 0 ? teacherIds : undefined,
        nextPaymentDate,
        honeypot,
      });
      if (result.ok) {
        setSubmitted(true);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {/* Honeypot: invisible to legitimate users, bots fill it automatically */}
      <input
        type="text"
        name="website"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
      />

      <Input
        label="Nombre completo"
        name="name"
        type="text"
        placeholder="Tu nombre y apellido"
        autoComplete="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={200}
        required
        disabled={isPending}
      />

      <Input
        label="Email"
        name="email"
        type="email"
        placeholder="tu@email.com"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        disabled={isPending}
      />

      <Input
        label="Contraseña"
        name="password"
        type="password"
        placeholder="Mínimo 6 caracteres"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        minLength={6}
        required
        disabled={isPending}
        showPasswordToggle
      />

      <Input
        label="Confirmar contraseña"
        name="passwordConfirmation"
        type="password"
        placeholder="Repetí tu contraseña"
        autoComplete="new-password"
        value={passwordConfirmation}
        onChange={(e) => setPasswordConfirmation(e.target.value)}
        minLength={6}
        required
        disabled={isPending}
        showPasswordToggle
      />

      {teachers.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400">
            Profe (opcional)
          </p>
          <p className="text-xs text-gray-500 font-body">
            Podés seleccionar uno o más profesores
          </p>
          <div className="flex flex-col gap-2">
            {teachers.map((t) => (
              <label key={t.id} className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={teacherIds.includes(t.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setTeacherIds((prev) => [...prev, t.id]);
                    } else {
                      setTeacherIds((prev) => prev.filter((id) => id !== t.id));
                    }
                  }}
                  disabled={isPending}
                  className="w-4 h-4 accent-brand-red cursor-pointer disabled:cursor-not-allowed"
                />
                <span className="text-sm font-body text-white">{t.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="nextPaymentDate"
          className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400"
        >
          Próxima fecha de pago
        </label>
        <input
          id="nextPaymentDate"
          type="date"
          name="nextPaymentDate"
          value={nextPaymentDate}
          min={nextPaymentDate}
          onChange={(e) => setNextPaymentDate(e.target.value)}
          required
          disabled={isPending}
          className="bg-elev text-white font-body w-full border border-edge px-4 py-3 text-sm min-h-[44px] focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      {error && (
        <div
          role="alert"
          className="px-4 py-3 text-sm font-heading font-bold text-brand-red border border-brand-red/40 bg-brand-red/5 uppercase tracking-wide"
        >
          {error}
        </div>
      )}

      <Button type="submit" variant="primary" size="lg" loading={isPending}>
        Solicitar alta
      </Button>
    </form>
  );
}
