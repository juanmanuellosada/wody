"use client";

import { useEffect, useRef, useState } from "react";
import { CreditCard, Loader2, CheckCircle, AlertTriangle } from "lucide-react";

// ---------------------------------------------------------------------------
// Minimal typings for the MercadoPago JS SDK (CardForm API).
// The full @mercadopago/sdk-js package ships only as a CDN script; its types
// are not included. We declare only what we use.
// ---------------------------------------------------------------------------

interface MpCardFormField {
  mount: (containerId: string) => void;
  unmount: () => void;
}

interface MpCardFormInstance {
  cardForm: MpCardFormField;
  getCardFormData: () => Promise<{
    token: string;
    paymentMethod: { id: string };
    issuerId: string;
    installments: string;
  }>;
}

interface MpCardFormOptions {
  amount: string;
  autoMount: boolean;
  form: {
    id: string;
    cardholderName: { id: string; placeholder: string };
    cardNumber: { id: string; placeholder: string };
    expirationDate: { id: string; placeholder: string };
    securityCode: { id: string; placeholder: string };
    installments: { id: string };
    identificationType: { id: string };
    identificationNumber: { id: string; placeholder: string };
    cardholderEmail: { id: string; placeholder: string; value?: string };
  };
  callbacks: {
    onFormMounted?: (error?: Error) => void;
    onSubmit?: (event: Event, data: { token: string; paymentMethod: { id: string }; issuerId: string; installments: string }) => void | Promise<void>;
    onFetching?: (resource: string) => (() => void) | undefined;
  };
}

interface MpInstance {
  cardForm: (options: MpCardFormOptions) => MpCardFormInstance;
}

