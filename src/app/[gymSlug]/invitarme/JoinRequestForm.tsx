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
  const [teacherId, setTeacherId] = useState("");
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
        teacherId: teacherId || null,
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
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="teacher-select"
            className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400"
          >
            Profe (opcional)
          </label>
          <select
            id="teacher-select"
            name="teacherId"
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            disabled={isPending}
            className="bg-elev text-white font-body w-full border border-edge px-4 py-3 text-sm min-h-[44px] focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            <option value="">Sin profe asignado</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}

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
