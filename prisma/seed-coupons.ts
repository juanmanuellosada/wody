import { PrismaClient, CouponRule } from "@prisma/client";

const prisma = new PrismaClient();

const COUPONS: Array<{
  slug: string;
  name: string;
  description: string;
  instagramHandle: string;
  instagramUrl: string;
  logoKey: string | null;
  rule: CouponRule;
  sortOrder: number;
  requiresConsumedSlug?: string | null;
  hideWhenConsumed?: boolean;
  expiresAt?: Date | null;
  fixedCode?: string | null;
  websiteUrl?: string | null;
  restrictions?: string | null;
}> = [
  {
    slug: "nutrite-con-lu",
    name: "Nutrite con Lu",
    description:
      "Bioimpedancia de regalo con tu consulta nutricional. La consulta se abona y de regalo te hacen la bioimpedancia sin costo extra.",
    instagramHandle: "nutriteconlu",
    instagramUrl: "https://www.instagram.com/nutriteconlu",
    logoKey: "nutrite-con-lu",
    rule: CouponRule.ONCE_PER_USER,
    sortOrder: 10,
  },
  {
    slug: "ready-for-wod",
    name: "Ready For Wod · Primera compra",
    description: "10% de descuento en tu primera compra.",
    instagramHandle: "readyforwod",
    instagramUrl: "https://www.instagram.com/readyforwod",
    logoKey: "ready-for-wod",
    rule: CouponRule.ONCE_PER_USER,
    sortOrder: 20,
    hideWhenConsumed: true,
  },
  {
    slug: "ready-for-wod-recurrente",
    name: "Ready For Wod · Clientes",
    description: "5% de descuento desde tu segunda compra en adelante.",
    instagramHandle: "readyforwod",
    instagramUrl: "https://www.instagram.com/readyforwod",
    logoKey: "ready-for-wod",
    rule: CouponRule.UNLIMITED,
    sortOrder: 21,
    requiresConsumedSlug: "ready-for-wod",
  },
  {
    slug: "german-masajista",
    name: "German Masajista",
    description: "25% de descuento en masajes deportivos o relajantes.",
    instagramHandle: "masajista.ger",
    instagramUrl: "https://www.instagram.com/masajista.ger",
    logoKey: "ger",
    rule: CouponRule.UNLIMITED,
    sortOrder: 30,
  },
  {
    slug: "quinque",
    name: "Quinque · Primera compra",
    description:
      "15% de descuento en tu primera compra. Productos integrales, monto mínimo $10.000. Pastelería saludable.",
    instagramHandle: "quinque.pasteleria",
    instagramUrl: "https://www.instagram.com/quinque.pasteleria",
    logoKey: "quinque",
    rule: CouponRule.ONCE_PER_USER,
    sortOrder: 40,
    hideWhenConsumed: true,
  },
  {
    slug: "quinque-recurrente",
    name: "Quinque · Clientes",
    description:
      "15% de descuento en compras posteriores. Productos integrales, monto mínimo $10.000.",
    instagramHandle: "quinque.pasteleria",
    instagramUrl: "https://www.instagram.com/quinque.pasteleria",
    logoKey: "quinque",
    rule: CouponRule.UNLIMITED,
    sortOrder: 41,
    requiresConsumedSlug: "quinque",
  },
  {
    slug: "atodoritmo-sm",
    name: "A Todo Ritmo",
    description:
      "10% de descuento abonando en efectivo o transferencia en el total de la compra. San Miguel.",
    instagramHandle: "atodoritmosm",
    instagramUrl: "https://www.instagram.com/atodoritmosm",
    logoKey: "atr",
    rule: CouponRule.UNLIMITED,
    sortOrder: 50,
  },
  {
    slug: "becasual-ft",
    name: "Becasual FT",
    description: "10% de descuento a partir de 2 prendas.",
    instagramHandle: "becasual.ft",
    instagramUrl: "https://www.instagram.com/becasual.ft",
    logoKey: "becalsualf-ft",
    rule: CouponRule.UNLIMITED,
    sortOrder: 60,
  },
  {
    slug: "buena-vibra-sport",
    name: "Buena Vibra Sport",
    description: "10% de descuento en indumentaria deportiva.",
    instagramHandle: "buenavibrasport",
    instagramUrl: "https://www.instagram.com/buenavibrasport",
    logoKey: "bv-sports",
    rule: CouponRule.UNLIMITED,
    sortOrder: 70,
  },
  {
    slug: "ray-of-light-cursos-anuales",
    name: "Ray of Light · Cursos anuales",
    description:
      "Abril y Mayo: todavía estás a tiempo de sumarte a los cursos anuales. Sin abonar matrícula.",
    instagramHandle: "rayoflight.classes",
    instagramUrl: "https://www.instagram.com/rayoflight.classes",
    logoKey: "ray-of-light",
    rule: CouponRule.ONCE_PER_USER,
    sortOrder: 80,
    hideWhenConsumed: true,
    // Argentina UTC-3 → midnight of June 1 Arg = 03:00 UTC. Válido durante todo mayo.
    expiresAt: new Date("2026-06-01T03:00:00.000Z"),
  },
  {
    slug: "ray-of-light-clase-particular",
    name: "Ray of Light · Primera clase particular",
    description: "10% de descuento en tu primera clase particular.",
    instagramHandle: "rayoflight.classes",
    instagramUrl: "https://www.instagram.com/rayoflight.classes",
    logoKey: "ray-of-light",
    rule: CouponRule.ONCE_PER_USER,
    sortOrder: 81,
    hideWhenConsumed: true,
  },
  {
    slug: "ray-of-light-clase-online",
    name: "Ray of Light · Primera clase online",
    description: "10% de descuento en tu primera clase online.",
    instagramHandle: "rayoflight.classes",
    instagramUrl: "https://www.instagram.com/rayoflight.classes",
    logoKey: "ray-of-light",
    rule: CouponRule.ONCE_PER_USER,
    sortOrder: 82,
    hideWhenConsumed: true,
  },
  {
    slug: "tica-clothes",
    name: "Tica",
    description:
      "10% de descuento en ticaclothes.com.ar.",
    instagramHandle: "ticaclothess",
    instagramUrl: "https://www.instagram.com/ticaclothess",
    logoKey: "tica",
    rule: CouponRule.UNLIMITED,
    sortOrder: 90,
    fixedCode: "WODY10",
    websiteUrl: "https://ticaclothes.com.ar/",
    restrictions:
      "Aplican restricciones en fechas especiales y promos masivas como Cyber Monday, Black Friday, etc.",
  },
  {
    slug: "nutrilion-5-off",
    name: "Nutrilion · 5%",
    description:
      "5% de descuento en toda la tienda. Sin mínimo de compra y sin tope de reintegro.",
    instagramHandle: "nutrilion.dietetica",
    instagramUrl: "https://www.instagram.com/nutrilion.dietetica",
    logoKey: "nutrilion",
    rule: CouponRule.UNLIMITED,
    sortOrder: 100,
  },
  {
    slug: "nutrilion-10-off",
    name: "Nutrilion · 10%",
    description:
      "10% de descuento en toda la tienda. Mínimo de compra $30.000 y tope de reintegro de $10.000.",
    instagramHandle: "nutrilion.dietetica",
    instagramUrl: "https://www.instagram.com/nutrilion.dietetica",
    logoKey: "nutrilion",
    rule: CouponRule.UNLIMITED,
    sortOrder: 101,
    restrictions: "Mínimo de compra $30.000. Tope de reintegro $10.000.",
  },
  {
    slug: "florans-belleza",
    name: "Floran's Belleza",
    description: "10% de descuento en cualquier servicio.",
    instagramHandle: "floransbelleza",
    instagramUrl: "https://www.instagram.com/floransbelleza/",
    logoKey: "florans-belleza",
    rule: CouponRule.ONCE_PER_USER_PER_MONTH,
    sortOrder: 5,
  },
  {
    slug: "backerei-pasteleria-fina",
    name: "Backerei Pastelería Fina",
    description: "15% de descuento. Entregas en zona norte.",
    instagramHandle: "backerei.pasteleriafina",
    instagramUrl: "https://www.instagram.com/backerei.pasteleriafina",
    logoKey: "backerei",
    rule: CouponRule.UNLIMITED,
    sortOrder: 110,
  },
  {
    slug: "delicias-mias-by-flor",
    name: "Delicias Mías By Flor",
    description:
      "10% de descuento en panes y productos integrales a partir de 2 unidades.",
    instagramHandle: "deliciasmias.byflor",
    instagramUrl: "https://www.instagram.com/deliciasmias.byflor",
    logoKey: "delicias-mias",
    rule: CouponRule.UNLIMITED,
    sortOrder: 120,
  },
];