declare global {
  interface Window {
    MercadoPago?: new (publicKey: string, options?: { locale: string }) => MpInstance;
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  /** Called with the card_token_id when the user submits the card. */
  onToken: (cardTokenId: string, payerEmail: string) => Promise<void>;
  /** Optional: pre-fill the email field (e.g. the logged-in user's email). */
  payerEmail?: string;
  /** Monthly amount displayed to the user (for context in the form). */
  monthlyAmountLabel: string;
  /** Hint shown under the submit button about when the charge occurs. */
  chargeHint: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MpCardForm({ onToken, payerEmail, monthlyAmountLabel, chargeHint }: Props) {
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const cardFormRef = useRef<MpCardFormInstance | null>(null);
  const mpInstanceRef = useRef<MpInstance | null>(null);

  // Load MP SDK script once
  useEffect(() => {
    if (document.getElementById("mp-sdk-script")) {
      if (window.MercadoPago) setSdkLoaded(true);
      return;
    }
    const script = document.createElement("script");
    script.id = "mp-sdk-script";
    script.src = "https://sdk.mercadopago.com/js/v2";
    script.async = true;
    script.onload = () => setSdkLoaded(true);
    script.onerror = () => setError("No se pudo cargar el SDK de Mercado Pago. Recargá la página.");
    document.body.appendChild(script);
  }, []);

  // Mount CardForm once SDK is ready
  useEffect(() => {
    if (!sdkLoaded || !window.MercadoPago) return;

    const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
    if (!publicKey) {
      setError("Clave pública de Mercado Pago no configurada. Contactá al soporte.");
      return;
    }

    const mp = new window.MercadoPago(publicKey, { locale: "es-AR" });
    mpInstanceRef.current = mp;

    const cardForm = mp.cardForm({
      amount: "1", // Amount is informational for CardForm; actual charge is in the preapproval.
      autoMount: true,
      form: {
        id: "mp-card-form",
        cardholderName: { id: "mp-cardholder-name", placeholder: "Nombre en la tarjeta" },
        cardNumber: { id: "mp-card-number", placeholder: "Número de tarjeta" },
        expirationDate: { id: "mp-expiration-date", placeholder: "MM/AA" },
        securityCode: { id: "mp-security-code", placeholder: "CVV" },
        installments: { id: "mp-installments" },
        identificationType: { id: "mp-identification-type" },
        identificationNumber: { id: "mp-identification-number", placeholder: "Número de documento" },
        cardholderEmail: { id: "mp-cardholder-email", placeholder: "Email", value: payerEmail ?? "" },
      },
      callbacks: {
        onFormMounted: (error) => {
          if (error) {
            console.error("[MpCardForm] onFormMounted error", error);
            setError("Error al montar el formulario de tarjeta. Recargá la página.");
          } else {
            setMounted(true);
          }
        },
        onFetching: () => {
          // Return cleanup fn (no-op) to satisfy the expected signature.
          return undefined;
        },
      },
    });

    cardFormRef.current = cardForm;

    return () => {
      try {
        cardForm.cardForm.unmount();
      } catch {
        // Ignore unmount errors on cleanup.
      }
      cardFormRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdkLoaded]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!cardFormRef.current || submitting || success) return;

    setSubmitting(true);
    setError(null);

    try {
      const data = await cardFormRef.current.getCardFormData();
      if (!data.token) {
        setError("No se pudo generar el token de la tarjeta. Verificá los datos e intentá de nuevo.");
        setSubmitting(false);
        return;
      }

      // Resolve the email: prefer the hidden field value (may be updated by user), fallback to prop.
      const emailEl = document.getElementById("mp-cardholder-email") as HTMLInputElement | null;
      const resolvedEmail = emailEl?.value?.trim() || payerEmail || "";

      await onToken(data.token, resolvedEmail);
      setSuccess(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      setError(msg || "Error al procesar la tarjeta. Intentá de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="flex items-center gap-3 border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
        <CheckCircle size={16} className="text-emerald-400 flex-shrink-0" aria-hidden="true" />
        <p className="text-sm font-heading font-bold uppercase tracking-[0.1em] text-emerald-400">
          ¡Tarjeta configurada! El cobro se realizará al finalizar tu trial.
        </p>
      </div>
    );
  }

  return (
    <form id="mp-card-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Hidden email field for MP SDK — visible input below */}
      <input type="hidden" id="mp-installments" />
      <input type="hidden" id="mp-identification-type" />

      <div className="grid grid-cols-1 gap-3">
        {/* Card number */}
        <div className="flex flex-col gap-1">
          <label htmlFor="mp-card-number" className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400">
            Número de tarjeta
          </label>
          <div
            id="mp-card-number"
            className="h-10 border border-edge bg-elev px-3 flex items-center text-sm text-white"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Expiry */}
          <div className="flex flex-col gap-1">
            <label htmlFor="mp-expiration-date" className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400">
              Vencimiento
            </label>
            <div
              id="mp-expiration-date"
              className="h-10 border border-edge bg-elev px-3 flex items-center text-sm text-white"
            />
          </div>

          {/* CVV */}
          <div className="flex flex-col gap-1">
            <label htmlFor="mp-security-code" className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400">
              CVV
            </label>
            <div
              id="mp-security-code"
              className="h-10 border border-edge bg-elev px-3 flex items-center text-sm text-white"
            />
          </div>
        </div>

        {/* Cardholder name */}
        <div className="flex flex-col gap-1">
          <label htmlFor="mp-cardholder-name" className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400">
            Nombre en la tarjeta
          </label>
          <div
            id="mp-cardholder-name"
            className="h-10 border border-edge bg-elev px-3 flex items-center text-sm text-white"
          />
        </div>

        {/* Email */}
        <div className="flex flex-col gap-1">
          <label htmlFor="mp-cardholder-email" className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400">
            Email del titular
          </label>
          <div
            id="mp-cardholder-email"
            className="h-10 border border-edge bg-elev px-3 flex items-center text-sm text-white"
          />
        </div>

        {/* DNI number */}
        <div className="flex flex-col gap-1">
          <label htmlFor="mp-identification-number" className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400">
            Número de documento
          </label>
          <div
            id="mp-identification-number"
            className="h-10 border border-edge bg-elev px-3 flex items-center text-sm text-white"
          />
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 border border-brand-red/30 bg-brand-red/5 px-4 py-3">
          <AlertTriangle size={14} className="text-brand-red flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-xs font-body text-red-400">{error}</p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <button
          type="submit"
          disabled={!mounted || submitting}
          className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-brand-red text-white text-sm font-heading font-bold uppercase tracking-[0.15em] hover:bg-brand-red-dark transition-colors duration-200 w-full sm:w-fit disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <>
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              Procesando...
            </>
          ) : (
            <>
              <CreditCard size={16} aria-hidden="true" />
              Confirmar tarjeta — {monthlyAmountLabel}
            </>
          )}
        </button>
        <p className="text-xs text-gray-500 font-body">{chargeHint}</p>
        <p className="text-xs text-gray-600 font-body">
          Tu tarjeta se tokeniza de forma segura en Mercado Pago. Wody nunca recibe los datos de tu tarjeta.
        </p>
      </div>
    </form>
  );
}
