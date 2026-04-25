import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gymPath } from "@/lib/gym";
import { gymTerms } from "@/lib/gym-terms";

import wodyTexto from "@/logos/wody-texto.png";
import { GYM_LOGOS_SQUARE } from "@/lib/gym-logos";
import { GYM_LOCATIONS } from "@/lib/gym-locations";

interface GymLandingProps {
  params: Promise<{ gymSlug: string }>;
}

export default async function GymLandingPage({ params }: GymLandingProps) {
  const { gymSlug } = await params;

  const gym = await prisma.gym.findUnique({ where: { slug: gymSlug } });
  if (!gym) notFound();

  // If already logged in to THIS gym, go to dashboard
  const session = await auth();
  if (session?.user && session.user.gymSlug === gymSlug) {
    const role = session.user.role;
    if (role === "ADMIN") redirect(gymPath(gymSlug, "/admin"));
    if (role === "TEACHER") redirect(gymPath(gymSlug, "/dashboard/teacher"));
    redirect(gymPath(gymSlug, "/dashboard/athlete"));
  }

  const staticLogo = GYM_LOGOS_SQUARE[gymSlug];
  const terms = gymTerms(gym.kind);

  return (
    <main className="min-h-screen flex flex-col bg-black">
      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-16 sm:py-24 text-center overflow-hidden stripe-pattern relative">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-16 sm:h-24 bg-gradient-to-b from-transparent to-brand-red line-expand"
          aria-hidden="true"
        />

        {/* WODY logo */}
        <div className="mb-6 sm:mb-8">
          <Image
            src={wodyTexto}
            alt="WODY"
            width={280}
            height={80}
            className="w-48 sm:w-72 h-auto mx-auto"
            priority
          />
        </div>

        <p className="text-xs font-heading font-bold uppercase tracking-[0.3em] text-gray-500 mb-6 sm:mb-8">
          Sistema de entrenamiento para
        </p>

        {/* Gym logo */}
        <div className="mb-6 sm:mb-8">
          {staticLogo ? (
            <Image
              src={staticLogo}
              alt={gym.name}
              width={160}
              height={160}
              className="w-28 sm:w-40 h-auto mx-auto"
              priority
            />
          ) : (
            <h1 className="text-4xl sm:text-6xl font-heading font-black uppercase tracking-tight text-white">
              {gym.name}
            </h1>
          )}
        </div>

        <div className="w-12 sm:w-16 h-1 bg-brand-red my-4 sm:my-6 line-expand" aria-hidden="true" />

        <p className="text-sm sm:text-base text-gray-400 max-w-md mb-8 sm:mb-10 leading-relaxed font-body">
          {GYM_LOCATIONS[gymSlug] ? (
            <>
              {GYM_LOCATIONS[gymSlug]}.
              <br />
              Gestiona tus entrenamientos y records personales.
            </>
          ) : (
            <>Gestiona tus entrenamientos y records personales.</>
          )}
        </p>

        <Link
          href={gymPath(gymSlug, "/login")}
          className="relative z-10 inline-block px-10 sm:px-12 py-4 font-heading font-black uppercase tracking-[0.2em] text-white text-sm sm:text-base bg-brand-red hover:bg-brand-red-dark active:bg-brand-red-active transition-colors duration-200 cursor-pointer"
        >
          Ingresar
        </Link>

        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-px h-16 bg-gradient-to-t from-transparent to-brand-red/40"
          aria-hidden="true"
        />
      </section>

      {/* Features */}
      <section className="border-t border-line py-16 sm:py-20 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-12 sm:gap-8">
          <Pillar label={terms.wod} sublabel="Entrenamiento del dia" />
          <Pillar label={terms.rm} sublabel={terms.rmPillarSublabel} />
          <Pillar label="TRACK" sublabel="Seguimiento personalizado" />
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 text-center border-t border-line">
        <p className="text-xs text-gray-500 font-body tracking-wide">
          &copy; {new Date().getFullYear()} {gym.name} &mdash; Powered by WODY
        </p>
      </footer>
    </main>
  );
}

function Pillar({ label, sublabel }: { label: string; sublabel: string }) {
  return (
    <div className="text-center group">
      <div className="text-3xl sm:text-4xl font-heading font-black uppercase tracking-wider text-brand-red mb-2 group-hover:tracking-[0.2em] transition-all duration-300">
        {label}
      </div>
      <div className="w-8 h-0.5 bg-edge group-hover:bg-brand-red mx-auto mb-3 transition-colors duration-300" />
      <p className="text-xs text-gray-500 uppercase tracking-[0.2em] font-heading font-medium">
        {sublabel}
      </p>
    </div>
  );
}
