"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { upgradeLiteUser } from "@/actions/user";
import type { GymTerms } from "@/lib/gym-terms";

interface TeacherOption {
  id: string;
  name: string;
}

interface UpgradeLiteDialogProps {
  userId: string;
  userName: string;
  assignedTeachers: TeacherOption[];
  terms: GymTerms;
  onClose: () => void;
}

export function UpgradeLiteDialog({
  userId,
  userName,
  assignedTeachers,
  terms,
  onClose,
}: UpgradeLiteDialogProps) {
  const [mode, setMode] = useState<"invite" | "password">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [studentType, setStudentType] = useState<"GENERAL" | "PERSONALIZED">("GENERAL");
  const [canCreateOwnRoutines, setCanCreateOwnRoutines] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const showCanCreate = studentType === "PERSONALIZED" && assignedTeachers.length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await upgradeLiteUser(userId, {
        mode,
        email,
        password: mode === "password" ? password : undefined,
        studentType,
        canCreateOwnRoutines: showCanCreate ? canCreateOwnRoutines : undefined,
      });
      if (result.success) {
        setSuccess(true);
        setTimeout(onClose, 1500);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-panel border border-edge p-6 w-full max-w-md mx-4 flex flex-col gap-4">
        <h3 className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-white">
          Convertir a cuenta completa
        </h3>
        <p className="text-xs text-gray-400 font-body">
          Alumno: <span className="text-white font-bold">{userName}</span>. Asignale email y modo de acceso. Su historial de pagos y accesos se preserva.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Modo */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400">
              Modo de acceso
            </label>
            <div className="flex">
              <button
                type="button"
                disabled={isPending}
                onClick={() => setMode("password")}
                className={[
                  "flex-1 px-4 py-2.5 text-xs font-heading font-bold uppercase tracking-[0.12em] border transition-colors duration-150 disabled:opacity-50",
                  mode === "password"
                    ? "bg-brand-red/15 text-brand-red border-brand-red/40"
                    : "bg-elev text-gray-400 border-edge hover:text-white",
                ].join(" ")}
              >
                Con contraseña
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => setMode("invite")}
                className={[
                  "flex-1 px-4 py-2.5 text-xs font-heading font-bold uppercase tracking-[0.12em] border-y border-r transition-colors duration-150 disabled:opacity-50",
                  mode === "invite"
                    ? "bg-brand-red/15 text-brand-red border-brand-red/40"
                    : "bg-elev text-gray-400 border-edge hover:text-white",
                ].join(" ")}
              >
                Por invitación
              </button>
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isPending}
              placeholder="email@ejemplo.com"
              className="w-full bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200 placeholder:text-gray-600"
            />
          </div>

          {/* Contraseña — solo si mode=password */}
          {mode === "password" && (
            <div>
              <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={isPending}
                placeholder="Mínimo 6 caracteres"
                className="w-full bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200 placeholder:text-gray-600"
              />
            </div>
          )}

          {/* Tipo de alumno */}
          <div>
            <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">
              Tipo de alumno
            </label>
            <select
              value={studentType}
              onChange={(e) => setStudentType(e.target.value as "GENERAL" | "PERSONALIZED")}
              disabled={isPending}
              className="w-full bg-elev border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200"
            >
              <option value="GENERAL">General (solo {terms.rms})</option>
              <option value="PERSONALIZED">Personalizado ({terms.wods} + {terms.rms})</option>
            </select>
          </div>

          {/* canCreateOwnRoutines — solo PERSONALIZED con profe */}
          {showCanCreate && (
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={canCreateOwnRoutines}
                disabled={isPending}
                onChange={(e) => setCanCreateOwnRoutines(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-brand-red cursor-pointer"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-heading font-bold text-white">
                  Puede crear sus propias rutinas
                </span>
                <span className="text-xs text-gray-500 font-body leading-snug">
                  Permite al alumno crear {terms.wods} asignadas a sí mismo.
                </span>
              </span>
            </label>
          )}

          {error && (
            <p className="text-xs font-heading font-bold text-brand-red uppercase tracking-wide" role="alert">
              {error}
            </p>
          )}

          {success && (
            <p className="text-xs font-heading font-bold text-green-500 uppercase tracking-wide" role="status">
              Cuenta convertida exitosamente.
            </p>
          )}

          <div className="flex gap-3 justify-end">
            <Button variant="secondary" size="sm" onClick={onClose} disabled={isPending} type="button">
              Cancelar
            </Button>
            <Button variant="primary" size="sm" loading={isPending} type="submit">
              Convertir
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
