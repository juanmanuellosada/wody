"use client";

import { useState } from "react";
import type { WodTarget } from "@/actions/wod";

interface GroupOption {
  id: string;
  name: string;
}

interface StudentOption {
  id: string;
  name: string;
}

interface TargetSelectorProps {
  groups: GroupOption[];
  students: StudentOption[];
  muslibStudents?: StudentOption[];
  value: WodTarget;
  onChange: (target: WodTarget) => void;
  disabled?: boolean;
}

export function TargetSelector({
  groups,
  students,
  muslibStudents,
  value,
  onChange,
  disabled,
}: TargetSelectorProps) {
  // "student" | "group" sub-mode when MUSCULACION_LIBRE tab is active.
  const [muslibMode, setMuslibMode] = useState<"student" | "group">("student");

  const isMuslib = value.type === "MUSCULACION_LIBRE" || value.type === "MUSCULACION_LIBRE_GROUP";

  function handleMuslibModeChange(mode: "student" | "group") {
    setMuslibMode(mode);
    if (mode === "student" && muslibStudents && muslibStudents.length > 0) {
      onChange({ type: "MUSCULACION_LIBRE", studentId: muslibStudents[0].id });
    } else if (mode === "group" && groups.length > 0) {
      onChange({ type: "MUSCULACION_LIBRE_GROUP", groupId: groups[0].id });
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500">
        Destinatario
      </label>
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange({ type: "ALL" })}
          className={[
            "px-3 py-1.5 text-xs font-heading font-bold uppercase tracking-[0.1em] border transition-colors duration-200",
            value.type === "ALL"
              ? "border-brand-red text-white bg-brand-red/10"
              : "border-edge text-gray-500 hover:border-gray-500",
          ].join(" ")}
        >
          Todos
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange({ type: "PERSONALIZED" })}
          className={[
            "px-3 py-1.5 text-xs font-heading font-bold uppercase tracking-[0.1em] border transition-colors duration-200",
            value.type === "PERSONALIZED"
              ? "border-brand-red text-white bg-brand-red/10"
              : "border-edge text-gray-500 hover:border-gray-500",
          ].join(" ")}
        >
          Personalizados
        </button>

        {groups.length > 0 && (
          <button
            type="button"
            disabled={disabled}
            onClick={() =>
              onChange({ type: "GROUP", groupId: groups[0].id })
            }
            className={[
              "px-3 py-1.5 text-xs font-heading font-bold uppercase tracking-[0.1em] border transition-colors duration-200",
              value.type === "GROUP"
                ? "border-brand-red text-white bg-brand-red/10"
                : "border-edge text-gray-500 hover:border-gray-500",
            ].join(" ")}
          >
            Grupo
          </button>
        )}

        {students.length > 0 && (
          <button
            type="button"
            disabled={disabled}
            onClick={() =>
              onChange({ type: "STUDENT", studentId: students[0].id })
            }
            className={[
              "px-3 py-1.5 text-xs font-heading font-bold uppercase tracking-[0.1em] border transition-colors duration-200",
              value.type === "STUDENT"
                ? "border-brand-red text-white bg-brand-red/10"
                : "border-edge text-gray-500 hover:border-gray-500",
            ].join(" ")}
          >
            Alumno
          </button>
        )}

        {muslibStudents && muslibStudents.length > 0 && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              // Restore last sub-mode when switching back to muslib tab.
              if (muslibMode === "group" && groups.length > 0) {
                onChange({ type: "MUSCULACION_LIBRE_GROUP", groupId: groups[0].id });
              } else {
                onChange({ type: "MUSCULACION_LIBRE", studentId: muslibStudents[0].id });
              }
            }}
            className={[
              "px-3 py-1.5 text-xs font-heading font-bold uppercase tracking-[0.1em] border transition-colors duration-200",
              isMuslib
                ? "border-brand-red text-white bg-brand-red/10"
                : "border-edge text-gray-500 hover:border-gray-500",
            ].join(" ")}
          >
            Musculación libre
          </button>
        )}
      </div>

      {value.type === "GROUP" && groups.length > 0 && (
        <select
          disabled={disabled}
          value={"groupId" in value ? value.groupId : groups[0].id}
          onChange={(e) => onChange({ type: "GROUP", groupId: e.target.value })}
          className="bg-panel border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200"
        >
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      )}

      {value.type === "STUDENT" && students.length > 0 && (
        <select
          disabled={disabled}
          value={"studentId" in value ? value.studentId : students[0].id}
          onChange={(e) =>
            onChange({ type: "STUDENT", studentId: e.target.value })
          }
          className="bg-panel border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200"
        >
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      )}

      {isMuslib && muslibStudents && muslibStudents.length > 0 && (
        <div className="flex flex-col gap-2">
          {/* Sub-mode toggle: Alumno / Grupo */}
          {groups.length > 0 && (
            <div className="flex gap-1">
              <button
                type="button"
                disabled={disabled}
                onClick={() => handleMuslibModeChange("student")}
                className={[
                  "px-2.5 py-1 text-xs font-heading font-bold uppercase tracking-[0.1em] border transition-colors duration-200",
                  value.type === "MUSCULACION_LIBRE"
                    ? "border-brand-red text-white bg-brand-red/10"
                    : "border-edge text-gray-500 hover:border-gray-500",
                ].join(" ")}
              >
                Alumno
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => handleMuslibModeChange("group")}
                className={[
                  "px-2.5 py-1 text-xs font-heading font-bold uppercase tracking-[0.1em] border transition-colors duration-200",
                  value.type === "MUSCULACION_LIBRE_GROUP"
                    ? "border-brand-red text-white bg-brand-red/10"
                    : "border-edge text-gray-500 hover:border-gray-500",
                ].join(" ")}
              >
                Grupo
              </button>
            </div>
          )}

          {/* Student sub-selector */}
          {value.type === "MUSCULACION_LIBRE" && (
            <select
              disabled={disabled}
              value={value.studentId}
              onChange={(e) =>
                onChange({ type: "MUSCULACION_LIBRE", studentId: e.target.value })
              }
              className="bg-panel border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200"
            >
              {muslibStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}

          {/* Group sub-selector */}
          {value.type === "MUSCULACION_LIBRE_GROUP" && groups.length > 0 && (
            <select
              disabled={disabled}
              value={value.groupId}
              onChange={(e) =>
                onChange({ type: "MUSCULACION_LIBRE_GROUP", groupId: e.target.value })
              }
              className="bg-panel border border-edge text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-brand-red transition-colors duration-200"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
    </div>
  );
}

export function TargetBadge({
  targetType,
  targetGroupName,
  targetStudentName,
}: {
  targetType: string;
  targetGroupName?: string | null;
  targetStudentName?: string | null;
}) {
  if (targetType === "ALL") return null;

  const label =
    targetType === "PERSONALIZED"
      ? "Personalizados"
      : targetType === "GROUP"
      ? targetGroupName ?? "Grupo"
      : targetStudentName ?? "Alumno";

  return (
    <span className="text-xs font-heading font-bold uppercase tracking-[0.1em] px-2 py-0.5 bg-brand-red/10 text-brand-red border border-brand-red/20">
      {label}
    </span>
  );
}
