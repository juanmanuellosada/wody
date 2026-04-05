import { PrismaClient, Role } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const WOD_AMRAP = `## WARM UP
- 400m run
- 10 air squats
- 10 push-ups
- 10 PVC pass-throughs

## WOD — AMRAP 20'
1. **5** Pull-ups
2. **10** Push-ups
3. **15** Air squats`;

const WOD_STRENGTH = `## STRENGTH
**Back Squat** — 5x5 @ 75%

## METCON — FOR TIME
**21-15-9**
1. Thrusters (43/29 kg)
2. Pull-ups`;

const WOD_HERO = `## HERO WOD — MURPH
**For Time (con chaleco 9/6 kg)**

1. 1 mile run
2. **100** Pull-ups
3. **200** Push-ups
4. **300** Air squats
5. 1 mile run

_Particionalo como quieras_`;

const WOD_EMOM = `## WARM UP
- 2 rounds:
- 200m row
- 10 ring rows
- 10 KB swings (16/12 kg)

## EMOM 16'
- Min 1: **12** Wall Balls (9/6 kg)
- Min 2: **10** Box Jumps (60/50 cm)
- Min 3: **8** Toes to Bar
- Min 4: Rest`;

const WOD_CHIPPER = `## CHIPPER — FOR TIME
- **50** Double Unders
- **40** KB Swings (24/16 kg)
- **30** Box Jumps (60/50 cm)
- **20** Hang Power Cleans (60/40 kg)
- **10** Bar Muscle-ups

## CASH OUT
3x20 GHD Sit-ups`;

const WOD_TABATA = `## SKILL
**Handstand Walk** — 10 min practice

## TABATA (8 rounds, 20" on / 10" off)
1. Assault Bike (calorias)
2. Burpees
3. DB Snatches (22.5/15 kg)
4. Sit-ups

_Score: total reps por ejercicio_`;

const WOD_OLYMPIC = `## OLYMPIC LIFTING
**Snatch Complex** — Every 2 min x 6 sets:
1. 1 Power Snatch
2. 1 Hang Squat Snatch
3. 1 Overhead Squat

_Build to heavy_

## METCON — 3 RFT
- 12 OHS (43/29 kg)
- 200m Run`;

