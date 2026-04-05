"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { login } from "@/actions/auth";
import { gymPath } from "@/lib/gym";

interface LoginFormProps {
  gymSlug: string;
}

export function LoginForm({ gymSlug }: LoginFormProps) {
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

  return (
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
      <Input
        label="Contraseña"
        name="password"
        type="password"
        placeholder="********"
        autoComplete="current-password"
        required
        disabled={isPending}
      />

      {error && (
        <div
          className="px-4 py-3 text-sm font-heading font-bold text-[#E31414] border border-[#E31414]/40 bg-[#E31414]/5 uppercase tracking-wide"
          role="alert"
        >
          {error}
        </div>
      )}

      <Button type="submit" variant="primary" size="lg" loading={isPending}>
        {isPending ? null : "Ingresar"}
      </Button>
    </form>
  );
}
