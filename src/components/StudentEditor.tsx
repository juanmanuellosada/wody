"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { updateStudent } from "@/actions/user";

interface StudentEditorProps {
  studentId: string;
  currentName: string;
  currentEmail: string;
  onClose: () => void;
  demo?: boolean;
}

export function StudentEditor({
  studentId,
  currentName,
  currentEmail,
  onClose,
  demo,
}: StudentEditorProps) {
  const [name, setName] = useState(currentName);
  const [email, setEmail] = useState(currentEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    const data: { name?: string; email?: string; password?: string } = {};
    if (name.trim() !== currentName) data.name = name;
    if (email.trim() !== currentEmail) data.email = email;
    if (password.trim()) data.password = password;

    if (Object.keys(data).length === 0 || demo) {
      onClose();
      return;
    }

    startTransition(async () => {
      const result = await updateStudent(studentId, data);
      if (result.success) {
        onClose();
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
      <div className="bg-[#0A0A0A] border border-[#2A2A2A] p-6 w-full max-w-md mx-4 flex flex-col gap-4">
        <h3 className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-white">
          Editar Alumno
        </h3>

        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">
              Nombre
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isPending}
              className="w-full bg-[#1A1A1A] border border-[#2A2A2A] text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-[#E31414] transition-colors duration-200"
            />
          </div>
          <div>
            <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isPending}
              className="w-full bg-[#1A1A1A] border border-[#2A2A2A] text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-[#E31414] transition-colors duration-200"
            />
          </div>
          <div>
            <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 mb-1 block">
              Nueva Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Dejar vacío para no cambiar"
              disabled={isPending}
              className="w-full bg-[#1A1A1A] border border-[#2A2A2A] text-white text-sm font-body px-3 py-2 placeholder:text-gray-600 focus:outline-none focus:border-[#E31414] transition-colors duration-200"
            />
          </div>
        </div>

        {error && (
          <p className="text-xs font-heading font-bold text-[#E31414] uppercase tracking-wide" role="alert">
            {error}
          </p>
        )}

        <div className="flex gap-3 justify-end">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave} loading={isPending}>
            Guardar
          </Button>
        </div>
      </div>
    </div>
  );
}
