import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gymPath } from "@/lib/gym";

interface Props {
  params: Promise<{ gymSlug: string }>;
}

export default async function TeacherDashboardPage({ params }: Props) {
  const { gymSlug } = await params;
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "TEACHER" && session.user.role !== "ADMIN")
  ) {
    redirect(gymPath(gymSlug, "/login"));
  }

  const teacherId = session.user.id;

  const teacherStudentLinks = await prisma.teacherStudent.findMany({
    where: { teacherId },
    include: {
      student: {
        include: {
          _count: { select: { wodsAsStudent: true } },
        },
      },
    },
  });

  const students = teacherStudentLinks.map((link) => ({
    id: link.student.id,
    name: link.student.name,
    email: link.student.email,
    wodCount: link.student._count.wodsAsStudent,
  }));

  return (
    <div className="flex flex-col gap-8">
      {/* Welcome header */}
      <div className="border border-[#1A1A1A] bg-[#0A0A0A] p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-[#E31414] mb-1">
              Dashboard Profe
            </p>
            <h1 className="text-2xl sm:text-3xl font-heading font-black uppercase tracking-[0.1em] text-white">
              Hola, {session.user.name?.split(" ")[0]}
            </h1>
          </div>
          <div className="flex gap-6">
            <div className="text-center">
              <p className="text-3xl font-heading font-black text-[#E31414]">{students.length}</p>
              <p className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-600">
                {students.length === 1 ? "Alumno" : "Alumnos"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Student grid */}
      {students.length === 0 ? (
        <div className="border border-[#1A1A1A] bg-[#0A0A0A] p-12 text-center">
          <div className="w-12 h-12 border border-[#2A2A2A] mx-auto mb-4 flex items-center justify-center" aria-hidden="true">
            <span className="text-gray-600 text-lg">?</span>
          </div>
          <p className="text-gray-400 text-sm font-heading font-bold uppercase tracking-[0.15em]">
            No tenes alumnos asignados todavia.
          </p>
          <p className="text-gray-700 text-xs mt-2 font-body">
            Pedile al admin que te asigne alumnos.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {students.map((student) => (
            <Link
              key={student.id}
              href={gymPath(gymSlug, `/dashboard/teacher/${student.id}`)}
              className="block group cursor-pointer"
            >
              <div className="bg-[#0A0A0A] border border-[#1A1A1A] p-5 group-hover:border-[#E31414] transition-all duration-200">
                <div className="flex items-start justify-between gap-3 mb-4">
                  {/* Avatar */}
                  <div className="w-10 h-10 bg-[#1A1A1A] border border-[#2A2A2A] flex items-center justify-center flex-shrink-0 group-hover:border-[#E31414]/30 transition-colors duration-200">
                    <span className="text-sm font-heading font-bold text-gray-400 group-hover:text-[#E31414] transition-colors duration-200">
                      {student.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span
                    className="text-[#E31414] text-lg flex-shrink-0 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200"
                    aria-hidden="true"
                  >
                    &#8594;
                  </span>
                </div>
                <p className="text-white font-heading font-bold uppercase tracking-[0.1em] text-sm truncate mb-1">
                  {student.name}
                </p>
                <p className="text-gray-600 text-xs font-body truncate mb-3">{student.email}</p>
                <div className="flex items-center gap-2 pt-3 border-t border-[#1A1A1A]">
                  <span className="text-xs font-heading font-bold text-[#E31414]">
                    {student.wodCount}
                  </span>
                  <span className="text-xs font-heading text-gray-600 uppercase tracking-[0.1em]">
                    WODs cargados
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
