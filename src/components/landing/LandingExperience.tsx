"use client";

import Image from "next/image";
import { useState, type CSSProperties } from "react";
import { CalendarCheck, CalendarDays, Building2, QrCode, Share2, Smartphone, Trophy, Wallet, type LucideIcon } from "lucide-react";
import { WhatsAppIcon } from "../icons/WhatsAppIcon";
import wodyTexto from "../../logos/wody-texto.png";
import demoPagosDesktop from "./assets/wody-demo-pagos-desktop.webp";
import demoPagosMobile from "./assets/wody-demo-pagos-mobile.webp";
import styles from "./LandingExperience.module.css";

export type AccountOption = {
  slug: string;
  name: string;
  kind: "GYM" | "BOX" | "PERSONAL";
  logo?: string | null;
  primaryColor?: string | null;
  location?: string;
};

type LandingExperienceProps = {
  mode?: "production" | "preview";
  accounts?: AccountOption[];
  supplementaryContent?: React.ReactNode;
  ContactFormComponent: React.ComponentType<{
    onClose: () => void;
    formType: "GYM" | "PERSONAL";
  }>;
};

const roles = [
  { role: "Alumno", features: ["Ver rutina de hoy", "Historial completo", "Cargar y editar records", "Compartir logros"] },
  { role: "Profe", highlight: true, features: ["Cargar rutinas por alumno", "Copiar entre fechas y alumnos", "Editor con formato", "Gestión de alumnos"] },
  { role: "Admin", features: ["Crear profes y alumnos", "Asignar alumnos a profes", "Panel de control", "Gestión completa"] },
];

const features: Array<[LucideIcon, string, string]> = [
  [CalendarDays, "Rutinas diarias", "Cada alumno recibe su rutina personalizada para el día. El profe carga, edita y copia con un click."],
  [Trophy, "Records personales", "Registro de mejores marcas con fecha. Editables y compartibles en redes con imagen generada."],
  [CalendarCheck, "Turnos de actividades", "Actividades con horarios semanales o de fecha única, cupo por clase y ventana de cancelación. El alumno se anota desde el celular."],
  [QrCode, "Control de ingresos", "Check-in en la puerta escaneando el QR de recepción. El operador ve el estado de cuota del socio al instante y queda todo en el historial."],
  [Wallet, "Cuotas y caja", "Estado de cuota de cada alumno, registro de pagos y venta de productos. La recaudación y los gastos quedan detrás de un permiso aparte."],
  [Building2, "Multi-centro", "Cada centro tiene su espacio aislado con datos, usuarios y branding independientes."],
  [Smartphone, "Mobile-first", "Pensado para usar desde el celular en el gimnasio. Responsive y rápido."],
  [Share2, "Compartir logros", "Genera imágenes para Instagram y WhatsApp cuando tu alumno rompe un record."],
];

const footerRoutes = [
  ["/software-gestion-gimnasios", "Software de gestión para gimnasios"],
  ["/control-de-acceso-gimnasio-qr", "Control de acceso con QR"],
  ["/comparativa", "Comparativas"],
  ["/blog", "Blog"],
  ["/demo", "Demo"],
] as const;

const WODY_ORIGIN = "https://www.wody.com.ar";
const whatsappHref = `https://wa.me/5491136178552?text=${encodeURIComponent("Hola, vengo de la página web de wody, quiero más información.")}`;

