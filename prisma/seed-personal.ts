import { PrismaClient, GymKind } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Verificando si ya existe un gym PERSONAL...");

  const existing = await prisma.gym.findFirst({
    where: { kind: GymKind.PERSONAL },
  });

  if (existing) {
    console.log(
      `El gym personal ya existe (id: ${existing.id}, slug: ${existing.slug}). Skip.`
    );
    return;
  }

  // Detectar colisión accidental: slug "personal" tomado por un gym de otro kind.
  const slugConflict = await prisma.gym.findUnique({
    where: { slug: "personal" },
  });

  if (slugConflict) {
    throw new Error(
      `Colisión de slug: ya existe un gym con slug "personal" pero kind="${slugConflict.kind}" (id: ${slugConflict.id}). ` +
        `Revisá la base de datos antes de continuar.`
    );
  }

  console.log('Creando gym personal con slug "personal"...');

  const gym = await prisma.gym.create({
    data: {
      name: "Wody Personal",
      slug: "personal",
      kind: GymKind.PERSONAL,
      nextMemberNumber: 1,
    },
  });

  console.log("\nSeed personal completado!");
  console.log(`  Gym: ${gym.name} (id: ${gym.id}, slug: ${gym.slug}, kind: ${gym.kind})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
