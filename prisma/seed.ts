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

/**
 * Crea o actualiza los datos base del gym de muestra "Unidos Garage".
 * Esta función es idempotente: se puede llamar N veces y produce el mismo
 * estado final. Nunca borra datos existentes.
 *
 * Estrategia por modelo:
 * - Gym: upsert por slug (campo @unique)
 * - User: findFirst por (email, gymId) + create/update — el schema usa
 *   un índice único parcial de PostgreSQL (solo filas activas), no un
 *   @@unique de Prisma, por eso no podemos usar upsert directamente.
 * - TeacherStudent: upsert por @@id([teacherId, studentId])
 * - Wod: findFirst por (date, teacherId) + create si no existe
 * - RM: findFirst por (studentId, exercise, date) + create si no existe
 */
export async function seedBaseData(client: PrismaClient = prisma): Promise<void> {
  console.log("Creando/actualizando gym Unidos Garage...");

  const gym = await client.gym.upsert({
    where: { slug: "unidos-garage" },
    update: {
      name: "Unidos Garage CrossFit",
      primaryColor: "#E31414",
    },
    create: {
      name: "Unidos Garage CrossFit",
      slug: "unidos-garage",
      logo: null,
      primaryColor: "#E31414",
    },
  });

  console.log("Creando/actualizando usuarios...");

  const adminPassword = await hash("admin123", 10);
  const teacherPassword = await hash("profe123", 10);
  const studentPassword = await hash("alumno123", 10);

  // Upsert por (email, gymId): el schema usa índice parcial único de PG,
  // no @@unique de Prisma, así que usamos findFirst + create/update manual.
  async function upsertUser(
    email: string,
    gymId: string,
    defaults: Parameters<typeof client.user.create>[0]["data"]
  ) {
    const existing = await client.user.findFirst({
      where: { email, gymId, deletedAt: null },
    });
    if (existing) {
      return client.user.update({ where: { id: existing.id }, data: defaults });
    }
    return client.user.create({ data: defaults });
  }

  const admin = await upsertUser("admin@unidosgarage.com", gym.id, {
    name: "Admin Unidos Garage",
    email: "admin@unidosgarage.com",
    password: adminPassword,
    role: Role.ADMIN,
    gymId: gym.id,
    memberNumber: 1,
  });

  const teacher = await upsertUser("lucas@unidosgarage.com", gym.id, {
    name: "Lucas Profe",
    email: "lucas@unidosgarage.com",
    password: teacherPassword,
    role: Role.TEACHER,
    gymId: gym.id,
    memberNumber: 2,
  });

  const student1 = await upsertUser("martin@ejemplo.com", gym.id, {
    name: "Martin Garcia",
    email: "martin@ejemplo.com",
    password: studentPassword,
    role: Role.STUDENT,
    gymId: gym.id,
    memberNumber: 3,
  });

  const student2 = await upsertUser("valeria@ejemplo.com", gym.id, {
    name: "Valeria Lopez",
    email: "valeria@ejemplo.com",
    password: studentPassword,
    role: Role.STUDENT,
    gymId: gym.id,
    memberNumber: 4,
  });

  console.log("Creando/actualizando asignaciones profe-alumno...");

  // TeacherStudent tiene @@id([teacherId, studentId]) — upsert funciona con PK compuesta.
  const teacherStudentPairs = [
    { teacherId: teacher.id, studentId: student1.id },
    { teacherId: teacher.id, studentId: student2.id },
    { teacherId: admin.id, studentId: student1.id },
    { teacherId: admin.id, studentId: student2.id },
  ];

  for (const pair of teacherStudentPairs) {
    await client.teacherStudent.upsert({
      where: { teacherId_studentId: pair },
      update: {},
      create: pair,
    });
  }

  console.log("Creando WODs de muestra...");

  const now = new Date();
  const offset = -3 * 60 * 60 * 1000;
  const argNow = new Date(now.getTime() + offset);
  const y = argNow.getUTCFullYear();
  const m = argNow.getUTCMonth();
  const d = argNow.getUTCDate();

  const day = (daysAgo: number) => new Date(Date.UTC(y, m, d - daysAgo));

  // Wod no tiene @@unique — idempotencia via findFirst por (date, teacherId).
  const teacherWods = [
    { content: WOD_AMRAP, date: day(0), teacherId: teacher.id },
    { content: WOD_STRENGTH, date: day(1), teacherId: teacher.id },
    { content: WOD_HERO, date: day(2), teacherId: teacher.id },
    { content: WOD_EMOM, date: day(3), teacherId: teacher.id },
    { content: WOD_CHIPPER, date: day(4), teacherId: teacher.id },
    { content: WOD_TABATA, date: day(5), teacherId: teacher.id },
    { content: WOD_OLYMPIC, date: day(6), teacherId: teacher.id },
  ];

  for (const wod of teacherWods) {
    const existing = await client.wod.findFirst({
      where: { date: wod.date, teacherId: wod.teacherId, deletedAt: null },
    });
    if (!existing) {
      await client.wod.create({ data: wod });
    }
  }

  console.log("Creando RMs de muestra...");

  // RM no tiene @@unique — idempotencia via findFirst por (studentId, exercise, date).
  const rms = [
    // Martin
    { exercise: "Back Squat", weight: 120, date: day(1), studentId: student1.id },
    { exercise: "Front Squat", weight: 95, date: day(3), studentId: student1.id },
    { exercise: "Deadlift", weight: 150, date: day(2), studentId: student1.id },
    { exercise: "Clean & Jerk", weight: 90, date: day(4), studentId: student1.id },
    { exercise: "Snatch", weight: 72.5, date: day(5), studentId: student1.id },
    { exercise: "Bench Press", weight: 85, date: day(6), studentId: student1.id },
    { exercise: "Overhead Press", weight: 55, date: day(3), studentId: student1.id },
    { exercise: "Power Clean", weight: 95, date: day(1), studentId: student1.id },
    // Valeria
    { exercise: "Back Squat", weight: 85, date: day(1), studentId: student2.id },
    { exercise: "Deadlift", weight: 105, date: day(2), studentId: student2.id },
    { exercise: "Clean & Jerk", weight: 60, date: day(3), studentId: student2.id },
    { exercise: "Snatch", weight: 47.5, date: day(4), studentId: student2.id },
    { exercise: "Front Squat", weight: 70, date: day(5), studentId: student2.id },
    { exercise: "Push Jerk", weight: 52.5, date: day(2), studentId: student2.id },
  ];

  for (const rm of rms) {
    const existing = await client.rM.findFirst({
      where: {
        studentId: rm.studentId,
        exercise: rm.exercise,
        date: rm.date,
      },
    });
    if (!existing) {
      await client.rM.create({ data: rm });
    }
  }

  console.log("\nSeed idempotente completado!");
  console.log(`  Gym: ${gym.name} (slug: ${gym.slug})`);
  console.log("\nCredenciales:");
  console.log("  Admin:   admin@unidosgarage.com  / admin123");
  console.log("  Profe:   lucas@unidosgarage.com  / profe123");
  console.log("  Alumno1: martin@ejemplo.com       / alumno123");
  console.log("  Alumno2: valeria@ejemplo.com      / alumno123");
}

async function main() {
  await seedBaseData(prisma);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