async function main() {
  console.log("Limpiando base de datos...");

  await prisma.wod.deleteMany();
  await prisma.rM.deleteMany();
  await prisma.teacherStudent.deleteMany();
  await prisma.user.deleteMany();
  await prisma.gym.deleteMany();

  console.log("Creando gym Unidos Garage...");

  const gym = await prisma.gym.create({
    data: {
      name: "Unidos Garage CrossFit",
      slug: "unidos-garage",
      logo: null,
      primaryColor: "#E31414",
    },
  });

  console.log("Creando usuarios...");

  const adminPassword = await hash("admin123", 10);
  const teacherPassword = await hash("profe123", 10);
  const studentPassword = await hash("alumno123", 10);

  const admin = await prisma.user.create({
    data: {
      name: "Admin Unidos Garage",
      email: "admin@unidosgarage.com",
      password: adminPassword,
      role: Role.ADMIN,
      gymId: gym.id,
    },
  });

  const teacher = await prisma.user.create({
    data: {
      name: "Lucas Profe",
      email: "lucas@unidosgarage.com",
      password: teacherPassword,
      role: Role.TEACHER,
      gymId: gym.id,
    },
  });

  const student1 = await prisma.user.create({
    data: {
      name: "Martin Garcia",
      email: "martin@ejemplo.com",
      password: studentPassword,
      role: Role.STUDENT,
      gymId: gym.id,
    },
  });

  const student2 = await prisma.user.create({
    data: {
      name: "Valeria Lopez",
      email: "valeria@ejemplo.com",
      password: studentPassword,
      role: Role.STUDENT,
      gymId: gym.id,
    },
  });

  console.log("Creando asignaciones profe-alumno...");

  await prisma.teacherStudent.createMany({
    data: [
      { teacherId: teacher.id, studentId: student1.id },
      { teacherId: teacher.id, studentId: student2.id },
    ],
  });

  await prisma.teacherStudent.createMany({
    data: [
      { teacherId: admin.id, studentId: student1.id },
      { teacherId: admin.id, studentId: student2.id },
    ],
  });

  console.log("Creando WODs de muestra...");

  const now = new Date();
  const offset = -3 * 60 * 60 * 1000;
  const argNow = new Date(now.getTime() + offset);
  const y = argNow.getUTCFullYear();
  const m = argNow.getUTCMonth();
  const d = argNow.getUTCDate();

  const day = (daysAgo: number) => new Date(Date.UTC(y, m, d - daysAgo));

  // Martin — 7 WODs (today + 6 days of history)
  await prisma.wod.createMany({
    data: [
      { content: WOD_AMRAP, date: day(0), studentId: student1.id, teacherId: teacher.id },
      { content: WOD_STRENGTH, date: day(1), studentId: student1.id, teacherId: teacher.id },
      { content: WOD_HERO, date: day(2), studentId: student1.id, teacherId: teacher.id },
      { content: WOD_EMOM, date: day(3), studentId: student1.id, teacherId: teacher.id },
      { content: WOD_CHIPPER, date: day(4), studentId: student1.id, teacherId: teacher.id },
      { content: WOD_TABATA, date: day(5), studentId: student1.id, teacherId: teacher.id },
      { content: WOD_OLYMPIC, date: day(6), studentId: student1.id, teacherId: teacher.id },
    ],
  });

  // Valeria — 5 WODs
  await prisma.wod.createMany({
    data: [
      { content: WOD_STRENGTH, date: day(0), studentId: student2.id, teacherId: teacher.id },
      { content: WOD_EMOM, date: day(1), studentId: student2.id, teacherId: teacher.id },
      { content: WOD_AMRAP, date: day(2), studentId: student2.id, teacherId: teacher.id },
      { content: WOD_CHIPPER, date: day(3), studentId: student2.id, teacherId: teacher.id },
      { content: WOD_OLYMPIC, date: day(5), studentId: student2.id, teacherId: teacher.id },
    ],
  });

  console.log("Creando RMs de muestra...");

  // Martin — 8 RMs
  await prisma.rM.createMany({
    data: [
      { exercise: "Back Squat", weight: 120, date: day(1), studentId: student1.id },
      { exercise: "Front Squat", weight: 95, date: day(3), studentId: student1.id },
      { exercise: "Deadlift", weight: 150, date: day(2), studentId: student1.id },
      { exercise: "Clean & Jerk", weight: 90, date: day(4), studentId: student1.id },
      { exercise: "Snatch", weight: 72.5, date: day(5), studentId: student1.id },
      { exercise: "Bench Press", weight: 85, date: day(6), studentId: student1.id },
      { exercise: "Overhead Press", weight: 55, date: day(3), studentId: student1.id },
      { exercise: "Power Clean", weight: 95, date: day(1), studentId: student1.id },
    ],
  });

  // Valeria — 6 RMs
  await prisma.rM.createMany({
    data: [
      { exercise: "Back Squat", weight: 85, date: day(1), studentId: student2.id },
      { exercise: "Deadlift", weight: 105, date: day(2), studentId: student2.id },
      { exercise: "Clean & Jerk", weight: 60, date: day(3), studentId: student2.id },
      { exercise: "Snatch", weight: 47.5, date: day(4), studentId: student2.id },
      { exercise: "Front Squat", weight: 70, date: day(5), studentId: student2.id },
      { exercise: "Push Jerk", weight: 52.5, date: day(2), studentId: student2.id },
    ],
  });

  console.log("\nSeed completado!");
  console.log(`  Gym: ${gym.name} (slug: ${gym.slug})`);
  console.log(`  ${7 + 5} WODs creados`);
  console.log(`  ${8 + 6} RMs creados`);
  console.log("\nCredenciales:");
  console.log("  Admin:   admin@unidosgarage.com  / admin123");
  console.log("  Profe:   lucas@unidosgarage.com  / profe123");
  console.log("  Alumno1: martin@ejemplo.com       / alumno123");
  console.log("  Alumno2: valeria@ejemplo.com      / alumno123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
