import type { Metadata } from "next";
import Link from "next/link";
import { DemoNavbar } from "@/components/DemoNavbar";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";

export const metadata: Metadata = {
  title: "WODY — Demo WOD",
};

const mockWods: Record<string, { title: string; content: string; date: string }> = {
  w1: {
    title: "WOD",
    content: "## Warm Up\n3 rondas:\n- 10 air squats\n- 10 push-ups\n- 200m run\n\n## Strength\nBack Squat 5x5 @75%\n\n## MetCon\nAMRAP 12'\n- 12 Wall Balls (20/14)\n- 9 Box Jumps (24/20)\n- 6 Pull-ups",
    date: "Hoy",
  },
  w2: {
    title: "Rutina Fuerza",
    content: "## Fuerza\nDeadlift 5-5-3-3-1-1\n\n## Accessory\n3 rondas:\n- 12 Romanian DL\n- 15 Hip Thrust\n- 20 Glute Bridge",
    date: "Ayer",
  },
  w3: {
    title: "Cardio + Core",
    content: "## EMOM 20'\nMin 1: 15 cal Row\nMin 2: 12 T2B\nMin 3: 10 Burpees\nMin 4: Rest",
    date: "Hace 2 días",
  },
  w4: {
    title: "Upper Body",
    content: "## Strength\nStrict Press 5x3 @80%\nBench Press 4x8\n\n## Accessory\n3 rondas:\n- 10 DB Row\n- 12 Lateral Raises\n- 15 Tricep Pushdown",
    date: "Hace 3 días",
  },
  w5: {
    title: "WOD",
    content: "## For Time\n21-15-9\n- Thrusters (43/30)\n- Pull-ups\n\nTime cap: 10'",
    date: "Hace 4 días",
  },
};

interface Props {
  searchParams: Promise<{ id?: string }>;
}

export default async function DemoWodFullPage({ searchParams }: Props) {
  const { id } = await searchParams;
  const wod = mockWods[id ?? "w1"] ?? mockWods.w1;
  const isToday = !id || id === "w1";

  return (
    <main className="min-h-screen bg-[#0A0A0F] text-white">
      <DemoNavbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="min-h-[80vh] flex flex-col">
          {/* Top bar */}
          <div className="flex items-center justify-between gap-4 mb-6">
            <Link
              href="/demo/student"
              className="text-xs text-gray-600 hover:text-[#E31414] uppercase tracking-[0.15em] font-heading font-bold transition-colors duration-200 flex items-center gap-2 cursor-pointer"
            >
              <span aria-hidden="true">&#8592;</span> Volver
            </Link>
          </div>

          {/* Full WOD */}
          <div className="flex-1 flex flex-col items-center">
            <div className="w-full max-w-2xl">
              {/* Date header */}
              <div className="flex items-center gap-3 mb-6">
                {isToday && (
                  <span className="inline-block w-2.5 h-2.5 bg-[#E31414] flex-shrink-0 animate-pulse" aria-hidden="true" />
                )}
                <h1 className="text-2xl sm:text-4xl font-heading font-black uppercase tracking-[0.1em] text-white">
                  {isToday ? wod.title : wod.date}
                </h1>
              </div>

              {isToday ? (
                <p className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-[#E31414] mb-2">
                  {wod.date}
                </p>
              ) : (
                <p className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-gray-400 mb-2">
                  {wod.title}
                </p>
              )}

              {/* Separator */}
              <div className="w-12 h-1 bg-[#E31414] mb-8" aria-hidden="true" />

              {/* Content */}
              <MarkdownRenderer
                content={wod.content}
                className="text-base sm:text-lg [&_h1]:text-2xl [&_h1]:sm:text-3xl [&_h2]:text-xl [&_h2]:sm:text-2xl [&_li]:text-base [&_li]:sm:text-lg [&_p]:text-base [&_p]:sm:text-lg"
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
