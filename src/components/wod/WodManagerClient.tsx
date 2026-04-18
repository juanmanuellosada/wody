"use client";

import dynamic from "next/dynamic";
import { useState, useMemo, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { getContentPreview, normalizeContent } from "@/components/ui/MarkdownRenderer";

const MarkdownEditor = dynamic(
  () => import("@/components/ui/MarkdownEditor").then((m) => m.MarkdownEditor),
  { ssr: false, loading: () => <div className="h-[220px] bg-elev border border-edge animate-pulse" /> }
);
import { CopyWodDialog } from "@/components/wod/CopyWodDialog";
import { TargetSelector, TargetBadge } from "@/components/wod/TargetSelector";
import { createWod, updateWod, deleteWod } from "@/actions/wod";
import type { WodTarget } from "@/actions/wod";
import { toInputDate, getTodayArgentina, formatDateArg } from "@/lib/dates";
import type { Wod, WodTargetType } from "@prisma/client";

interface WodForManager extends Pick<Wod, "id" | "title" | "content" | "date"> {
  targetType: WodTargetType;
  targetGroupId?: string | null;
  targetStudentId?: string | null;
  targetGroupName?: string | null;
  targetStudentName?: string | null;
}

interface GroupOption {
  id: string;
  name: string;
}

interface StudentOption {
  id: string;
  name: string;
}

interface WodManagerClientProps {
  wods: WodForManager[];
  groups: GroupOption[];
  students: StudentOption[];
  demo?: boolean;
}

type Mode = "view" | "create" | "edit";

export function WodManagerClient({ wods, groups, students, demo }: WodManagerClientProps) {
  const todayStr = toInputDate(getTodayArgentina());

  const [mode, setMode] = useState<Mode>("view");
  const [editingWodId, setEditingWodId] = useState<string | null>(null);
  const [newDate, setNewDate] = useState(todayStr);
  const [editorTitle, setEditorTitle] = useState("");
  const [editorContent, setEditorContent] = useState("");
  const [copyWodId, setCopyWodId] = useState<string | null>(null);
  const copySourceWod = useMemo(
    () => (copyWodId ? wods.find((w) => w.id === copyWodId) ?? null : null),
    [copyWodId, wods]
  );
  const [target, setTarget] = useState<WodTarget>({ type: "ALL" });
  const [formError, setFormError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  const filteredWods = useMemo(() => {
    if (!searchQuery.trim()) return wods;
    const q = searchQuery.toLowerCase();
    return wods.filter(
      (w) =>
        w.title.toLowerCase().includes(q) ||
        formatDateArg(w.date).toLowerCase().includes(q) ||
        toInputDate(w.date).includes(q)
    );
  }, [wods, searchQuery]);

  function startCreate() {
    setMode("create");
    setNewDate(todayStr);
    setEditorTitle("");
    setEditorContent("");
    setTarget({ type: "ALL" });
    setFormError(null);
  }

  function startEdit(wod: WodForManager) {
    setMode("edit");
    setEditingWodId(wod.id);
    setEditorTitle(wod.title);
    setEditorContent(normalizeContent(wod.content));
    setNewDate(toInputDate(wod.date));
    if (wod.targetType === "GROUP" && wod.targetGroupId) {
      setTarget({ type: "GROUP", groupId: wod.targetGroupId });
    } else if (wod.targetType === "STUDENT" && wod.targetStudentId) {
      setTarget({ type: "STUDENT", studentId: wod.targetStudentId });
    } else {
      setTarget({ type: "ALL" });
    }
    setFormError(null);
  }

  function cancelForm() {
    setMode("view");
    setEditingWodId(null);
    setFormError(null);
  }

  function handleCreate() {
    if (demo) { setMode("view"); return; }
    setFormError(null);
    startTransition(async () => {
      const result = await createWod(newDate, editorTitle, editorContent, target);
      if (result.success) {
        setMode("view");
      } else {
        setFormError(result.error);
      }
    });
  }

  function handleUpdate() {
    if (demo) { setMode("view"); setEditingWodId(null); return; }
    if (!editingWodId) return;
    setFormError(null);
    startTransition(async () => {
      const result = await updateWod(editingWodId, editorTitle, editorContent, newDate, target);
      if (result.success) {
        setMode("view");
        setEditingWodId(null);
      } else {
        setFormError(result.error);
      }
    });
  }

  function handleDelete(wodId: string) {
    if (demo) return;
    startTransition(async () => {
      await deleteWod(wodId);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {mode !== "view" ? (
        <div className="border border-line bg-panel">
          {/* Header bar */}
          <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-line">
            <h2 className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-white">
              {mode === "create" ? "Nuevo WOD" : "Editar WOD"}
            </h2>
            <div className="w-44">
              <DatePicker
                value={newDate}
                onChange={setNewDate}
                disabled={isPending}
              />
            </div>
          </div>

          {/* Editor area */}
          <div className="p-5 flex flex-col gap-4">
            <TargetSelector
              groups={groups}
              students={students}
              value={target}
              onChange={setTarget}
              disabled={isPending}
            />

            <input
              type="text"
              value={editorTitle}
              onChange={(e) => setEditorTitle(e.target.value)}
              placeholder="Título (ej: WOD, Rutina Fuerza, Upper Body...)"
              disabled={isPending}
              className="w-full bg-panel border border-edge text-white text-sm font-heading font-bold px-3 py-2 placeholder:text-gray-600 focus:outline-none focus:border-brand-red transition-colors duration-200"
            />

            <MarkdownEditor
              value={editorContent}
              onChange={setEditorContent}
              disabled={isPending}
            />

            {formError && (
              <p className="text-xs font-heading font-bold text-brand-red uppercase tracking-wide" role="alert">
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="primary" size="sm" onClick={startCreate} className="self-start">
            + Nuevo WOD
          </Button>
          {wods.length > 0 && (
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por título o fecha..."
              className="w-full sm:w-72 bg-panel border border-edge text-white text-sm font-body px-3 py-2 placeholder:text-gray-600 focus:outline-none focus:border-brand-red transition-colors duration-200"
            />
          )}
        </div>
      )}

      {wods.length === 0 ? (
        <p className="text-gray-600 text-sm font-heading font-bold uppercase tracking-[0.15em]">
          No hay WODs cargados todavia.
        </p>
      ) : filteredWods.length === 0 ? (
        <p className="text-gray-600 text-sm font-heading font-bold uppercase tracking-[0.15em]">
          No se encontraron WODs para &ldquo;{searchQuery}&rdquo;.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredWods.map((wod) => (
            <WodManagerCard
              key={wod.id}
              wod={wod}
              onEdit={() => startEdit(wod)}
              onDelete={() => handleDelete(wod.id)}
              onCopy={() => setCopyWodId(wod.id)}
              disabled={isPending || mode !== "view"}
              demoMode={demo}
            />
          ))}
        </div>
      )}

      {copySourceWod && (
        <CopyWodDialog
          sourceWod={copySourceWod}
          groups={groups}
          students={students}
          onClose={() => setCopyWodId(null)}
          demo={demo}
        />
      )}
    </div>
  );
}

interface WodManagerCardProps {
  wod: WodForManager;
  onEdit: () => void;
  onDelete: () => void;
  onCopy: () => void;
  disabled: boolean;
  demoMode?: boolean;
}

function WodManagerCard({
  wod,
  onEdit,
  onDelete,
  onCopy,
  disabled,
  demoMode,
}: WodManagerCardProps) {
  const preview = getContentPreview(wod.content);

  return (
    <div className="bg-elev border border-edge p-4 flex flex-col gap-3 transition-colors duration-200">
      <div className="flex items-center justify-between gap-2 flex-wrap border-b border-edge pb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-brand-red">
            {formatDateArg(wod.date)}
          </span>
          <span className="text-sm font-heading font-bold text-white">
            {wod.title}
          </span>
          <TargetBadge
            targetType={wod.targetType}
            targetGroupName={wod.targetGroupName}
            targetStudentName={wod.targetStudentName}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={onCopy} disabled={disabled}>
            Copiar
          </Button>
          <Button variant="secondary" size="sm" onClick={onEdit} disabled={disabled}>
            Editar
          </Button>
          <Button variant="danger" size="sm" onClick={onDelete} disabled={disabled || !!demoMode}>
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