export function LandingExperience({
  mode = "production",
  accounts = [],
  supplementaryContent,
  ContactFormComponent,
}: LandingExperienceProps) {
  const [formType, setFormType] = useState<"GYM" | "PERSONAL" | null>(null);
  const isPreview = mode === "preview";
  const appHref = (path: string) => (isPreview ? `${WODY_ORIGIN}${path}` : path);

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <a className={styles.headerLogo} href="#inicio" aria-label="Wody, ir al inicio">
          <Image src={wodyTexto} alt="WODY" width={360} height={100} priority unoptimized={isPreview} />
        </a>
        <a className={styles.headerContact} href="https://www.instagram.com/wody.app/" target="_blank" rel="noopener noreferrer">
          Contactanos
        </a>
      </header>

      <section id="inicio" className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden="true" />
        <div className={styles.heroCopy}>
          <Image className={styles.heroLogo} src={wodyTexto} alt="WODY" width={360} height={100} priority unoptimized={isPreview} />
          <h1 className={styles.heroHeading}>Tu gimnasio organizado: cuotas, turnos y rutinas en un solo lugar.</h1>
          <p className={styles.lead}>Centralizá pagos, clases y entrenamientos para que tu equipo y tus alumnos tengan la información de cada día a mano.</p>
          <div className={styles.heroActions}>
            <button type="button" className={styles.primaryButton} onClick={() => setFormType("GYM")}>Solicitar una prueba de 7 días</button>
            <a className={styles.secondaryButton} href={appHref("/demo")}>Ver demo</a>
          </div>
          <p className={styles.trialNote}>7 días · sin tarjeta · activación manual</p>
          <a className={styles.personalLink} href={appHref("/registro-personal")}>Usalo por tu cuenta</a>
          <figure className={styles.demoFigure}>
            <picture className={styles.demoPicture}>
              <source media="(min-width: 700px)" srcSet={demoPagosDesktop.src} width={1440} height={608} />
              <Image
                className={styles.demoImage}
                src={demoPagosMobile}
                alt="Control de pagos de Wody con estados de pago ficticios."
                width={390}
                height={1004}
                sizes="(min-width: 700px) min(100vw - 3rem, 62rem), calc(100vw - 2rem)"
                unoptimized
              />
            </picture>
            <figcaption>Vista de demostración con datos ficticios. No corresponde a un centro real. <a href={appHref("/demo/admin/pagos")}>Abrir la demostración pública de control de pagos</a></figcaption>
          </figure>
        </div>
      </section>

      <section className={styles.section}>
        <h2>¿Para quién es WODY?</h2>
        <div className={styles.audienceGrid}>
          {["CrossFit", "Gimnasio", "Funcional", "GAP", "Pilates", "Personalizados"].map((kind) => <p key={kind}>{kind}</p>)}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Funcionalidades</h2>
        <div className={styles.featureGrid}>
          {features.map(([Icon, title, description]) => (
            <article key={title} className={styles.feature}>
              <Icon size={21} aria-hidden="true" />
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={`${styles.section} ${styles.stepsSection}`}>
        <h2>¿Cómo funciona?</h2>
        <ol className={styles.steps}>
          <li><strong>Creamos tu espacio</strong><span>Te armamos tu centro en WODY con tu branding. Vos creás profes y alumnos.</span></li>
          <li><strong>El profe carga rutinas</strong><span>Cada profe ve sus alumnos y les carga la rutina del día con el editor.</span></li>
          <li><strong>El alumno entrena</strong><span>Abre la app, ve su rutina de hoy, registra sus records y comparte logros.</span></li>
        </ol>
      </section>

      <section className={styles.section}>
        <h2>Para cada rol</h2>
        <div className={styles.roleGrid}>
          {roles.map(({ role, features: roleFeatures, highlight }) => (
            <article key={role} className={`${styles.roleCard} ${highlight ? styles.roleHighlight : ""}`}>
              <h3>{role}</h3>
              <ul>{roleFeatures.map((feature) => <li key={feature}>{feature}</li>)}</ul>
            </article>
          ))}
        </div>
      </section>

      <section className={`${styles.section} ${styles.accountsSection}`} aria-labelledby="account-access-title">
        <h2 id="account-access-title">Ingreso</h2>
        <div className={styles.accountGrid}>
          {accounts.map((account) => (
            <a
              key={account.slug}
              href={appHref(`/${account.slug}`)}
              className={styles.accountCard}
              style={{ "--account-color": account.primaryColor || "#e31414" } as CSSProperties}
            >
              {account.logo ? (
                <Image className={styles.accountLogo} src={account.logo} alt={account.name} width={80} height={80} unoptimized />
              ) : (
                <span className={styles.accountFallback} aria-hidden="true">{account.name.charAt(0)}</span>
              )}
              <span className={styles.accountName}>{account.name}</span>
              <span className={styles.accountMeta}>{account.kind === "BOX" ? "CrossFit" : "Gym & Fitness"}{account.location ? ` — ${account.location}` : ""}</span>
            </a>
          ))}
        </div>
        <p className={styles.accountPrompt}>¿Querés WODY para tu centro? <a href="https://www.instagram.com/wody.app/" target="_blank" rel="noopener noreferrer">Contactanos</a></p>
        {!formType && (
          <a className={styles.whatsapp} href={whatsappHref} target="_blank" rel="noopener noreferrer" aria-label="Contactar por WhatsApp">
            <WhatsAppIcon size={22} />
            <span>Más información</span>
          </a>
        )}
      </section>

      <section className={`${styles.section} ${styles.planSection}`}>
        <div className={styles.planGrid}>
          <article className={styles.plan}>
            <h2>Todo lo que tu gym necesita, en un solo lugar</h2>
            <p>Cobros, rutinas, accesos, comunicación: lo que tu gym hace todos los días, organizado y sin planillas.</p>
            <p className={styles.price}>$40.000 <span>ARS / mes</span></p>
            <p className={styles.trialNote}>7 días gratis · sin tarjeta · sin compromiso</p>
            <button type="button" className={styles.primaryButton} onClick={() => setFormType("GYM")}>Solicitar prueba</button>
          </article>
          <article className={`${styles.plan} ${styles.personalPlan}`}>
            <h2>Tu entrenamiento, en un solo lugar</h2>
            <p>Armá tus rutinas, registrá tus PRs y mirá tu progreso desde tu celular.</p>
            <p className={styles.price}>$7.000 <span>ARS / mes</span></p>
            <p className={styles.trialNote}>7 días gratis · sin tarjeta · sin compromiso</p>
            <button type="button" className={styles.secondaryButton} onClick={() => setFormType("PERSONAL")}>Solicitar acceso</button>
          </article>
        </div>
      </section>

      {supplementaryContent}

      <footer className={styles.footer}>
        <nav aria-label="Más sobre Wody" className={styles.footerLinks}>
          {footerRoutes.map(([path, label]) => <a key={path} href={appHref(path)}>{label}</a>)}
        </nav>
        <p>© WODY — <a href="https://www.instagram.com/wody.app/" target="_blank" rel="noopener noreferrer">@wody.app</a> — Diseño x <a href="https://www.instagram.com/marlocomunica/" target="_blank" rel="noopener noreferrer">@marlocomunica</a></p>
      </footer>

      {formType && <ContactFormComponent onClose={() => setFormType(null)} formType={formType} />}
    </main>
  );
}
