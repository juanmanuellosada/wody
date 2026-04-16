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
    name: "Ready For Wod",
    description:
      "10% de descuento en tu primera compra. 5% desde la segunda compra en adelante.",
    instagramHandle: "readyforwod",
    instagramUrl: "https://www.instagram.com/readyforwod",
    logoKey: "ready-for-wod",
    rule: CouponRule.UNLIMITED,
    sortOrder: 20,
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
    name: "Quinque",
    description:
      "15% de descuento en productos integrales en compras de $10.000 o más. Pastelería saludable.",
    instagramHandle: "quinque.pasteleria",
    instagramUrl: "https://www.instagram.com/quinque.pasteleria",
    logoKey: "quinque",
    rule: CouponRule.UNLIMITED,
    sortOrder: 40,
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
];

async function main() {
  console.log("Sembrando cupones...");

  for (const coupon of COUPONS) {
    await prisma.coupon.upsert({
      where: { slug: coupon.slug },
      create: { ...coupon, active: true },
      update: {
        name: coupon.name,
        description: coupon.description,
        instagramHandle: coupon.instagramHandle,
        instagramUrl: coupon.instagramUrl,
        logoKey: coupon.logoKey,
        rule: coupon.rule,
        sortOrder: coupon.sortOrder,
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
