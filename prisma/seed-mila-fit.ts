import { PrismaClient, Role, GymKind } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Verificando que no exista el gym Mila Fit...");

  const existing = await prisma.gym.findUnique({
    where: { slug: "mila-fit" },
  });

  if (existing) {
    console.log("El gym 'mila-fit' ya existe. Abortando.");
    return;
  }

  console.log("Creando gym Mila Fit...");

  const gym = await prisma.gym.create({
    data: {
      name: "Mila Fit",
      slug: "mila-fit",
      kind: GymKind.GYM,
      logo: null,
      primaryColor: "#f80710",
    },
  });

  console.log("Creando admin/profe...");

  const adminPassword = await hash("admin123", 10);

  await prisma.user.create({
    data: {
      name: "Marianella Reinki",
      email: "marianellareinki+mila@hotmail.com",
      password: adminPassword,
      role: Role.ADMIN,
      gymId: gym.id,
      memberNumber: 1,
    },
  });

  console.log("\nSeed Mila Fit completado!");
  console.log(`  Gym: ${gym.name} (slug: ${gym.slug}, kind: ${gym.kind})`);
  console.log("\nCredenciales:");
  console.log("  Admin/Profe: marianellareinki+mila@hotmail.com / admin123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
