import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LoginForm } from "@/components/LoginForm";
import { gymPath } from "@/lib/gym";
import type { Metadata } from "next";

import wodyTexto from "@/logos/wody-texto.png";
import unidosLogo from "@/logos/unidos-logo-completo.png";
import rompiendoLogo from "@/logos/rompiendo-limites.png";

interface LoginPageProps {
  params: Promise<{ gymSlug: string }>;
}

export async function generateMetadata({ params }: LoginPageProps): Promise<Metadata> {
  const { gymSlug } = await params;
  const gym = await prisma.gym.findUnique({ where: { slug: gymSlug } });
  const gymName = gym?.name ?? "WODY";
  return { title: `Ingresar — ${gymName}` };
}

// Map gym slugs to their static logo imports
const GYM_LOGOS: Record<string, typeof unidosLogo> = {
  "unidos-garage": unidosLogo,
  "rompiendo-limites": rompiendoLogo,
};

export default async function LoginPage({ params }: LoginPageProps) {
  const { gymSlug } = await params;

  const gym = await prisma.gym.findUnique({ where: { slug: gymSlug } });
  if (!gym) notFound();

  const session = await auth();
  if (session?.user && session.user.gymSlug === gymSlug) {
    const role = session.user.role;
    if (role === "ADMIN") redirect(gymPath(gymSlug, "/admin"));
    if (role === "TEACHER") redirect(gymPath(gymSlug, "/dashboard/teacher"));
    redirect(gymPath(gymSlug, "/dashboard/athlete"));
  }

  const staticLogo = GYM_LOGOS[gymSlug];

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-black stripe-pattern relative">
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-20 bg-gradient-to-b from-transparent to-brand-red/50"
        aria-hidden="true"
      />

      <div className="w-full max-w-sm">
        {/* Gym logo */}
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

        {/* Form */}
        <div className="bg-panel border border-line p-6 sm:p-8">
          <h2 className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-gray-400 mb-6">
            Iniciar sesion
          </h2>
          <LoginForm gymSlug={gymSlug} />
        </div>
      </div>
    </main>
  );
}
