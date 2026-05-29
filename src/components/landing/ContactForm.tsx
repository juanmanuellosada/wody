"use client";

import { useState, useTransition, useEffect } from "react";

interface Props {
  onClose: () => void;
}

type SubmitState =
  | { type: "idle" }
  | { type: "success" }
  | { type: "error"; message: string };

export function ContactForm({ onClose }: Props) {
  const [isPending, startTransition] = useTransition();

  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [gymName, setGymName] = useState("");
  const [gymKindSuggested, setGymKindSuggested] = useState<"GYM" | "BOX">("BOX");
  const [phone, setPhone] = useState("");
  const [expectedStudents, setExpectedStudents] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<SubmitState>({ type: "idle" });

  // Close modal on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !isPending) onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isPending, onClose]);

  // Auto-close after success
  useEffect(() => {
    if (state.type !== "success") return;
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [state, onClose]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const res = await fetch("/api/signup-request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contactName,
            email,
            gymName,
            gymKindSuggested,
            phone: phone || undefined,
            expectedStudents: expectedStudents ? Number(expectedStudents) : undefined,
            message: message || undefined,
          }),
        });

        if (res.ok) {
          setState({ type: "success" });
          return;
        }

        if (res.status === 429) {
          setState({
            type: "error",
            message:
              "Demasiadas solicitudes desde tu IP — esperá un rato e intentá de nuevo.",
          });
          return;
        }

        let detail = "";
        try {
          const data = await res.json();
          detail = data.error ?? "";
        } catch {
          // ignore JSON parse errors
        }
        setState({
          type: "error",
          message: detail || "Algo salió mal — probá de nuevo más tarde.",
        });
      } catch {
        setState({
          type: "error",
          message: "Algo salió mal — probá de nuevo más tarde.",
        });
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-sm px-0 sm:px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPending) onClose();
      }}
    >
      <div
        className="w-full sm:max-w-lg bg-[#0F0F14] border border-white/[0.08] flex flex-col max-h-[90vh] sm:max-h-[85vh] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Formulario de contacto"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06] flex-shrink-0">
          <div>
            <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-brand-red mb-0.5">
              WODY para tu centro
            </p>
            <h2 className="text-lg font-heading font-black uppercase tracking-[0.05em] text-white">
              Contactanos
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isPending}
            className="text-gray-500 hover:text-white transition-colors duration-200 cursor-pointer text-lg leading-none min-w-[44px] min-h-[44px] flex items-center justify-center disabled:opacity-50"
            aria-label="Cerrar"
          >
            &#215;
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {state.type === "success" ? (
            <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
              <div
                className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-xl"
                aria-hidden="true"
              >
                ✓
              </div>
              <div>
                <p className="text-white font-heading font-bold uppercase tracking-[0.1em] text-sm mb-2">
                  ¡Recibimos tu consulta!
                </p>
                <p className="text-gray-400 text-xs font-body leading-relaxed">
                  Te vamos a contactar pronto. Esta ventana se cierra automáticamente.
                </p>
              </div>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-4"
              id="contact-form"
              noValidate
            >
              {state.type === "error" && (
                <div
                  className="bg-brand-red/10 border border-brand-red/30 px-4 py-3 text-xs text-brand-red font-body"
                  role="alert"
                >
                  {state.message}
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="cf-name"
                  className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400"
                >
                  Tu nombre <span className="text-brand-red">*</span>
                </label>
                <input
                  id="cf-name"
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  required
                  disabled={isPending}
                  placeholder="Juan García"
                  className="bg-white/[0.04] text-white font-body w-full border border-white/[0.08] px-4 py-3 text-sm placeholder:text-gray-600 focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red/20 disabled:opacity-50 transition-all duration-200"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="cf-email"
                  className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400"
                >
                  Email <span className="text-brand-red">*</span>
                </label>
                <input
                  id="cf-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isPending}
                  placeholder="tu@email.com"
                  className="bg-white/[0.04] text-white font-body w-full border border-white/[0.08] px-4 py-3 text-sm placeholder:text-gray-600 focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red/20 disabled:opacity-50 transition-all duration-200"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="cf-gymname"
                  className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400"
                >
                  Nombre del gym <span className="text-brand-red">*</span>
                </label>
                <input
                  id="cf-gymname"
                  type="text"
                  value={gymName}
                  onChange={(e) => setGymName(e.target.value)}
                  required
                  disabled={isPending}
                  placeholder="Atlas CrossFit"
                  className="bg-white/[0.04] text-white font-body w-full border border-white/[0.08] px-4 py-3 text-sm placeholder:text-gray-600 focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red/20 disabled:opacity-50 transition-all duration-200"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="cf-kind"
                  className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400"
                >
                  Tipo de centro <span className="text-brand-red">*</span>
                </label>
                <div
                  id="cf-kind"
                  className="flex gap-3"
                  role="radiogroup"
                  aria-label="Tipo de centro"
                >
                  {(["BOX", "GYM"] as const).map((kind) => (
                    <label
                      key={kind}
                      className={[
                        "flex-1 flex items-center justify-center gap-2 px-4 py-3 border text-xs font-heading font-bold uppercase tracking-[0.1em] cursor-pointer transition-all duration-200",
                        gymKindSuggested === kind
                          ? "bg-brand-red/10 border-brand-red text-white"
                          : "bg-white/[0.03] border-white/[0.08] text-gray-400 hover:border-white/20",
                        isPending ? "cursor-not-allowed opacity-50" : "",
                      ].join(" ")}
                    >
                      <input
                        type="radio"
                        name="gymKindSuggested"
                        value={kind}
                        checked={gymKindSuggested === kind}
                        onChange={() => setGymKindSuggested(kind)}
                        disabled={isPending}
                        className="sr-only"
                      />
                      {kind === "BOX" ? "Box / CrossFit" : "Gimnasio tradicional"}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="cf-phone"
                  className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400"
                >
                  Teléfono <span className="text-gray-600 normal-case font-body tracking-normal">— opcional</span>
                </label>
                <input
                  id="cf-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={isPending}
                  placeholder="+54 11 1234-5678"
                  className="bg-white/[0.04] text-white font-body w-full border border-white/[0.08] px-4 py-3 text-sm placeholder:text-gray-600 focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red/20 disabled:opacity-50 transition-all duration-200"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="cf-students"
                  className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400"
                >
                  Alumnos estimados <span className="text-gray-600 normal-case font-body tracking-normal">— opcional</span>
                </label>
                <input
                  id="cf-students"
                  type="number"
                  min="1"
                  value={expectedStudents}
                  onChange={(e) => setExpectedStudents(e.target.value)}
                  disabled={isPending}
                  placeholder="50"
                  className="bg-white/[0.04] text-white font-body w-full border border-white/[0.08] px-4 py-3 text-sm placeholder:text-gray-600 focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red/20 disabled:opacity-50 transition-all duration-200"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="cf-message"
                  className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400"
                >
                  ¿Algo que querés contarnos? <span className="text-gray-600 normal-case font-body tracking-normal">— opcional</span>
                </label>
                <textarea
                  id="cf-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  disabled={isPending}
                  placeholder="Contexto adicional, preguntas, etc."
                  className="bg-white/[0.04] text-white font-body w-full border border-white/[0.08] px-4 py-3 text-sm placeholder:text-gray-600 focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red/20 disabled:opacity-50 transition-all duration-200 resize-none"
                />
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        {state.type !== "success" && (
          <div className="px-6 py-5 border-t border-white/[0.06] flex-shrink-0">
            <button
              type="submit"
              form="contact-form"
              disabled={isPending}
              aria-busy={isPending}
              className={[
                "w-full px-6 py-4 font-heading font-bold uppercase tracking-[0.15em] text-sm transition-all duration-200",
                "bg-brand-red text-white hover:bg-brand-red-dark",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red",
                "flex items-center justify-center gap-2",
              ].join(" ")}
            >
              {isPending ? (
                <>
                  <span
                    className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
                    aria-hidden="true"
                  />
                  Enviando...
                </>
              ) : (
                "Enviar consulta"
              )}
            </button>
            <p className="text-xs text-gray-600 font-body text-center mt-3">
              Te contactamos en menos de 48 horas hábiles.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
