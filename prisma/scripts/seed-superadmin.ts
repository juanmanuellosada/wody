/**
 * seed-superadmin.ts — Script one-off para crear el super admin inicial.
 *
 * NO se incluye en `npm run seed` ni en ningún flujo automático.
 * Solo se corre manualmente por el owner, una vez después del deploy.
 *
 * Cómo correr:
 *   SUPERADMIN_EMAIL=admin@wody.com.ar SUPERADMIN_PASSWORD=tupassword npx tsx prisma/scripts/seed-superadmin.ts
 *
 * Idempotente: si ya existe un user con ese email y role SUPERADMIN, lo actualiza
 * (upsert). Si existe con otro rol, falla explícitamente para no pisar datos.
 *
 * Requisitos:
 *   - DATABASE_URL configurado en el entorno (o en .env.local).
 *   - SUPERADMIN_EMAIL y SUPERADMIN_PASSWORD seteados.
 *   - Password mínimo 8 caracteres.
 *
 * IMPORTANTE: No correr contra la DB de producción desde .env.local.
 * Usar una shell separada con el DATABASE_URL de prod si es necesario.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SUPERADMIN_EMAIL;
  const password = process.env.SUPERADMIN_PASSWORD;

  if (!email || !password) {
    console.error(
      "Error: SUPERADMIN_EMAIL y SUPERADMIN_PASSWORD son requeridos.\n" +
      "Uso: SUPERADMIN_EMAIL=foo@bar.com SUPERADMIN_PASSWORD=xxx npx tsx prisma/scripts/seed-superadmin.ts"
    );
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("Error: SUPERADMIN_PASSWORD debe tener al menos 8 caracteres.");
    process.exit(1);
  }

  // Check if a user with this email already exists (in any gym or as superadmin).
  const existing = await prisma.user.findFirst({
    where: { email, gymId: null },
  });

  if (existing && existing.role !== "SUPERADMIN") {
    console.error(
      `Error: Ya existe un user con email "${email}" y role "${existing.role}" (gymId null). ` +
      "Esto no debería pasar. Revisá la DB manualmente."
    );
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: {
      // There's no unique on email alone (it's partial); use findFirst above
      // and fallback to create via a non-existent id for the upsert.
      id: existing?.id ?? "non-existent-id-will-trigger-create",
    },
    update: {
      email,
      password: passwordHash,
      role: "SUPERADMIN",
    },
    create: {
      email,
      password: passwordHash,
      role: "SUPERADMIN",
      name: "Super Admin",
      gymId: null,
      memberNumber: 0,
    },
  });

  console.log(`Super admin ${existing ? "actualizado" : "creado"}: ${user.email} (id: ${user.id})`);
}

main()
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
