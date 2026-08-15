"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { setGymModules } from "@/actions/super-admin/gym";

interface Props {
  gymId: string;
  bookingEnabled: boolean;
  trainingEnabled: boolean;
}

export function GymModulesSection({
  gymId,
  bookingEnabled: initialBookingEnabled,
  trainingEnabled: initialTrainingEnabled,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [bookingEnabled, setBookingEnabled] = useState(initialBookingEnabled);
  const [trainingEnabled, setTrainingEnabled] = useState(initialTrainingEnabled);

  function handleSave() {
    startTransition(async () => {
      const result = await setGymModules(gymId, bookingEnabled, trainingEnabled);
      if (result.success) {
        toast.success("Módulos actualizados.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="border-t border-line pt-6 mt-6 max-w-2xl flex flex-col gap-3">
      <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-500">
        Módulos
      </p>

      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={bookingEnabled}
          onChange={(e) => setBookingEnabled(e.target.checked)}
          className="w-4 h-4 accent-brand-red"
        />
        <span className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400">
          Turnos
        </span>
      </label>

      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={trainingEnabled}
          onChange={(e) => setTrainingEnabled(e.target.checked)}
          className="w-4 h-4 accent-brand-red"
        />
        <span className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400">
          Entrenamiento (WODs, RMs, rutinas)
        </span>
      </label>

      <Button type="button" size="sm" loading={isPending} onClick={handleSave}>
        Guardar módulos
      </Button>
    </div>
  );
}
