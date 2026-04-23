import { PrismaClient, Role, GymKind } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Verificando que no exista el gym Atlas...");

  const existing = await prisma.gym.findUnique({
    where: { slug: "atlas-gym" },
  });

  if (existing) {
    console.log("El gym 'atlas-gym' ya existe. Abortando.");
    return;
  }

  console.log("Creando gym Atlas...");

  const gym = await prisma.gym.create({
    data: {
      name: "Atlas",
      slug: "atlas-gym",
      kind: GymKind.GYM,
      logo: null,
      primaryColor: "#f80710",
    },
  });

  console.log("Creando admin/profe...");

  const adminPassword = await hash("admin123", 10);

  await prisma.user.create({
    data: {
      name: "Juan Manuel Losada",
      email: "juanmalosada01@gmail.com",
      password: adminPassword,
      role: Role.ADMIN,
      gymId: gym.id,
      memberNumber: 1,
    },
  });

  console.log("\nSeed Atlas completado!");
  console.log(`  Gym: ${gym.name} (slug: ${gym.slug}, kind: ${gym.kind})`);
  console.log("\nCredenciales:");
  console.log("  Admin/Profe: juanmalosada01@gmail.com / admin123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
