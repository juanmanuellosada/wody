"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { resetPassword } from "@/actions/account";
import { gymPath } from "@/lib/gym";

interface ResetPasswordFormProps {
  token: string;
  gymSlug: string;
}

export function ResetPasswordForm({ token, gymSlug }: ResetPasswordFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    startTransition(async () => {
      const result = await resetPassword({ token, password, gymSlug });
      if (!result.success) {
        setError(result.error);
        return;
      }
      window.location.href = gymPath(gymSlug, "/login?flash=password_reset");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <Input
        label="Nueva contraseña"
        name="password"
        type="password"
        placeholder="Mínimo 6 caracteres"
        autoComplete="new-password"
        minLength={6}
        required
        disabled={isPending}
        showPasswordToggle
      />
      <Input
        label="Confirmar contraseña"
        name="confirmPassword"
        type="password"
        placeholder="Repetí tu contraseña"
        autoComplete="new-password"
        minLength={6}
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

      <Button type="submit" variant="primary" size="lg" loading={isPending}>
        Cambiar contraseña
      </Button>
    </form>
  );
}
