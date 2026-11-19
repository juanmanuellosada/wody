"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import styles from "./ContactForm.module.css";

export type SignupRequestPayload =
  | {
      type: "PERSONAL";
      contactName: string;
      email: string;
      phone?: string;
      message?: string;
    }
  | {
      type: "GYM";
      contactName: string;
      email: string;
      gymName: string;
      gymKindSuggested: "GYM" | "BOX";
      phone?: string;
      expectedStudents?: number;
      message?: string;
    };

type SubmitRequest = (payload: SignupRequestPayload) => Promise<{ ok: boolean; error?: string }>;

type Props = {
  onClose: () => void;
  formType?: "GYM" | "PERSONAL";
} & (
  | { mode: "preview"; submitRequest?: never }
  | { mode?: "production"; submitRequest: SubmitRequest }
);

type SubmitState =
  | { type: "idle" }
  | { type: "success" }
  | { type: "error"; message: string };

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function ContactForm(props: Props) {
  const { onClose, formType = "GYM", mode = "production" } = props;
  const isPersonal = formType === "PERSONAL";
  const isPreview = mode === "preview";
  const [isPending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const successHeadingRef = useRef<HTMLHeadingElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [gymName, setGymName] = useState("");
  const [gymKindSuggested, setGymKindSuggested] = useState<"GYM" | "BOX">("BOX");
  const [phone, setPhone] = useState("");
  const [expectedStudents, setExpectedStudents] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<SubmitState>({ type: "idle" });

  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    nameInputRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocusedRef.current?.focus();
    };
  }, []);

  useEffect(() => {
    if (state.type === "success") successHeadingRef.current?.focus();
  }, [state]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !isPending) {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialogRef.current.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isPending, onClose]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ type: "idle" });

    const payload: SignupRequestPayload = isPersonal
      ? {
          type: "PERSONAL",
          contactName,
          email,
          phone: phone || undefined,
          message: message || undefined,
        }
      : {
          type: "GYM",
          contactName,
          email,
          gymName,
          gymKindSuggested,
          phone: phone || undefined,
          expectedStudents: expectedStudents ? Number(expectedStudents) : undefined,
          message: message || undefined,
        };

    if (props.mode === "preview") {
      setState({ type: "success" });
      return;
    }

    startTransition(async () => {
      try {
        const result = await props.submitRequest(payload);
        if (result.ok) {
          setState({ type: "success" });
          return;
        }
        setState({
          type: "error",
          message: result.error || "No pudimos enviar la solicitud. Probá de nuevo más tarde.",
        });
      } catch {
        setState({
          type: "error",
          message: "No pudimos enviar la solicitud. Probá de nuevo más tarde.",
        });
      }
    });
  }

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isPending) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-dialog-title"
        aria-describedby="contact-dialog-description"
      >
        <header className={styles.header}>
          <div>
            <p className={styles.context}>{isPersonal ? "Wody Personal" : "WODY para tu centro"}</p>
            <h2 id="contact-dialog-title">Solicitá tu acceso</h2>
            <p id="contact-dialog-description" className={styles.description}>
              {isPreview
                ? "Esta es una demostración visual: el formulario no envía solicitudes."
                : "Revisamos cada solicitud de forma manual antes de habilitar la prueba."}
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={isPending} className={styles.closeButton}>
            <span aria-hidden="true">×</span>
            <span className={styles.visuallyHidden}>Cerrar formulario</span>
          </button>
        </header>

        <div className={styles.body}>
          {state.type === "success" ? (
            <div className={styles.success} role="status" aria-live="polite">
              <div className={styles.successMark} aria-hidden="true">✓</div>
              <h3 ref={successHeadingRef} tabIndex={-1}>{isPreview ? "Formulario simulado" : "Recibimos tu solicitud"}</h3>
              <p>
                {isPreview
                  ? "No se envió ninguna solicitud ni se creó una cuenta."
                  : "La vamos a revisar manualmente y te vamos a escribir al email que dejaste."}
              </p>
              <button type="button" onClick={onClose} className={styles.secondaryButton}>
                Cerrar
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className={styles.form} id="contact-form">
              {state.type === "error" && (
                <p className={styles.error} role="alert">{state.message}</p>
              )}

              <Field label="Tu nombre" htmlFor="cf-name" required>
                <input
                  ref={nameInputRef}
                  id="cf-name"
                  name="contactName"
                  type="text"
                  autoComplete="name"
                  value={contactName}
                  onChange={(event) => setContactName(event.target.value)}
                  required
                  disabled={isPending}
                  placeholder="Juan García"
                />
              </Field>

              <Field label="Email" htmlFor="cf-email" required>
                <input
                  id="cf-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  disabled={isPending}
                  placeholder="tu@email.com"
                />
              </Field>

              {!isPersonal && (
                <>
                  <Field label="Nombre del gimnasio o box" htmlFor="cf-gymname" required>
                    <input
                      id="cf-gymname"
                      name="gymName"
                      type="text"
                      value={gymName}
                      onChange={(event) => setGymName(event.target.value)}
                      required
                      disabled={isPending}
                      placeholder="Box Horizonte"
                    />
                  </Field>

                  <fieldset className={styles.fieldset}>
                    <legend>Tipo de centro <span aria-hidden="true">*</span></legend>
                    <div className={styles.radioGroup}>
                      {(["BOX", "GYM"] as const).map((kind) => (
                        <label key={kind} className={styles.radioOption}>
                          <input
                            type="radio"
                            name="gymKindSuggested"
                            value={kind}
                            checked={gymKindSuggested === kind}
                            onChange={() => setGymKindSuggested(kind)}
                            disabled={isPending}
                          />
                          <span>{kind === "BOX" ? "Box / CrossFit" : "Gimnasio tradicional"}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </>
              )}

              <Field label="Teléfono" htmlFor="cf-phone" optional>
                <input
                  id="cf-phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  disabled={isPending}
                  placeholder="+54 11 1234-5678"
                />
              </Field>

              {!isPersonal && (
                <Field label="Alumnos estimados" htmlFor="cf-students" optional>
                  <input
                    id="cf-students"
                    name="expectedStudents"
                    type="number"
                    min="1"
                    value={expectedStudents}
                    onChange={(event) => setExpectedStudents(event.target.value)}
                    disabled={isPending}
                    placeholder="50"
                  />
                </Field>
              )}

              <Field label="¿Qué necesitás resolver?" htmlFor="cf-message" optional>
                <textarea
                  id="cf-message"
                  name="message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={3}
                  disabled={isPending}
                  placeholder="Contanos un poco sobre tu operación."
                />
              </Field>
            </form>
          )}
        </div>

        {state.type !== "success" && (
          <footer className={styles.footer}>
            <button
              type="submit"
              form="contact-form"
              disabled={isPending}
              aria-busy={isPending}
              className={styles.submitButton}
            >
              {isPending ? "Enviando…" : isPreview ? "Simular solicitud" : "Enviar solicitud"}
            </button>
            <p>{isPreview ? "No se envía información desde esta vista." : "No te pedimos tarjeta para solicitarla."}</p>
          </footer>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  required = false,
  optional = false,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={htmlFor}>
        {label} {required && <span aria-hidden="true">*</span>}
        {optional && <small>Opcional</small>}
      </label>
      {children}
    </div>
  );
}
