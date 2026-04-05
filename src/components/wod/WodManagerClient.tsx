"use client";

import dynamic from "next/dynamic";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { getContentPreview, normalizeContent } from "@/components/ui/MarkdownRenderer";

const MarkdownEditor = dynamic(
  () => import("@/components/ui/MarkdownEditor").then((m) => m.MarkdownEditor),
  { ssr: false, loading: () => <div className="h-[220px] bg-[#1A1A1A] border border-[#2A2A2A] animate-pulse" /> }
);
import { CopyWodDialog } from "@/components/wod/CopyWodDialog";
import { createWod, updateWod, deleteWod } from "@/actions/wod";
import { toInputDate, getTodayArgentina, formatDateArg } from "@/lib/dates";
import type { Wod } from "@prisma/client";

interface WodForManager extends Pick<Wod, "id" | "content" | "date"> {}

interface WodManagerClientProps {
  wods: WodForManager[];
}

type Mode = "view" | "create" | "edit";

export function WodManagerClient({ wods }: WodManagerClientProps) {
  const todayStr = toInputDate(getTodayArgentina());

  const [mode, setMode] = useState<Mode>("view");
  const [editingWodId, setEditingWodId] = useState<string | null>(null);
  const [newDate, setNewDate] = useState(todayStr);
  const [editorContent, setEditorContent] = useState("");
  const [copyWodId, setCopyWodId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function startCreate() {
    setMode("create");
    setNewDate(todayStr);
    setEditorContent("");
    setFormError(null);
  }

  function startEdit(wod: WodForManager) {
    setMode("edit");
    setEditingWodId(wod.id);
    setEditorContent(normalizeContent(wod.content));
    setFormError(null);
  }

  function cancelForm() {
    setMode("view");
    setEditingWodId(null);
    setFormError(null);
  }

  function handleCreate() {
    setFormError(null);
    startTransition(async () => {
      const result = await createWod(newDate, editorContent);
      if (result.success) {
        setMode("view");
      } else {
        setFormError(result.error);
      }
    });
  }

  function handleUpdate() {
    if (!editingWodId) return;
    setFormError(null);
    startTransition(async () => {
      const result = await updateWod(editingWodId, editorContent);
      if (result.success) {
        setMode("view");
        setEditingWodId(null);
      } else {
        setFormError(result.error);
      }
    });
  }

  function handleDelete(wodId: string) {
    startTransition(async () => {
      await deleteWod(wodId);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {mode !== "view" ? (
        <div className="border border-[#1A1A1A] bg-[#0A0A0A]">
          {/* Header bar */}
          <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-[#1A1A1A]">
            <h2 className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-white">
              {mode === "create" ? "Nuevo WOD" : "Editar WOD"}
            </h2>
            {mode === "create" && (
              <div className="w-44">
                <DatePicker
                  value={newDate}
                  onChange={setNewDate}
                  disabled={isPending}
                />
              </div>
            )}
          </div>

          {/* Editor area */}
          <div className="p-5 flex flex-col gap-4">
            <MarkdownEditor
              value={editorContent}
              onChange={setEditorContent}
              disabled={isPending}
            />

            {formError && (
              <p className="text-xs font-heading font-bold text-[#E31414] uppercase tracking-wide" role="alert">
                {formError}
              </p>
            )}

            <div className="flex gap-3 flex-wrap">
              <Button
                variant="secondary"
                size="sm"
                onClick={cancelForm}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={isPending}
                onClick={mode === "create" ? handleCreate : handleUpdate}
              >
                {mode === "create" ? "Guardar WOD" : "Actualizar WOD"}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Button variant="primary" size="sm" onClick={startCreate} className="self-start">
          + Nuevo WOD
        </Button>
      )}

      {wods.length === 0 ? (
        <p className="text-gray-600 text-sm font-heading font-bold uppercase tracking-[0.15em]">
          No hay WODs cargados todavia.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {wods.map((wod) => (
            <WodManagerCard
              key={wod.id}
              wod={wod}
              onEdit={() => startEdit(wod)}
              onDelete={() => handleDelete(wod.id)}
              onCopy={() => setCopyWodId(wod.id)}
              disabled={isPending || mode !== "view"}
            />
          ))}
        </div>
      )}

      {copyWodId && (
        <CopyWodDialog
          wodId={copyWodId}
          onClose={() => setCopyWodId(null)}
        />
      )}
    </div>
  );
}

interface WodManagerCardProps {
  wod: Pick<Wod, "id" | "content" | "date">;
  onEdit: () => void;
  onDelete: () => void;
  onCopy: () => void;
  disabled: boolean;
}

function WodManagerCard({
  wod,
  onEdit,
  onDelete,
  onCopy,
  disabled,
}: WodManagerCardProps) {
  const preview = getContentPreview(wod.content);

  return (
    <div className="bg-[#1A1A1A] border border-[#2A2A2A] p-4 flex flex-col gap-3 transition-colors duration-200">
      <div className="flex items-center justify-between gap-2 flex-wrap border-b border-[#2A2A2A] pb-3">
        <span className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-[#E31414]">
          {formatDateArg(wod.date)}
        </span>
        <div className="flex gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={onCopy} disabled={disabled}>
            Copiar
          </Button>
          <Button variant="secondary" size="sm" onClick={onEdit} disabled={disabled}>
            Editar
          </Button>
          <Button variant="danger" size="sm" onClick={onDelete} disabled={disabled}>
            Eliminar
          </Button>
        </div>
      </div>
      <p className="text-gray-400 text-sm font-body line-clamp-3">
        {preview || <span className="text-gray-600 italic">Sin contenido</span>}
      </p>
    </div>
  );
}
