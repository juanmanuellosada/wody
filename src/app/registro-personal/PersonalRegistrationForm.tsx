"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { submitPersonalRegistration } from "@/actions/personal-registration";

export function PersonalRegistrationForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (submitted) {
    return (
      <div
        role="status"
        className="px-4 py-3 text-sm font-heading font-bold text-green-500 border border-green-500/40 bg-green-500/5 uppercase tracking-wide"
      >
        <p className="mb-1">Listo.</p>
        <p className="normal-case font-body font-normal text-green-400 mt-2">
          Si tu email está autorizado, en los próximos minutos te va a llegar un mail de bienvenida con un link para confirmar tu cuenta.
          Si no lo recibís, revisá la carpeta de spam o escribinos.
        </p>
      </div>
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFieldErrors({});
    setGeneralError(null);

    startTransition(async () => {
      try {
        const result = await submitPersonalRegistration({
          name,
          email,
          password,
          passwordConfirm,
          honeypot,
        });

        if (result.ok) {
          setSubmitted(true);
        } else {
          setFieldErrors(result.fieldErrors);
        }
      } catch {
        setGeneralError("Ocurrió un error inesperado. Intentá de nuevo más tarde.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {/* Honeypot: invisible to legitimate users, bots fill it automatically */}
      <input
        type="text"
        name="honeypot"
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
        error={fieldErrors.name}
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
        error={fieldErrors.email}
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
        error={fieldErrors.password}
      />

      <Input
        label="Confirmar contraseña"
        name="passwordConfirm"
        type="password"
        placeholder="Repetí tu contraseña"
        autoComplete="new-password"
        value={passwordConfirm}
        onChange={(e) => setPasswordConfirm(e.target.value)}
        minLength={6}
        required
        disabled={isPending}
        showPasswordToggle
        error={fieldErrors.passwordConfirm}
      />

      {generalError && (
        <div
          role="alert"
          className="px-4 py-3 text-sm font-heading font-bold text-brand-red border border-brand-red/40 bg-brand-red/5 uppercase tracking-wide"
        >
          {generalError}
        </div>
      )}

      <Button type="submit" variant="primary" size="lg" loading={isPending}>
        Solicitar acceso
      </Button>
    </form>
  );
}
