interface StudentWodBadgeProps {
  targetType: "ALL" | "PERSONALIZED" | "GROUP" | "STUDENT";
  targetGroupName?: string | null;
  isOwn: boolean;
}

export function StudentWodBadge({
  targetType,
  targetGroupName,
  isOwn,
}: StudentWodBadgeProps) {
  const label =
    targetType === "ALL"
      ? "Para todos"
      : targetType === "PERSONALIZED"
      ? "Personalizada"
      : targetType === "GROUP"
      ? `Grupo: ${targetGroupName ?? "Grupo"}`
      : isOwn
      ? "Propia"
      : "Para vos";

  return (
    <span className="text-xs font-heading font-bold uppercase tracking-[0.1em] px-2 py-0.5 bg-brand-red/10 text-brand-red border border-brand-red/20">
      {label}
    </span>
  );
}
