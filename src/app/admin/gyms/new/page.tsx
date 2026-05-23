import Link from "next/link";
import { GymForm } from "@/components/admin/GymForm";

export default function NewGymPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-brand-red mb-1">
          <Link href="/admin/gyms" className="hover:underline">Gyms</Link>
          {" / "}Nuevo
        </p>
        <h1 className="text-2xl font-heading font-black uppercase tracking-[0.1em] text-white">
          Nuevo Gym
        </h1>
      </div>

      <GymForm />
    </div>
  );
}
