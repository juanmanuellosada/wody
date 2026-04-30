"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { login } from "@/actions/auth";
import { requestPasswordReset } from "@/actions/account";
import { gymPath } from "@/lib/gym";

interface LoginFormProps {
  gymSlug: string;
}

export function LoginForm({ gymSlug }: LoginFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();

  // Password reset dialog state
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetPending, startResetTransition] = useTransition();
  const [resetDone, setResetDone] = useState(false);

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

      // Honor ?next=... si el user venía redirigido desde una ruta
      // específica (ej. /checkin?t=...). Validación: solo paths del mismo
      // origen (empiezan con /) para prevenir open redirect.
      const next = searchParams.get("next");
      if (next && next.startsWith("/")) {
        window.location.href = next;
        return;
      }

      try {
        const res = await fetch("/api/auth/session");
        const session = await res.json();
        const role = session?.user?.role;
        const slug = session?.user?.gymSlug ?? gymSlug;

        let destination: string;
        if (role === "ADMIN") {
          destination = gymPath(slug, "/admin");
        } else if (role === "TEACHER") {
          destination = gymPath(slug, "/dashboard/teacher");
        } else if (role === "ACCESS") {
          destination = gymPath(slug, "/ingresos");
        } else {
          destination = gymPath(slug, "/dashboard/athlete");
        }
        // Hard navigation — forces full server re-render so the layout
        // picks up the new session and renders the Navbar correctly.
        window.location.href = destination;
      } catch {
        window.location.href = gymPath(gymSlug, "/dashboard/athlete");
      }
    });
  }

  function handleResetSubmit() {
    if (!resetEmail.trim()) return;
    startResetTransition(async () => {
      await requestPasswordReset({ gymSlug, email: resetEmail.trim() });
      // Anti-enumeration: always show success regardless of whether email exists.
      setResetDone(true);
    });
  }

  function handleResetDialogClose() {
    if (resetPending) return;
    setResetDialogOpen(false);
    setResetEmail("");
    setResetDone(false);
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        {/* Hidden field — gymSlug reaches authorize() via this */}
        <input type="hidden" name="gymSlug" value={gymSlug} />

        <Input
          label="Email"
          name="email"
          type="email"
          placeholder="tu@email.com"
          autoComplete="email"
          required
          disabled={isPending}
        />
        <div className="flex flex-col gap-1">
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
          <button
            type="button"
            onClick={() => setResetDialogOpen(true)}
            className="self-end text-xs font-heading font-bold uppercase tracking-[0.1em] text-gray-500 hover:text-gray-300 transition-colors duration-200 mt-1"
          >
            ¿Olvidaste tu contraseña?
          </button>
        </div>

        {error && (
          <div
            className="px-4 py-3 text-sm font-heading font-bold text-brand-red border border-brand-red/40 bg-brand-red/5 uppercase tracking-wide"
            role="alert"
          >
            {/* PENDING_ACTIVATION is set by auth.ts (Grupo 7) in the
                CredentialsSignin error code field. NextAuth 5 propagates it
                via error.code on the AuthError instance. */}
            {error === "PENDING_ACTIVATION"
              ? "Tu invitación está pendiente. Pedile al admin que reenvíe el mail."
              : error}
          </div>
        )}

        <Button type="submit" variant="primary" size="lg" loading={isPending}>
          Ingresar
        </Button>
      </form>

      {/* Password reset dialog */}
      {resetDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleResetDialogClose();
          }}
        >
          <div
            className="w-full max-w-sm bg-panel border border-line p-6 flex flex-col gap-5"
            role="dialog"
            aria-modal="true"
            aria-label="Recuperar contraseña"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-white">
                Recuperar contraseña
              </h2>
              <button
                onClick={handleResetDialogClose}
                disabled={resetPending}
                className="text-gray-500 hover:text-white transition-colors duration-200 cursor-pointer text-lg leading-none min-w-[44px] min-h-[44px] flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Cerrar"
              >
                &#215;
              </button>
            </div>

            {resetDone ? (
              <p className="text-sm text-gray-300 leading-relaxed">
                Si el email existe en nuestro sistema, te llegará un mail con instrucciones para restablecer tu contraseña.
              </p>
            ) : (
              <>
                <p className="text-sm text-gray-400 font-body leading-relaxed">
                  Ingresá tu email y te enviamos un link para crear una nueva contraseña.
                </p>
                <Input
                  label="Email"
                  type="email"
                  placeholder="tu@email.com"
                  autoComplete="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  disabled={resetPending}
                />
                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleResetDialogClose}
                    disabled={resetPending}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    loading={resetPending}
                    onClick={handleResetSubmit}
                    disabled={!resetEmail.trim()}
                    className="flex-1"
                  >
                    Enviar
                  </Button>
                </div>
              </>
            )}

            {resetDone && (
              <Button variant="secondary" size="sm" onClick={handleResetDialogClose}>
                Cerrar
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
