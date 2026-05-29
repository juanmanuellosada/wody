import Link from "next/link";
import { validateOnboardingToken } from "@/actions/onboarding";
import { OnboardingForm } from "@/components/onboarding/OnboardingForm";

interface Props {
  params: Promise<{ token: string }>;
}

export const dynamic = "force-dynamic";

function ErrorPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[#0A0A0F] text-white px-6 py-12">
      <div className="w-full max-w-sm bg-white/[0.03] border border-white/[0.08] p-8 flex flex-col gap-5 text-center">
        <div
          className="w-12 h-12 mx-auto rounded-full bg-brand-red/10 border border-brand-red/30 flex items-center justify-center text-brand-red text-xl"
          aria-hidden="true"
        >
          &#33;
        </div>
        <div>
          <h1 className="text-lg font-heading font-black uppercase tracking-[0.05em] text-white mb-2">
            {title}
          </h1>
          <p className="text-xs text-gray-500 font-body leading-relaxed">{description}</p>
        </div>
        <Link
          href="/"
          className="inline-block px-6 py-3 bg-brand-red text-white font-heading font-bold uppercase tracking-[0.15em] text-xs hover:bg-brand-red-dark transition-colors duration-200"
        >
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}

export default async function OnboardingPage({ params }: Props) {
  const { token } = await params;

  const result = await validateOnboardingToken(token);

  if (!result.valid) {
    if (result.reason === "used") {
      return (
        <ErrorPage
          title="Tu gym ya está listo"
          description="Este link ya fue utilizado para completar el onboarding. Ingresá con tu email y contraseña."
        />
      );
    }
    if (result.reason === "expired") {
      return (
        <ErrorPage
          title="Este link expiró"
          description="El link de onboarding venció. Contactanos para que generemos uno nuevo."
        />
      );
    }
    return (
      <ErrorPage
        title="Link no válido"
        description="Este link no es válido o ya fue utilizado. Si creés que es un error, contactanos."
      />
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[#0A0A0F] text-white px-6 py-12">
      <OnboardingForm token={token} request={result.request} />
    </main>
  );
}
