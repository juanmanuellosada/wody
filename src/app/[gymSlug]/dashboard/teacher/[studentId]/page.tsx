import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { WodManagerClient } from "@/components/wod/WodManagerClient";
import { gymPath } from "@/lib/gym";

interface Props {
  params: Promise<{ gymSlug: string; studentId: string }>;
}

export default async function TeacherStudentPage({ params }: Props) {
  const { gymSlug, studentId } = await params;
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "TEACHER" && session.user.role !== "ADMIN")
  ) {
    redirect(gymPath(gymSlug, "/login"));
  }

  const teacherId = session.user.id;

  // Verify the student exists and is assigned to this teacher
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: { id: true, name: true, email: true },
  });

  if (!student) notFound();

  const link = await prisma.teacherStudent.findFirst({
    where: { teacherId, studentId },
  });

  if (!link) notFound();

  const wods = await prisma.wod.findMany({
    where: { studentId },
    orderBy: { date: "desc" },
    select: { id: true, content: true, date: true },
  });

  const teacherStudentLinks = await prisma.teacherStudent.findMany({
    where: { teacherId },
    include: {
      student: { select: { id: true, name: true } },
    },
  });

  const allStudents = teacherStudentLinks.map((l) => l.student);

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <Link
          href={gymPath(gymSlug, "/dashboard/teacher")}
          className="text-xs text-gray-600 hover:text-[#E31414] uppercase tracking-[0.15em] font-heading font-bold transition-colors duration-200 flex items-center gap-2 cursor-pointer"
        >
          <span aria-hidden="true">&#8592;</span> Mis Alumnos
        </Link>
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-black uppercase tracking-[0.1em] text-white">
            {student.name}
          </h1>
          <p className="text-gray-600 text-xs font-body mt-1">{student.email}</p>
        </div>
      </div>

      <WodManagerClient
        studentId={studentId}
        wods={wods}
        allStudents={allStudents}
      />
    </div>
  );
}