async function main() {
  console.log("Sembrando cupones...");

  for (const coupon of COUPONS) {
    await prisma.coupon.upsert({
      where: { slug: coupon.slug },
      create: {
        ...coupon,
        requiresConsumedSlug: coupon.requiresConsumedSlug ?? null,
        hideWhenConsumed: coupon.hideWhenConsumed ?? false,
        expiresAt: coupon.expiresAt ?? null,
        fixedCode: coupon.fixedCode ?? null,
        websiteUrl: coupon.websiteUrl ?? null,
        restrictions: coupon.restrictions ?? null,
        active: true,
      },
      update: {
        name: coupon.name,
        description: coupon.description,
        instagramHandle: coupon.instagramHandle,
        instagramUrl: coupon.instagramUrl,
        logoKey: coupon.logoKey,
        rule: coupon.rule,
        sortOrder: coupon.sortOrder,
        requiresConsumedSlug: coupon.requiresConsumedSlug ?? null,
        hideWhenConsumed: coupon.hideWhenConsumed ?? false,
        expiresAt: coupon.expiresAt ?? null,
        fixedCode: coupon.fixedCode ?? null,
        websiteUrl: coupon.websiteUrl ?? null,
        restrictions: coupon.restrictions ?? null,
      },
    });
    console.log(`  ✓ ${coupon.name}`);
  }

  const total = await prisma.coupon.count();
  console.log(`\nListo. ${total} cupones en la base.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
