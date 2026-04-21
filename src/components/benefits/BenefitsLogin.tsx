"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { login } from "@/actions/auth";

export function BenefitsLogin() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await login(formData);

      if (!result.success) {
        setError(result.error);
        return;
      }

      // Reload the landing so the server section picks up the new session.
      window.location.reload();
    });
  }

  return (
    <div className="max-w-sm mx-auto bg-panel border border-line p-6 sm:p-8">
      <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-gray-400 text-center mb-2">
        Ingresá para ver beneficios
      </p>
      <p className="text-xs text-gray-600 font-body text-center mb-6">
        Usá tu email y contraseña del gym que ya usa WODY.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        <Input
          label="Email"
          name="email"
          type="email"
          placeholder="tu@email.com"
          autoComplete="email"
          required
          disabled={isPending}
        />
        <Input
          label="Contraseña"
          name="password"
          type="password"
          placeholder="********"
          autoComplete="current-password"
          required
          disabled={isPending}
          showPasswordToggle
        />

        {error && (
          <div
            className="px-4 py-3 text-sm font-heading font-bold text-brand-red border border-brand-red/40 bg-brand-red/5 uppercase tracking-wide"
            role="alert"
          >
            {error}
          </div>
        )}

        <Button type="submit" variant="primary" size="md" loading={isPending}>
          Ingresar
        </Button>
      </form>
    </div>
  );
}
