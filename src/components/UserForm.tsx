"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createUser } from "@/actions/user";
import { formatMemberNumber } from "@/lib/memberNumber";
import type { GymTerms } from "@/lib/gym-terms";

interface TeacherOption {
  id: string;
  name: string;
}

interface UserFormProps {
  terms: GymTerms;
  teachers: TeacherOption[];
}

export function UserForm({ terms, teachers }: UserFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [successNumber, setSuccessNumber] = useState<number | null>(null);
  const [successEmail, setSuccessEmail] = useState<string | null>(null);
  const [successWarning, setSuccessWarning] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<"invite" | "password">("invite");
  const [selectedRole, setSelectedRole] = useState("");
  const [studentType, setStudentType] = useState("PERSONALIZED");
  const [teacherId, setTeacherId] = useState("");
  const [canCreateOwnRoutines, setCanCreateOwnRoutines] = useState(false);

  const showStudentExtras =
    selectedRole === "STUDENT" && studentType === "PERSONALIZED";
  // Sin profe asignado → el alumno debe poder autogestionarse.
  const mustSelfManage = showStudentExtras && !teacherId;
  const effectiveCanCreate = mustSelfManage ? true : canCreateOwnRoutines;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccessNumber(null);
    setSuccessEmail(null);
    setSuccessWarning(null);

    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("mode", mode);
    if (showStudentExtras) {
      formData.set("canCreateOwnRoutines", effectiveCanCreate ? "1" : "0");
      if (teacherId) formData.set("teacherId", teacherId);
    }

    const emailValue = (formData.get("email") as string | null)?.trim().toLowerCase() ?? "";

    startTransition(async () => {
      const result = await createUser(formData);
      if (result.success) {
        setSuccessNumber(result.memberNumber);
        setSuccessEmail(emailValue);
        setSuccessWarning("warning" in result ? result.warning ?? null : null);
        form.reset();
        setSelectedRole("");
        setStudentType("PERSONALIZED");
        setTeacherId("");
        setCanCreateOwnRoutines(false);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Mode selector */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400">
          Modo de alta
        </label>
        <div className="flex">
          <button
            type="button"
            disabled={isPending}
            onClick={() => setMode("invite")}
            className={[
              "flex-1 px-4 py-2.5 text-xs font-heading font-bold uppercase tracking-[0.12em] border transition-colors duration-150 disabled:opacity-50",
              mode === "invite"
                ? "bg-brand-red/15 text-brand-red border-brand-red/40"
                : "bg-elev text-gray-400 border-edge hover:text-white",
            ].join(" ")}
          >
            Por invitación
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => setMode("password")}
            className={[
              "flex-1 px-4 py-2.5 text-xs font-heading font-bold uppercase tracking-[0.12em] border-y border-r transition-colors duration-150 disabled:opacity-50",
              mode === "password"
                ? "bg-brand-red/15 text-brand-red border-brand-red/40"
                : "bg-elev text-gray-400 border-edge hover:text-white",
            ].join(" ")}
          >
            Con contraseña
          </button>
        </div>
      </div>

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

      {mode === "invite" ? (
        <p className="text-sm text-gray-400 font-body leading-snug">
          Recibirá un mail con un link para definir su contraseña. El link expira en 7 días.
        </p>
      ) : (
        <Input
          name="password"
          label="Contraseña"
          type="password"
          placeholder="Minimo 6 caracteres"
          required
          minLength={6}
          disabled={isPending}
          showPasswordToggle
        />
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400">
          Rol
        </label>
        <select
          name="role"
          required
          disabled={isPending}
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
          className="bg-elev text-white font-body border border-edge px-4 py-3 text-sm min-h-[44px] focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red/20 transition-all duration-200 disabled:opacity-50"
        >
          <option value="" disabled>
            Selecciona un rol
          </option>
          <option value="ADMIN">Admin (Profe)</option>
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
          value={studentType}
          onChange={(e) => setStudentType(e.target.value)}
          className="bg-elev text-white font-body border border-edge px-4 py-3 text-sm min-h-[44px] focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red/20 transition-all duration-200 disabled:opacity-50"
        >
          <option value="PERSONALIZED">Personalizado ({terms.wods} + {terms.rms})</option>
          <option value="GENERAL">General (solo {terms.rms})</option>
        </select>
      </div>
      )}

      {showStudentExtras && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400">
            Profe (opcional)
          </label>
          <select
            disabled={isPending || teachers.length === 0}
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            className="bg-elev text-white font-body border border-edge px-4 py-3 text-sm min-h-[44px] focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red/20 transition-all duration-200 disabled:opacity-50"
          >
            <option value="">Sin profe (se autogestiona)</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {showStudentExtras && (
        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={effectiveCanCreate}
            disabled={isPending || mustSelfManage}
            onChange={(e) => setCanCreateOwnRoutines(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-brand-red cursor-pointer disabled:cursor-not-allowed"
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-heading font-bold text-white">
              Puede crear sus propias rutinas
            </span>
            <span className="text-xs text-gray-500 font-body leading-snug">
              {mustSelfManage
                ? "Obligatorio al no asignar profe: el alumno se autogestiona."
                : `El alumno va a poder crear ${terms.wods} asignadas a sí mismo.`}
            </span>
          </span>
        </label>
      )}

      {error && (
        <p className="text-xs font-heading font-bold text-brand-red uppercase tracking-wide" role="alert">
          {error}
        </p>
      )}

      {successNumber !== null && (
        <div className="flex flex-col gap-2" role="status">
          <div className="flex items-center justify-between gap-3 border border-green-500/40 bg-green-500/5 px-4 py-3">
            <p className="text-xs font-heading font-bold text-green-500 uppercase tracking-wide">
              {successWarning
                ? "Usuario creado pero el mail no salió. Usá 'Reenviar invitación'."
                : mode === "invite"
                ? `Usuario creado. Mail de invitación enviado a ${successEmail}.`
                : "Usuario creado"}
            </p>
            <p className="text-xs font-heading font-bold text-green-500 uppercase tracking-[0.15em]">
              Nº de socio: {formatMemberNumber(successNumber)}
            </p>
          </div>
          {successWarning && (
            <p className="text-xs font-heading font-bold text-brand-red uppercase tracking-wide" role="alert">
              {successWarning}
            </p>
          )}
        </div>
      )}

      <Button type="submit" loading={isPending} size="md">
        Crear Usuario
      </Button>
    </form>
  );
}
