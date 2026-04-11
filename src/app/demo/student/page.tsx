import type { Metadata } from "next";
import { DemoNavbar } from "@/components/DemoNavbar";
import { WodCard } from "@/components/wod/WodCard";
import { WodHistory } from "@/components/wod/WodHistory";

export const metadata: Metadata = {
  title: "WODY — Demo Alumno",
};

const today = new Date();
const yesterday = new Date(today.getTime() - 86400000);
const twoDaysAgo = new Date(today.getTime() - 86400000 * 2);
const threeDaysAgo = new Date(today.getTime() - 86400000 * 3);
const fourDaysAgo = new Date(today.getTime() - 86400000 * 4);

const todayWod = {
  id: "w1",
  title: "WOD",
  content: "## Warm Up\n3 rondas:\n- 10 air squats\n- 10 push-ups\n- 200m run\n\n## Strength\nBack Squat 5x5 @75%\n\n## MetCon\nAMRAP 12'\n- 12 Wall Balls (20/14)\n- 9 Box Jumps (24/20)\n- 6 Pull-ups",
  date: today,
};

const historyWods = [
  {
    id: "w2",
    title: "Rutina Fuerza",
    content: "## Fuerza\nDeadlift 5-5-3-3-1-1\n\n## Accessory\n3 rondas:\n- 12 Romanian DL\n- 15 Hip Thrust\n- 20 Glute Bridge",
    date: yesterday,
  },
  {
    id: "w3",
    title: "Cardio + Core",
    content: "## EMOM 20'\nMin 1: 15 cal Row\nMin 2: 12 T2B\nMin 3: 10 Burpees\nMin 4: Rest",
    date: twoDaysAgo,
  },
  {
    id: "w4",
    title: "Upper Body",
    content: "## Strength\nStrict Press 5x3 @80%\nBench Press 4x8\n\n## Accessory\n3 rondas:\n- 10 DB Row\n- 12 Lateral Raises\n- 15 Tricep Pushdown",
    date: threeDaysAgo,
  },
  {
    id: "w5",
    title: "WOD",
    content: "## For Time\n21-15-9\n- Thrusters (43/30)\n- Pull-ups\n\nTime cap: 10'",
    date: fourDaysAgo,
  },
];

export default function DemoStudentPage() {
  return (
    <main className="min-h-screen bg-[#0A0A0F] text-white">
      <DemoNavbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-10">
        {/* Today's WOD */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <h1 className="text-2xl sm:text-3xl font-heading font-black uppercase tracking-[0.1em] text-white">
              WOD de Hoy
            </h1>
            <span className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-[#E31414]">
              Ver en grande
            </span>
          </div>
          <WodCard wod={todayWod} highlight />
        </section>

        {/* History */}
        <section>
          <div className="flex items-center gap-4 mb-5">
            <h2 className="text-lg font-heading font-bold uppercase tracking-[0.15em] text-gray-400">
              Historial
            </h2>
            <div className="flex-1 h-px bg-[#1A1A1A]" aria-hidden="true" />
          </div>
          <WodHistory wods={historyWods} wodPath="/demo/student" />
        </section>
      </div>
    </main>
  );
}
