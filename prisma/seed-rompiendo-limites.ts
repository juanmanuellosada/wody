import { PrismaClient, Role } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const WOD_FUNCTIONAL = `## WARM UP
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

async function main() {
  console.log("Verificando que no exista el gym Rompiendo Limites...");

  const existing = await prisma.gym.findUnique({
    where: { slug: "rompiendo-limites" },
  });

  if (existing) {
    console.log("El gym 'rompiendo-limites' ya existe. Abortando.");
    return;
  }

  console.log("Creando gym Rompiendo Limites CrossFit...");

  const gym = await prisma.gym.create({
    data: {
      name: "Rompiendo Limites CrossFit",
      slug: "rompiendo-limites",
      logo: null,
      primaryColor: "#7ed957",
    },
  });

  console.log("Creando admin/profe...");

  const adminPassword = await hash("admin123", 10);

  const admin = await prisma.user.create({
    data: {
      name: "Jesica Lescano",
      email: "lescanojess111@gmail.com",
      password: adminPassword,
      role: Role.ADMIN,
      gymId: gym.id,
      memberNumber: 1,
      qrToken: require("node:crypto").randomBytes(32).toString("base64url"),
    },
  });

  console.log("Creando WODs de muestra...");

  const now = new Date();
  const offset = -3 * 60 * 60 * 1000;
  const argNow = new Date(now.getTime() + offset);
  const y = argNow.getUTCFullYear();
  const m = argNow.getUTCMonth();
  const d = argNow.getUTCDate();

  const day = (daysAgo: number) => new Date(Date.UTC(y, m, d - daysAgo));

  await prisma.wod.createMany({
    data: [
      { content: WOD_FUNCTIONAL, date: day(0), teacherId: admin.id },
      { content: WOD_STRENGTH, date: day(1), teacherId: admin.id },
      { content: WOD_EMOM, date: day(2), teacherId: admin.id },
    ],
  });

  console.log("\nSeed Rompiendo Limites completado!");
  console.log(`  Gym: ${gym.name} (slug: ${gym.slug})`);
  console.log(`  3 WODs creados`);
  console.log("\nCredenciales:");
  console.log("  Admin/Profe: lescanojess111@gmail.com / admin123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
