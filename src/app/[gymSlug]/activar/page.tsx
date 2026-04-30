import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/email/tokens";
import { gymPath } from "@/lib/gym";
import { ActivateForm } from "./ActivateForm";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ gymSlug: string }>;
  searchParams: Promise<{ token?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { gymSlug } = await params;
  const gym = await prisma.gym.findUnique({ where: { slug: gymSlug } });
  return { title: `Activar cuenta — ${gym?.name ?? "WODY"}` };
}

export default async function ActivarPage({ params, searchParams }: Props) {
  const { gymSlug } = await params;
  const { token } = await searchParams;

  const gym = await prisma.gym.findUnique({ where: { slug: gymSlug } });
  if (!gym) notFound();

  const loginHref = gymPath(gymSlug, "/login");

  // No token in query string
  if (!token?.trim()) {
    return <ErrorPage message="Link inválido." loginHref={loginHref} />;
  }

  const tokenHash = hashToken(token);

  const vt = await prisma.verificationToken.findUnique({
    where: { tokenHash },
    include: { user: { include: { gym: true } } },
  });

  // Token doesn't exist or wrong type
  if (!vt || vt.type !== "INVITE") {
    return <ErrorPage message="Link inválido." loginHref={loginHref} />;
  }

  // Token belongs to a different gym
  if (vt.user.gym.slug !== gymSlug) {
    return <ErrorPage message="Link inválido." loginHref={loginHref} />;
  }

  // Token already consumed
  if (vt.consumedAt !== null) {
    return (
      <ErrorPage
        message="Este link ya fue usado. Si olvidaste tu contraseña, usá 'Olvidé mi contraseña' en el login."
        loginHref={loginHref}
      />
    );
  }

  // Token expired
  if (vt.expiresAt < new Date()) {
    return (
      <ErrorPage
        message="Este link expiró. Pedile a tu admin que reenvíe la invitación."
        loginHref={loginHref}
      />
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-black stripe-pattern">
      <div className="w-full max-w-sm">
        <div className="bg-panel border border-line p-6 sm:p-8">
          <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-brand-red mb-1">
            {vt.user.gym.name}
          </p>
          <h1 className="text-lg font-heading font-black uppercase tracking-[0.1em] text-white mb-1">
            Hola, {vt.user.name.split(" ")[0]}
          </h1>
          <p className="text-xs text-gray-500 font-body mb-6">
            Definí tu contraseña para activar tu cuenta.
          </p>
          <ActivateForm token={token} gymSlug={gymSlug} />
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
