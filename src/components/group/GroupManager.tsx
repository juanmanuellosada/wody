"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import {
  createGroup,
  deleteGroup,
  renameGroup,
  assignStudentToGroup,
  removeStudentFromGroup,
} from "@/actions/group";

interface Student {
  id: string;
  name: string;
}

interface Group {
  id: string;
  name: string;
  students: Student[];
}

interface GroupManagerProps {
  groups: Group[];
  ungroupedStudents: Student[];
  hideCreate?: boolean;
  demo?: boolean;
}

export function GroupManager({ groups, ungroupedStudents, hideCreate, demo }: GroupManagerProps) {
  const [newGroupName, setNewGroupName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isTransitioning, startTransition] = useTransition();
  const isPending = isTransitioning || !!demo;

  function handleCreate() {
    if (!newGroupName.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await createGroup(newGroupName.trim());
      if (result.success) {
        setNewGroupName("");
      } else {
        setError(result.error);
      }
    });
  }

  function handleDelete(groupId: string) {
    setError(null);
    startTransition(async () => {
      const result = await deleteGroup(groupId);
      if (!result.success) setError(result.error);
    });
  }

  function handleRename(groupId: string) {
    if (!renameValue.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await renameGroup(groupId, renameValue.trim());
      if (result.success) {
        setRenamingId(null);
      } else {
        setError(result.error);
      }
    });
  }

  function handleAssign(studentId: string, groupId: string) {
    setError(null);
    startTransition(async () => {
      const result = await assignStudentToGroup(studentId, groupId);
      if (!result.success) setError(result.error);
    });
  }

  function handleRemove(studentId: string) {
    setError(null);
    startTransition(async () => {
      const result = await removeStudentFromGroup(studentId);
      if (!result.success) setError(result.error);
    });
  }

  return (
    <section className="border border-[#1A1A1A] bg-[#0A0A0A]">
      <div className="px-5 py-3 border-b border-[#1A1A1A] flex items-center gap-3">
        <span className="w-2 h-2 bg-[#E31414] flex-shrink-0" aria-hidden="true" />
        <h2 className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-white">
          Grupos
        </h2>
      </div>

      <div className="p-5 flex flex-col gap-5">
        {/* Create group */}
        {!hideCreate && (
          <div className="flex gap-2">
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Nombre del grupo"
              disabled={isPending}
              className="flex-1 bg-[#0A0A0A] border border-[#2A2A2A] text-white text-sm font-body px-3 py-2 placeholder:text-gray-600 focus:outline-none focus:border-[#E31414] transition-colors duration-200"
            />
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreate}
              loading={isPending}
              disabled={!newGroupName.trim()}
            >
              Crear
            </Button>
          </div>
        )}

        {error && (
          <p className="text-xs font-heading font-bold text-[#E31414] uppercase tracking-wide" role="alert">
            {error}
          </p>
        )}

        {/* Groups list */}
        {groups.length === 0 ? (
          <p className="text-gray-600 text-sm font-heading font-bold uppercase tracking-[0.15em]">
            No tenés grupos todavía.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {groups.map((group) => (
              <div
                key={group.id}
                className="border border-[#2A2A2A] bg-[#1A1A1A] p-4 flex flex-col gap-3"
              >
                {/* Group header */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  {renamingId === group.id ? (
                    <div className="flex gap-2 flex-1">
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleRename(group.id)}
                        disabled={isPending}
                        className="flex-1 bg-[#0A0A0A] border border-[#2A2A2A] text-white text-sm font-body px-3 py-1.5 focus:outline-none focus:border-[#E31414] transition-colors duration-200"
                        autoFocus
                      />
                      <Button variant="primary" size="sm" onClick={() => handleRename(group.id)} disabled={isPending}>
                        OK
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setRenamingId(null)} disabled={isPending}>
                        X
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-white">
                          {group.name}
                        </h3>
                        <span className="text-xs font-heading font-bold text-gray-600">
                          ({group.students.length})
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setRenamingId(group.id);
                            setRenameValue(group.name);
                          }}
                          disabled={isPending}
                        >
                          Renombrar
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDelete(group.id)}
                          disabled={isPending}
                        >
                          Eliminar
                        </Button>
                      </div>
                    </>
                  )}
                </div>

                {/* Students in group */}
                {group.students.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {group.students.map((student) => (
                      <span
                        key={student.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#0A0A0A] border border-[#2A2A2A] text-xs font-heading font-bold text-gray-300"
                      >
                        {student.name}
                        <button
                          onClick={() => handleRemove(student.id)}
                          disabled={isPending}
                          className="text-gray-600 hover:text-[#E31414] transition-colors duration-200 cursor-pointer"
                          title="Quitar del grupo"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Add student to group */}
                {ungroupedStudents.length > 0 && (
                  <div className="flex gap-2 items-center">
                    <select
                      id={`add-student-${group.id}`}
                      disabled={isPending}
                      className="flex-1 bg-[#0A0A0A] border border-[#2A2A2A] text-gray-400 text-xs font-body px-2 py-1.5 focus:outline-none focus:border-[#E31414] transition-colors duration-200"
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAssign(e.target.value, group.id);
                          e.target.value = "";
                        }
                      }}
                    >
                      <option value="" disabled>
                        Agregar alumno...
                      </option>
                      {ungroupedStudents.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
