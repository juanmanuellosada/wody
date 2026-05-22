/**
 * seed-reset.ts — Script de reset destructivo para entornos locales.
 *
 * ADVERTENCIA: Este script borra TODOS los datos de Wod, RM, TeacherStudent,
 * User y Gym antes de reseedear. Solo debe correrse en DBs locales de desarrollo.
 *
 * Uso correcto:
 *   ALLOW_DESTRUCTIVE_SEED=1 npm run seed:reset
 *
 * Dos guards obligatorias (en orden):
 *   1. assertLocalDatabaseUrl() — aborta si DATABASE_URL no apunta a un host local.
 *   2. assertDestructiveSeedAllowed() — aborta si ALLOW_DESTRUCTIVE_SEED !== "1".
 *
 * Si necesitás solo agregar/actualizar datos base sin borrar nada, usá:
 *   npm run seed
 */

import { PrismaClient } from "@prisma/client";
import { assertLocalDatabaseUrl, assertDestructiveSeedAllowed } from "./seed-guards";
import { seedBaseData } from "./seed";

const prisma = new PrismaClient();

async function main() {
  // Guard 1: verificar que DATABASE_URL apunte a un host local.
  assertLocalDatabaseUrl();

  // Guard 2: verificar confirmación explícita.
  assertDestructiveSeedAllowed();

  console.log("Guards OK. Iniciando reset destructivo...");
  console.log("Limpiando base de datos...");

  await prisma.wod.deleteMany();
  await prisma.rM.deleteMany();
  await prisma.teacherStudent.deleteMany();
  await prisma.user.deleteMany();
  await prisma.gym.deleteMany();

  console.log("Base de datos limpiada.");

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
