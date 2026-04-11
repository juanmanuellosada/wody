"use client";

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
  value: WodTarget;
  onChange: (target: WodTarget) => void;
  disabled?: boolean;
}

export function TargetSelector({
  groups,
  students,
  value,
  onChange,
  disabled,
}: TargetSelectorProps) {
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
              ? "border-[#E31414] text-white bg-[#E31414]/10"
              : "border-[#2A2A2A] text-gray-500 hover:border-gray-500",
          ].join(" ")}
        >
          Todos
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
                ? "border-[#E31414] text-white bg-[#E31414]/10"
                : "border-[#2A2A2A] text-gray-500 hover:border-gray-500",
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
                ? "border-[#E31414] text-white bg-[#E31414]/10"
                : "border-[#2A2A2A] text-gray-500 hover:border-gray-500",
            ].join(" ")}
          >
            Alumno
          </button>
        )}
      </div>

      {value.type === "GROUP" && groups.length > 0 && (
        <select
          disabled={disabled}
          value={"groupId" in value ? value.groupId : groups[0].id}
          onChange={(e) => onChange({ type: "GROUP", groupId: e.target.value })}
          className="bg-[#0A0A0A] border border-[#2A2A2A] text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-[#E31414] transition-colors duration-200"
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
          className="bg-[#0A0A0A] border border-[#2A2A2A] text-white text-sm font-body px-3 py-2 focus:outline-none focus:border-[#E31414] transition-colors duration-200"
        >
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
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
    targetType === "GROUP"
      ? targetGroupName ?? "Grupo"
      : targetStudentName ?? "Alumno";

  return (
    <span className="text-xs font-heading font-bold uppercase tracking-[0.1em] px-2 py-0.5 bg-[#E31414]/10 text-[#E31414] border border-[#E31414]/20">
      {label}
    </span>
  );
}
