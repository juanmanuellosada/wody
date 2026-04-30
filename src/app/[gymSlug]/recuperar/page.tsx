import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/email/tokens";
import { gymPath } from "@/lib/gym";
import { ResetPasswordForm } from "./ResetPasswordForm";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ gymSlug: string }>;
  searchParams: Promise<{ token?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { gymSlug } = await params;
  const gym = await prisma.gym.findUnique({ where: { slug: gymSlug } });
  return { title: `Recuperar contraseña — ${gym?.name ?? "WODY"}` };
}

export default async function RecuperarPage({ params, searchParams }: Props) {
  const { gymSlug } = await params;
  const { token } = await searchParams;

  const gym = await prisma.gym.findUnique({ where: { slug: gymSlug } });
  if (!gym) notFound();

  const loginHref = gymPath(gymSlug, "/login");
  const INVALID_MSG = "Link inválido o expirado, pedí uno nuevo.";

  // No token in query string
  if (!token?.trim()) {
    return <ErrorPage message={INVALID_MSG} loginHref={loginHref} />;
  }

  const tokenHash = hashToken(token);

  const vt = await prisma.verificationToken.findUnique({
    where: { tokenHash },
    include: { user: { include: { gym: true } } },
  });

  // Token doesn't exist or wrong type
  if (!vt || vt.type !== "RESET") {
    return <ErrorPage message={INVALID_MSG} loginHref={loginHref} />;
  }

  // Token belongs to a different gym
  if (vt.user.gym.slug !== gymSlug) {
    return <ErrorPage message={INVALID_MSG} loginHref={loginHref} />;
  }

  // Token already consumed
  if (vt.consumedAt !== null) {
    return <ErrorPage message={INVALID_MSG} loginHref={loginHref} />;
  }

  // Token expired
  if (vt.expiresAt < new Date()) {
    return <ErrorPage message={INVALID_MSG} loginHref={loginHref} />;
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-black stripe-pattern">
      <div className="w-full max-w-sm">
        <div className="bg-panel border border-line p-6 sm:p-8">
          <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-brand-red mb-1">
            {gym.name}
          </p>
          <h1 className="text-lg font-heading font-black uppercase tracking-[0.1em] text-white mb-6">
            Nueva contraseña
          </h1>
          <ResetPasswordForm token={token} gymSlug={gymSlug} />
        </div>
      </div>
    </main>
  );
}

function ErrorPage({ message, loginHref }: { message: string; loginHref: string }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-black stripe-pattern">
      <div className="w-full max-w-sm">
        <div className="bg-panel border border-line p-6 sm:p-8 flex flex-col gap-4">
          <p
            className="px-4 py-3 text-sm font-heading font-bold text-brand-red border border-brand-red/40 bg-brand-red/5 uppercase tracking-wide"
            role="alert"
          >
            {message}
          </p>
          <a
            href={loginHref}
            className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400 hover:text-white transition-colors duration-200"
          >
            ← Ir al login
          </a>
        </div>
      </div>
    </main>
  );
}
