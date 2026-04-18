"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createUser } from "@/actions/user";

export function UserForm() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [selectedRole, setSelectedRole] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const form = e.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const result = await createUser(formData);
      if (result.success) {
        setSuccess(true);
        form.reset();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        name="name"
        label="Nombre"
        placeholder="Nombre completo"
        required
        disabled={isPending}
      />

      <Input
        name="email"
        label="Email"
        type="email"
        placeholder="email@ejemplo.com"
        required
        disabled={isPending}
      />

      <Input
        name="password"
        label="Contraseña"
        type="password"
        placeholder="Minimo 6 caracteres"
        required
        minLength={6}
        disabled={isPending}
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400">
          Rol
        </label>
        <select
          name="role"
          required
          disabled={isPending}
          defaultValue=""
          onChange={(e) => setSelectedRole(e.target.value)}
          className="bg-elev text-white font-body border border-edge px-4 py-3 text-sm min-h-[44px] focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red/20 transition-all duration-200 disabled:opacity-50"
        >
          <option value="" disabled>
            Selecciona un rol
          </option>
          <option value="TEACHER">Profe</option>
          <option value="STUDENT">Alumno</option>
        </select>
      </div>

      {selectedRole === "STUDENT" && (
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400">
          Tipo de alumno
        </label>
        <select
          name="studentType"
          disabled={isPending}
          defaultValue="PERSONALIZED"
          className="bg-elev text-white font-body border border-edge px-4 py-3 text-sm min-h-[44px] focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red/20 transition-all duration-200 disabled:opacity-50"
        >
          <option value="PERSONALIZED">Personalizado (WODs + RMs)</option>
          <option value="GENERAL">General (solo RMs)</option>
        </select>
      </div>
      )}

      {error && (
        <p className="text-xs font-heading font-bold text-brand-red uppercase tracking-wide" role="alert">
          {error}
        </p>
      )}

      {success && (
        <p className="text-xs font-heading font-bold text-green-500 uppercase tracking-wide" role="status">
          Usuario creado correctamente.
        </p>
      )}

      <Button type="submit" loading={isPending} size="md">
        Crear Usuario
      </Button>
    </form>
  );
}
