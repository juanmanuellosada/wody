import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { gymPath } from "@/lib/gym";
import { prisma } from "@/lib/prisma";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from "@/lib/site";
import { ProductionLanding } from "@/components/landing/ProductionLanding";
import { BenefitsSection } from "@/components/benefits/BenefitsSection";
import { GYM_LOCATIONS } from "@/lib/gym-locations";

export const metadata: Metadata = {
  title: "Software para gimnasios y boxes de CrossFit | Wody",
  description:
    "Gestioná rutinas, marcas personales, turnos, accesos con QR y cuotas desde una sola app. Para gimnasios y boxes de Argentina.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    title: "Software para gimnasios y boxes de CrossFit | Wody",
    description:
      "Rutinas, marcas personales, turnos, acceso con QR y cuotas en una sola app para tu centro.",
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      areaServed: { "@type": "Country", name: "Argentina" },
      sameAs: ["https://www.instagram.com/wody.app/"],
    },
    {
      "@type": "SoftwareApplication",
      name: SITE_NAME,
      url: SITE_URL,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, iOS, Android",
      description: SITE_DESCRIPTION,
      inLanguage: "es-AR",
      publisher: { "@id": `${SITE_URL}/#organization` },
      offers: {
        "@type": "Offer",
        price: "40000",
        priceCurrency: "ARS",
        url: SITE_URL,
        availability: "https://schema.org/InStock",
      },
    },
  ],
};

export default async function LandingPage() {
  const session = await auth();
  if (session?.user?.role === "SUPERADMIN") redirect("/admin");
  if (session?.user?.gymSlug) {
    const { gymSlug, role } = session.user;
    if (role === "ADMIN") redirect(gymPath(gymSlug, "/admin"));
    if (role === "TEACHER") redirect(gymPath(gymSlug, "/dashboard/teacher"));
    if (role === "ACCESS") redirect(gymPath(gymSlug, "/ingresos"));
    redirect(gymPath(gymSlug, "/dashboard/athlete"));
  }

  // This remains an account lookup, not customer endorsement or social proof.
  const gyms = await prisma.gym.findMany({
    where: { blockedAt: null, kind: { not: "PERSONAL" } },
    orderBy: { createdAt: "asc" },
    select: { slug: true, name: true, logo: true, primaryColor: true, kind: true },
  });

  const accounts = gyms.map((gym) => ({
    slug: gym.slug,
    name: gym.name,
    logo: gym.logo,
    primaryColor: gym.primaryColor,
    location: GYM_LOCATIONS[gym.slug],
    kind: gym.kind === "BOX" ? ("BOX" as const) : ("GYM" as const),
  }));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <ProductionLanding accounts={accounts} supplementaryContent={<BenefitsSection />} />
    </>
  );
}
