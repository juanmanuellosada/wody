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
  emailFlowEnabled?: boolean;
}

export function UserForm({ terms, teachers, emailFlowEnabled = false }: UserFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [successNumber, setSuccessNumber] = useState<number | null>(null);
  const [successWarning, setSuccessWarning] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
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
    setSuccessWarning(null);

    const form = e.currentTarget;
    const formData = new FormData(form);
    if (showStudentExtras) {
      formData.set("canCreateOwnRoutines", effectiveCanCreate ? "1" : "0");
      if (teacherId) formData.set("teacherId", teacherId);
    }

    startTransition(async () => {
      const result = await createUser(formData);
      if (result.success) {
        setSuccessNumber(result.memberNumber);
        setSuccessWarning("warning" in result ? result.warning : null);
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

      {!emailFlowEnabled && (
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
              {emailFlowEnabled ? "Usuario creado — mail de invitación enviado" : "Usuario creado"}
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
