import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { GYM_LOGOS_SQUARE } from "@/lib/gym-logos";
import { gymPath } from "@/lib/gym";
import { InstallPage } from "./InstallPage";
import type { Metadata } from "next";

import wodyTexto from "@/logos/wody-texto.png";

interface Props {
  params: Promise<{ gymSlug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { gymSlug } = await params;
  const gym = await prisma.gym.findUnique({ where: { slug: gymSlug } });
  return { title: `Instalar — ${gym?.name ?? "WODY"}` };
}

export default async function InstallarPage({ params }: Props) {
  const { gymSlug } = await params;
  const gym = await prisma.gym.findUnique({ where: { slug: gymSlug } });
  if (!gym) notFound();

  const staticLogo = GYM_LOGOS_SQUARE[gymSlug];

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-black stripe-pattern relative">
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-20 bg-gradient-to-b from-transparent to-brand-red/50"
        aria-hidden="true"
      />

      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          {staticLogo ? (
            <Image
              src={staticLogo}
              alt={gym.name}
              width={140}
              height={140}
              className="w-28 h-auto mx-auto mb-4"
              priority
            />
          ) : gym.logo ? (
            <Image
              src={gym.logo}
              alt={gym.name}
              width={140}
              height={140}
              unoptimized
              className="w-28 h-auto mx-auto mb-4 object-contain"
              priority
            />
          ) : (
            <p className="text-2xl font-heading font-black uppercase tracking-[0.1em] text-white mb-4">
              {gym.name}
            </p>
          )}
          <div className="w-10 h-0.5 bg-brand-red mx-auto mb-3" aria-hidden="true" />
          <Image
            src={wodyTexto}
            alt="WODY"
            width={80}
            height={22}
            className="w-16 h-auto mx-auto opacity-50"
            priority
          />
        </div>

        <InstallPage gymSlug={gymSlug} gymName={gym.name} />

        <div className="text-center mt-6">
          <Link
            href={gymPath(gymSlug, "/login")}
            className="text-xs text-gray-500 hover:text-gray-300 font-heading uppercase tracking-[0.1em] transition-colors duration-200"
          >
            Continuar al login
          </Link>
        </div>
      </div>
    </main>
  );
}
