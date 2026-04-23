import { PrismaClient, Role } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const STUDENT_EMAIL = "juanmalosada01+alumno@gmail.com";
const STUDENT_PASSWORD = "alumno123";

async function main() {
  const gym = await prisma.gym.findUnique({ where: { slug: "atlas-gym" } });
  if (!gym) {
    console.log("No existe el gym 'atlas-gym'. Corré primero seed-atlas-gym.ts.");
    return;
  }

  const admin = await prisma.user.findUnique({
    where: { email_gymId: { email: "juanmalosada01@gmail.com", gymId: gym.id } },
  });
  if (!admin) {
    console.log("No se encontró el admin en atlas-gym.");
    return;
  }

  const existing = await prisma.user.findUnique({
    where: { email_gymId: { email: STUDENT_EMAIL, gymId: gym.id } },
  });
  if (existing) {
    console.log(`El alumno '${STUDENT_EMAIL}' ya existe. Abortando.`);
    return;
  }

  console.log("Creando cuenta alumno (alias +alumno)...");

  const password = await hash(STUDENT_PASSWORD, 10);

  const maxMember = await prisma.user.aggregate({
    where: { gymId: gym.id },
    _max: { memberNumber: true },
  });
  const nextNumber = (maxMember._max.memberNumber ?? 0) + 1;

  const student = await prisma.user.create({
    data: {
      name: "Juan Manuel Losada",
      email: STUDENT_EMAIL,
      password,
      role: Role.STUDENT,
      gymId: gym.id,
      memberNumber: nextNumber,
    },
  });

  await prisma.gym.update({
    where: { id: gym.id },
    data: { nextMemberNumber: nextNumber + 1 },
  });

  await prisma.teacherStudent.create({
    data: { teacherId: admin.id, studentId: student.id },
  });

  console.log("\nListo!");
  console.log(`  Alumno: ${student.name} (memberNumber ${student.memberNumber})`);
  console.log(`  Email: ${STUDENT_EMAIL} / ${STUDENT_PASSWORD}`);
  console.log(`  Profe asignado: ${admin.name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
