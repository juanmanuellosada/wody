import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTodayArgentina, toInputDate, formatDateArg } from "@/lib/dates";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { gymPath } from "@/lib/gym";
import Link from "next/link";

interface Props {
  params: Promise<{ gymSlug: string }>;
  searchParams: Promise<{ id?: string }>;
}

export default async function WodFullPage({ params, searchParams }: Props) {
  const { gymSlug } = await params;
  const session = await auth();

  if (!session?.user || session.user.role !== "STUDENT") {
    redirect(gymPath(gymSlug, "/login"));
  }

  const { id: wodId } = await searchParams;
  const studentId = session.user.id;
  const athletePath = gymPath(gymSlug, "/dashboard/athlete");

  // Find the teacher assigned to this student
  const teacherLink = await prisma.teacherStudent.findFirst({
    where: { studentId },
  });

  if (!teacherLink) {
    redirect(athletePath);
  }

  const teacherId = teacherLink.teacherId;

  let wod;

  if (wodId) {
    // Specific WOD by ID — verify it belongs to the student's teacher
    wod = await prisma.wod.findUnique({
      where: { id: wodId },
      select: { id: true, content: true, date: true, teacherId: true },
    });
    if (!wod || wod.teacherId !== teacherId) {
      redirect(athletePath);
    }
  } else {
    // Default: today's WOD — fetch and compare date strings to bypass
    // Prisma/pg timezone ambiguity with @db.Date columns
    const todayStr = toInputDate(getTodayArgentina());
    const teacherWods = await prisma.wod.findMany({
      where: { teacherId },
      select: { id: true, content: true, date: true, teacherId: true },
    });
    wod = teacherWods.find((w) => toInputDate(w.date) === todayStr) ?? null;
  }

  if (!wod) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-6 text-center">
        <p className="text-gray-500 text-lg font-heading font-bold uppercase tracking-[0.15em]">
          No hay WOD para mostrar
        </p>
        <Link
          href={athletePath}
          className="mt-4 text-xs font-heading font-bold uppercase tracking-[0.15em] text-[#E31414] hover:text-white transition-colors duration-200 cursor-pointer"
        >
          Volver al dashboard
        </Link>
      </div>
    );
  }

  const dateLabel = formatDateArg(wod.date);
  const isToday = toInputDate(wod.date) === toInputDate(getTodayArgentina());

  return (
    <div className="min-h-[80vh] flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <Link
          href={athletePath}
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
              {isToday ? "WOD de Hoy" : dateLabel}
            </h1>
          </div>

          {isToday && (
            <p className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-[#E31414] mb-6">
              {dateLabel}
            </p>
          )}

          {/* Separator */}
          <div className="w-12 h-1 bg-[#E31414] mb-8" aria-hidden="true" />

          {/* Content — large readable text */}
          <MarkdownRenderer
            content={wod.content}
            className="text-base sm:text-lg [&_h1]:text-2xl [&_h1]:sm:text-3xl [&_h2]:text-xl [&_h2]:sm:text-2xl [&_li]:text-base [&_li]:sm:text-lg [&_p]:text-base [&_p]:sm:text-lg"
          />
        </div>
      </div>
    </div>
  );
}
