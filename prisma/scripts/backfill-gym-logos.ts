/**
 * backfill-gym-logos.ts — Script one-off, correr UNA sola vez después de la migración.
 *
 * Setea el campo `Gym.logo` para los 4 gyms originales que fueron creados por seed
 * antes de que la landing fuera DB-driven. Sus logos viven en /public/logos/{slug}.png
 * y la URL es un path absoluto servido por Next.js.
 *
 * Cómo correr:
 *   npx tsx prisma/scripts/backfill-gym-logos.ts
 *
 * Idempotente: solo actualiza si el campo `logo` está vacío o null.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const LOGO_MAP: Record<string, string> = {
  "unidos-garage": "/logos/unidos-logo-completo.png",
  "rompiendo-limites": "/logos/rompiendo-limites.png",
  "atlas-gym": "/logos/atlas-gym.png",
  "mila-fit": "/logos/mila-fit.png",
};

async function main() {
  console.log("Iniciando backfill de logos de gyms...");

  for (const [slug, logoPath] of Object.entries(LOGO_MAP)) {
    const gym = await prisma.gym.findUnique({ where: { slug } });
    if (!gym) {
      console.log(`  [skip] Gym "${slug}" no encontrado en la DB.`);
      continue;
    }
    if (gym.logo) {
      console.log(`  [skip] Gym "${slug}" ya tiene logo: ${gym.logo}`);
      continue;
    }
    await prisma.gym.update({
      where: { slug },
      data: { logo: logoPath },
    });
    console.log(`  [ok] Gym "${slug}" → logo seteado a "${logoPath}"`);
  }

  console.log("Backfill terminado.");
}

main()
  .catch((err) => {
    console.error("Error en backfill:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
