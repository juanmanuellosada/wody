"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { submitOnboarding } from "@/actions/onboarding";

const SLUG_REGEX = /^[a-z0-9-]+$/;

function toSlug(str: string) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s]+/g, "-");
}

interface Request {
  id: string;
  email: string;
  contactName: string;
  gymName: string;
  gymKindSuggested: string;
}

interface Props {
  token: string;
  request: Request;
}

export function OnboardingForm({ token, request }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [slug, setSlug] = useState(toSlug(request.gymName));
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [kind, setKind] = useState<"GYM" | "BOX">(
    request.gymKindSuggested === "GYM" ? "GYM" : "BOX"
  );
  const [primaryColor, setPrimaryColor] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const [slugError, setSlugError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [globalError, setGlobalError] = useState("");
  const [done, setDone] = useState(false);
  const [fallbackSlug, setFallbackSlug] = useState("");

  function validateSlugLocal(val: string): string {
    if (!val) return "El slug no puede estar vacío";
    if (!SLUG_REGEX.test(val))
      return "Solo letras minúsculas, números y guiones";
    return "";
  }

  function handleSlugChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.toLowerCase().replace(/\s+/g, "-");
    setSlug(val);
    setSlugError(validateSlugLocal(val));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGlobalError("");

    const slugErr = validateSlugLocal(slug);
    if (slugErr) {
      setSlugError(slugErr);
      return;
    }

    if (password.length < 8) {
      setPasswordError("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (password !== confirmPassword) {
      setPasswordError("Las contraseñas no coinciden");
      return;
    }

    setSlugError("");
    setPasswordError("");

    startTransition(async () => {
      const result = await submitOnboarding(token, {
        slug,
        password,
        kind,
        primaryColor: primaryColor || undefined,
        logoFile: logoFile ?? undefined,
      });

      if (result.success) {
        if (result.signInFailed) {
          setFallbackSlug(result.slug);
          setDone(true);
        } else {
          router.push(`/${result.slug}/admin`);
        }
        return;
      }

      if (result.field === "slug") {
        setSlugError(result.error);
      } else if (result.field === "password") {
        setPasswordError(result.error);
      } else {
        setGlobalError(result.error);
      }
    });
  }

  if (done && fallbackSlug) {
    return (
      <div className="w-full max-w-md bg-white/[0.03] border border-white/[0.08] p-8 flex flex-col gap-5 text-center">
        <div
          className="w-12 h-12 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-xl"
          aria-hidden="true"
        >
          ✓
        </div>
        <div>
          <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-emerald-400 mb-2">
            ¡Tu gym está listo!
          </p>
          <h2 className="text-lg font-heading font-black uppercase tracking-[0.05em] text-white mb-2">
            {request.gymName}
          </h2>
          <p className="text-xs text-gray-400 font-body leading-relaxed">
            El gym fue creado correctamente. Ingresá con tu email y la contraseña que acabás de elegir.
          </p>
        </div>
        <a
          href={`/${fallbackSlug}/login`}
          className="inline-block px-6 py-3 bg-brand-red text-white font-heading font-bold uppercase tracking-[0.15em] text-xs hover:bg-brand-red-dark transition-colors duration-200"
        >
          Ir al login
        </a>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      {/* Header */}
      <div className="mb-8 text-center">
        <p className="text-xs font-heading font-bold uppercase tracking-[0.2em] text-brand-red mb-2">
          Onboarding
        </p>
        <h1 className="text-2xl font-heading font-black uppercase tracking-[0.05em] text-white mb-1">
          {request.gymName}
        </h1>
        <p className="text-sm text-gray-400 font-body">
          Hola, <strong className="text-white">{request.contactName}</strong> — completá la configuración inicial.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white/[0.03] border border-white/[0.08] p-6 flex flex-col gap-5"
        noValidate
      >
        {globalError && (
          <div
            className="bg-brand-red/10 border border-brand-red/30 px-4 py-3 text-xs text-brand-red font-body"
            role="alert"
          >
            {globalError}
          </div>
        )}

        {/* Slug */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="ob-slug"
            className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400"
          >
            URL de tu gym <span className="text-brand-red">*</span>
          </label>
          <input
            id="ob-slug"
            type="text"
            value={slug}
            onChange={handleSlugChange}
            required
            disabled={isPending}
            placeholder="mi-gym"
            aria-describedby="ob-slug-hint ob-slug-error"
            className={[
              "bg-elev text-white font-body w-full border px-4 py-3 text-sm",
              "placeholder:text-gray-600",
              "focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red/20",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-all duration-200",
              slugError ? "border-brand-red" : "border-edge",
            ].join(" ")}
          />
          {!slugError && (
            <p id="ob-slug-hint" className="text-xs text-gray-600 font-body">
              Tu panel quedará en:{" "}
              <span className="text-gray-400">
                wody.com.ar/<strong>{slug || "tu-slug"}</strong>
              </span>
            </p>
          )}
          {slugError && (
            <p
              id="ob-slug-error"
              className="text-xs font-heading font-bold text-brand-red uppercase tracking-wide"
              role="alert"
            >
              {slugError}
            </p>
          )}
        </div>

        {/* Password */}
        <Input
          id="ob-password"
          label="Contraseña del admin"
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setPasswordError(""); }}
          required
          disabled={isPending}
          showPasswordToggle
          hint="Mínimo 8 caracteres. La usás para iniciar sesión."
          error={passwordError || undefined}
          placeholder="••••••••"
        />

        {/* Confirm password */}
        <Input
          id="ob-confirm-password"
          label="Confirmá la contraseña"
          type="password"
          value={confirmPassword}
          onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError(""); }}
          required
          disabled={isPending}
          showPasswordToggle
          placeholder="••••••••"
        />

        {/* Kind */}
        <div className="flex flex-col gap-1.5">
          <span
            className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400"
            id="ob-kind-label"
          >
            Tipo de centro <span className="text-brand-red">*</span>
          </span>
          <div
            className="flex gap-3"
            role="radiogroup"
            aria-labelledby="ob-kind-label"
          >
            {(["BOX", "GYM"] as const).map((k) => (
              <label
                key={k}
                className={[
                  "flex-1 flex items-center justify-center gap-2 px-4 py-3 border text-xs font-heading font-bold uppercase tracking-[0.1em] cursor-pointer transition-all duration-200",
                  kind === k
                    ? "bg-brand-red/10 border-brand-red text-white"
                    : "bg-elev border-edge text-gray-400 hover:border-white/20",
                  isPending ? "cursor-not-allowed opacity-50" : "",
                ].join(" ")}
              >
                <input
                  type="radio"
                  name="kind"
                  value={k}
                  checked={kind === k}
                  onChange={() => setKind(k)}
                  disabled={isPending}
                  className="sr-only"
                />
                {k === "BOX" ? "Box / CrossFit" : "Gimnasio tradicional"}
              </label>
            ))}
          </div>
        </div>

        {/* Logo */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="ob-logo"
            className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400"
          >
            Logo <span className="text-gray-600 normal-case font-body tracking-normal">— opcional</span>
          </label>
          <input
            id="ob-logo"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
            disabled={isPending}
            className="text-xs text-gray-400 font-body file:mr-3 file:px-3 file:py-1.5 file:text-xs file:font-heading file:font-bold file:uppercase file:tracking-[0.1em] file:bg-elev file:text-white file:border file:border-edge file:cursor-pointer hover:file:border-brand-red disabled:opacity-50"
          />
          <p className="text-xs text-gray-600 font-body">PNG, JPEG, WebP o SVG. Máx. 2 MB.</p>
        </div>

        {/* Color primario */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="ob-color"
            className="text-xs font-heading font-bold uppercase tracking-[0.15em] text-gray-400"
          >
            Color de marca <span className="text-gray-600 normal-case font-body tracking-normal">— opcional</span>
          </label>
          <div className="flex items-center gap-3">
            <input
              id="ob-color"
              type="text"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              disabled={isPending}
              placeholder="#E31414"
              maxLength={7}
              className="flex-1 bg-elev text-white font-body border border-edge px-4 py-3 text-sm placeholder:text-gray-600 focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red/20 disabled:opacity-50 transition-all duration-200"
            />
            <div
              className="w-10 h-10 border border-edge flex-shrink-0"
              style={{
                backgroundColor:
                  primaryColor && /^#[0-9A-Fa-f]{6}$/.test(primaryColor)
                    ? primaryColor
                    : "transparent",
              }}
              aria-hidden="true"
            />
          </div>
          <p className="text-xs text-gray-600 font-body">Valor hex, ej: #E31414. Se usa en botones y acentos del panel.</p>
        </div>

        <Button type="submit" loading={isPending} className="w-full mt-2">
          Crear mi gym
        </Button>
      </form>
    </div>
  );
}
