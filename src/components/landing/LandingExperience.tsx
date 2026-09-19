"use client";

import Link from "next/link";
import { useState } from "react";
import { RotatingTypewriter } from "../marketing/RotatingTypewriter";
import styles from "./LandingExperience.module.css";

export type AccountOption = {
  slug: string;
  name: string;
  kind: "GYM" | "BOX" | "PERSONAL";
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

const capabilities = [
  ["Operación diaria", "Cuotas, pagos, caja, accesos con QR y el historial de cada ingreso."],
  ["Entrenamiento", "Rutinas, marcas personales y seguimiento por alumno o grupo."],
  ["Equipo", "Roles para administrar, dar clases y operar el acceso sin mezclar permisos."],
  ["Tu espacio", "Cada centro trabaja con sus propios usuarios, datos y configuración."],
];

const faqs = [
  ["¿Cómo solicito una prueba?", "Completás una solicitud. El equipo de Wody la revisa manualmente y, si se aprueba, te llega el siguiente paso por email."],
  ["¿La prueba empieza apenas envío el formulario?", "No. Primero revisamos la solicitud. La prueba de 7 días se habilita después de esa aprobación."],
  ["¿Tengo que dejar una tarjeta para solicitarla?", "No. El formulario de solicitud no pide datos de tarjeta."],
  ["¿Qué es Wody Personal?", "Es el camino para entrenar por tu cuenta: podés solicitar acceso, esperar la aprobación y luego continuar el registro desde el link que recibís por email."],
];

export function LandingExperience({
  mode = "production",
  accounts = [],
  supplementaryContent,
  ContactFormComponent,
}: LandingExperienceProps) {
  const [formType, setFormType] = useState<"GYM" | "PERSONAL" | null>(null);
  const isPreview = mode === "preview";
  const openForm = (type: "GYM" | "PERSONAL") => setFormType(type);

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <a className={styles.logo} href="#inicio" aria-label="Wody, ir al inicio">WODY</a>
        <nav aria-label="Navegación principal" className={styles.navigation}>
          <a href="#producto">Producto</a>
          <a href="#planes">Planes</a>
          <a href="#preguntas">Preguntas frecuentes</a>
        </nav>
        <button type="button" className={styles.topbarCta} onClick={() => openForm("GYM")}>
          Solicitar acceso
        </button>
      </header>

      <section id="inicio" className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.intro}>Wody para centros de entrenamiento</p>
          <h1>La operación de tu gimnasio, en un solo lugar.</h1>
          <p className={styles.lead}>
            Organizá cobros, accesos, rutinas y seguimiento de alumnos sin perder el foco en tu equipo.
          </p>
          <p className={styles.rotatingLine}>
            Para <RotatingTypewriter words={["gimnasios", "boxes", "equipos funcionales", "estudios de entrenamiento"]} />
          </p>
          <div className={styles.heroActions}>
            <button type="button" className={styles.primaryButton} onClick={() => openForm("GYM")}>
              Solicitar una prueba de 7 días
            </button>
            <a className={styles.textButton} href="#personal">Entreno por mi cuenta</a>
          </div>
          <p className={styles.approvalNote}>Revisamos cada solicitud antes de habilitar la prueba.</p>
        </div>

        <ProductIllustration />
      </section>

      <section id="producto" className={styles.section}>
        <div className={styles.sectionHeading}>
          <h2>Menos herramientas sueltas. Más claridad para el equipo.</h2>
          <p>Wody reúne las tareas que sostienen el día a día de un centro de entrenamiento.</p>
        </div>
        <div className={styles.capabilities}>
          {capabilities.map(([title, description]) => (
            <article key={title} className={styles.capability}>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={`${styles.section} ${styles.processSection}`}>
        <div className={styles.sectionHeading}>
          <h2>Un camino claro antes de empezar.</h2>
          <p>El acceso no se activa de forma automática: primero conocemos tu caso.</p>
        </div>
        <ol className={styles.processList}>
          <li><strong>Solicitás acceso.</strong><span>Nos dejás los datos básicos de tu centro o de tu entrenamiento personal.</span></li>
          <li><strong>Revisamos la solicitud.</strong><span>La aprobación es manual para ordenar el alta antes de habilitarla.</span></li>
          <li><strong>Empezás la prueba.</strong><span>Una vez aprobada, te enviamos por email el siguiente paso para la prueba de 7 días.</span></li>
        </ol>
      </section>

      <section id="planes" className={`${styles.section} ${styles.plansSection}`}>
        <div className={styles.sectionHeading}>
          <h2>Elegí el camino que te corresponde.</h2>
          <p>Un plan para gestionar un centro y otro para llevar tu propio entrenamiento.</p>
        </div>
        <div className={styles.planGrid}>
          <article className={styles.plan}>
            <p className={styles.planLabel}>Para gimnasios y boxes</p>
            <h3>Wody para tu centro</h3>
            <p className={styles.price}><span>ARS 40.000</span> por mes</p>
            <ul>
              <li>Gestión de alumnos, profes y accesos</li>
              <li>Rutinas, marcas personales y turnos</li>
              <li>Cuotas, pagos y caja</li>
            </ul>
            <button type="button" className={styles.primaryButton} onClick={() => openForm("GYM")}>
              Solicitar prueba para mi centro
            </button>
          </article>

          <article id="personal" className={`${styles.plan} ${styles.personalPlan}`}>
            <p className={styles.planLabel}>Para entrenar por tu cuenta</p>
            <h3>Wody Personal</h3>
            <p className={styles.price}><span>ARS 7.000</span> por mes</p>
            <ul>
              <li>Armá y organizá tus propias rutinas</li>
              <li>Registrá tus PRs con historial</li>
              <li>Usá cronómetros durante el entrenamiento</li>
            </ul>
            <button type="button" className={styles.secondaryButton} onClick={() => openForm("PERSONAL")}>
              Solicitar acceso personal
            </button>
          </article>
        </div>
        <p className={styles.planNote}>La prueba de 7 días se habilita después de la aprobación manual de tu solicitud.</p>
      </section>

      {accounts.length > 0 && (
        <section className={`${styles.section} ${styles.accessSection}`} aria-labelledby="account-access-title">
          <div className={styles.sectionHeading}>
            <h2 id="account-access-title">¿Ya tenés una cuenta?</h2>
            <p>Elegí tu centro para ingresar. Esta lista es solo un acceso a cuentas existentes.</p>
          </div>
          <div className={styles.accountList}>
            {accounts.map((account) => (
              <a key={account.slug} href={`/${account.slug}`} className={styles.accountLink}>
                <span>{account.name}</span>
                <small>{account.kind === "BOX" ? "Box" : "Gimnasio"}</small>
              </a>
            ))}
          </div>
        </section>
      )}

      {supplementaryContent}

      <section id="preguntas" className={`${styles.section} ${styles.faqSection}`}>
        <div className={styles.sectionHeading}>
          <h2>Preguntas frecuentes</h2>
        </div>
        <div className={styles.faqList}>
          {faqs.map(([question, answer]) => (
            <details key={question}>
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className={styles.footer}>
        <p>WODY</p>
        {isPreview ? (
          <span className={styles.previewUnavailable}>@wody.app — enlace no disponible en la demo</span>
        ) : (
          <div className={styles.footerLinks}>
            <Link href="/software-gestion-gimnasios">Software de gestión para gimnasios</Link>
            <Link href="/control-de-acceso-gimnasio-qr">Control de acceso con QR</Link>
            <Link href="/comparativa">Comparativas</Link>
            <Link href="/blog">Blog</Link>
            <Link href="/demo">Demo</Link>
            <a href="https://www.instagram.com/wody.app/" target="_blank" rel="noopener noreferrer">@wody.app</a>
          </div>
        )}
      </footer>

      {!formType && !isPreview && (
        <a
          className={styles.whatsapp}
          href="https://wa.me/5491136178552?text=Hola%2C%20vengo%20de%20la%20p%C3%A1gina%20web%20de%20Wody."
          target="_blank"
          rel="noopener noreferrer"
        >
          Consultar por WhatsApp
        </a>
      )}

      {formType && (
        <ContactFormComponent onClose={() => setFormType(null)} formType={formType} />
      )}
    </main>
  );
}

function ProductIllustration() {
  return (
    <figure className={styles.illustration} aria-labelledby="illustration-caption">
      <figcaption id="illustration-caption">Vista ilustrativa con datos ficticios. No es una captura de pantalla.</figcaption>
      <div className={styles.productWindow} aria-hidden="true">
        <div className={styles.windowBar}><span /><span /><span /></div>
        <div className={styles.productContent}>
          <aside>
            <b>BOX HORIZONTE</b>
            <span>Inicio</span><span className={styles.activeNav}>Alumnos</span><span>Accesos</span><span>Cuotas</span>
          </aside>
          <div className={styles.productMain}>
            <div className={styles.productTitle}><div><small>MIÉRCOLES</small><strong>Operación del día</strong></div><em>+ Nueva rutina</em></div>
            <div className={styles.productStats}><div><small>Ingresos hoy</small><b>28</b></div><div><small>Turno funcional</small><b>18:30</b></div></div>
            <div className={styles.productRows}><p><span>Sofía Martínez</span><em>Rutina asignada</em></p><p><span>Tomás Vera</span><em>Cuota al día</em></p><p><span>Lucía Ríos</span><em>Acceso registrado</em></p></div>
          </div>
        </div>
      </div>
    </figure>
  );
}
