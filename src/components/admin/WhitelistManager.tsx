"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { createEntry, updateEntry, deleteEntry } from "@/actions/super-admin/personal-whitelist";
import type { WhitelistRow } from "@/actions/super-admin/personal-whitelist";

interface Props {
  entries: WhitelistRow[];
}

export function WhitelistManager({ entries }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isDeletePending, startDeleteTransition] = useTransition();

  // Create form state
  const [newEmail, setNewEmail] = useState("");
  const [newNote, setNewNote] = useState("");

  // Edit modal state
  const [editEntry, setEditEntry] = useState<WhitelistRow | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editNote, setEditNote] = useState("");

  // Delete confirmation state
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const toDelete = entries.find((e) => e.id === deleteId);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createEntry(newEmail.trim(), newNote.trim());
      if (result.success) {
        toast.success("Entrada creada.");
        setNewEmail("");
        setNewNote("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function openEdit(entry: WhitelistRow) {
    setEditEntry(entry);
    setEditEmail(entry.email);
    setEditNote(entry.note ?? "");
  }

  function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editEntry) return;
    startTransition(async () => {
      const result = await updateEntry(editEntry.id, editEmail.trim(), editNote.trim());
      if (result.success) {
        toast.success("Entrada actualizada.");
        setEditEntry(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleDelete() {
    if (deleteId === null) return;
    startDeleteTransition(async () => {
      const result = await deleteEntry(deleteId);
      if (result.success) {
        toast.success("Entrada eliminada.");
        setDeleteId(null);
        router.refresh();
      } else {
        toast.error(result.error);
        setDeleteId(null);
      }
    });
  }

  return (
    <>
      {/* Create form */}
      <section className="border border-line bg-panel p-5">
        <div className="px-0 py-0 mb-4 flex items-center gap-3">
          <span className="w-2 h-2 bg-brand-red flex-shrink-0" aria-hidden="true" />
          <h2 className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-white">
            Nueva entrada
          </h2>
        </div>
        <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3">
          <Input
            placeholder="email@ejemplo.com"
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            required
            className="flex-1"
          />
          <Input
            placeholder="Nota (opcional)"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" size="sm" loading={isPending}>
            Agregar
          </Button>
        </form>
      </section>

      {/* Table */}
      <div className="overflow-x-auto border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-panel">
              {["Email", "Nota", "Alta", "Estado", ""].map((h) => (
                <th
                  key={h}
                  className="text-left text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500 px-4 py-3 border-b border-line"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const consumed = entry.consumedAt !== null;
              return (
                <tr key={entry.id} className="border-b border-line hover:bg-hover transition-colors duration-200">
                  <td className="px-4 py-3.5 text-white font-body">{entry.email}</td>
                  <td className="px-4 py-3.5 text-gray-400 font-body text-xs">
                    {entry.note ?? <span className="text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-3.5 text-gray-500 font-body text-xs">
                    {entry.createdAt.toLocaleDateString("es-AR")}
                  </td>
                  <td className="px-4 py-3.5">
                    {consumed ? (
                      <div>
                        <span className="text-xs font-heading font-bold uppercase tracking-[0.15em] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          Consumida
                        </span>
                        <p className="text-xs text-gray-600 mt-1">
                          {entry.consumedAt!.toLocaleDateString("es-AR")}
                        </p>
                      </div>
                    ) : (
                      <span className="text-xs font-heading font-bold uppercase tracking-[0.15em] px-2 py-0.5 bg-gray-800 text-gray-400 border border-gray-700">
                        Pendiente
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openEdit(entry)}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={consumed}
                        title={consumed ? "No se puede borrar una entrada consumida" : undefined}
                        onClick={() => setDeleteId(entry.id)}
                      >
                        Borrar
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-600 font-body text-xs">
                  La whitelist está vacía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit modal */}
      {editEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setEditEntry(null); }}
        >
          <div
            className="w-full max-w-md bg-panel border border-line p-6 flex flex-col gap-5"
            role="dialog"
            aria-modal="true"
            aria-label="Editar entrada"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-white">
                Editar entrada
              </h2>
              <button
                onClick={() => setEditEntry(null)}
                className="text-gray-500 hover:text-white transition-colors duration-200 cursor-pointer text-lg leading-none min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Cerrar"
              >
                &#215;
              </button>
            </div>
            <form onSubmit={handleEdit} className="flex flex-col gap-4">
              <Input
                label="Email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                required
                disabled={editEntry.consumedAt !== null}
                hint={editEntry.consumedAt !== null ? "No editable: la entrada ya fue consumida." : undefined}
              />
              <Input
                label="Nota (opcional)"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
              />
              <div className="flex gap-3">
                <Button type="button" variant="secondary" size="sm" onClick={() => setEditEntry(null)} disabled={isPending} className="flex-1">
                  Cancelar
                </Button>
                <Button type="submit" size="sm" loading={isPending} className="flex-1">
                  Guardar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        title="Eliminar entrada"
        message={toDelete ? `¿Eliminar la entrada para "${toDelete.email}"?` : ""}
        confirmLabel="Eliminar"
        variant="danger"
        loading={isDeletePending}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </>
  );
}
