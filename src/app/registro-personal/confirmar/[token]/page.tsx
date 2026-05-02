import Link from "next/link";
import type { Metadata } from "next";
import { confirmPersonalAccount } from "@/actions/personal-registration";

export const metadata: Metadata = {
  title: "Confirmar cuenta — Wody Personal",
};

interface Props {
  params: Promise<{ token: string }>;
}

const REASON_MESSAGES: Record<string, string> = {
  expired: "Tu link expiró. Los links de confirmación son válidos por 48 horas.",
  consumed: "Ya activaste esta cuenta. Podés iniciar sesión directamente.",
  invalid_token: "El link de confirmación es inválido.",
};

export default async function ConfirmarPersonalPage({ params }: Props) {
  const { token } = await params;

  const result = await confirmPersonalAccount({ token });

  if (result.ok) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-black">
        <div className="w-full max-w-sm">
          <div className="bg-panel border border-line p-6 sm:p-8">
            <h1 className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-gray-400 mb-4">
              Confirmación de cuenta
            </h1>
            <div
              role="status"
              className="px-4 py-3 text-sm font-heading font-bold text-green-500 border border-green-500/40 bg-green-500/5 uppercase tracking-wide mb-4"
            >
              <p className="mb-1">Tu cuenta está activa.</p>
              <p className="normal-case font-body font-normal text-green-400 mt-2">
                Ya podés iniciar sesión en Wody Personal con el email y la contraseña que usaste para registrarte.
              </p>
            </div>
            <Link
              href="/personal/login"
              className="inline-block mt-2 px-4 py-2 text-xs font-heading font-bold uppercase tracking-[0.15em] bg-brand-red text-white hover:bg-brand-red/80 transition-colors"
            >
              Iniciar sesión
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const message = REASON_MESSAGES[result.reason] ?? "El link de confirmación no es válido.";

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-black">
      <div className="w-full max-w-sm">
        <div className="bg-panel border border-line p-6 sm:p-8">
          <h1 className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-gray-400 mb-4">
            Confirmación de cuenta
          </h1>
          <div
            role="alert"
            className="px-4 py-3 text-sm font-heading font-bold text-brand-red border border-brand-red/40 bg-brand-red/5 uppercase tracking-wide mb-6"
          >
            {message}
          </div>
          <Link
            href="/registro-personal"
            className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-brand-red hover:text-white transition-colors"
          >
            Volver al registro
          </Link>
        </div>
      </div>
    </main>
  );
}
