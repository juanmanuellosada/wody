import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import {
  Dumbbell,
  Trophy,
  Users,
  Smartphone,
  BarChart3,
  Share2,
  CalendarDays,
  ClipboardList,
  Building2,
} from "lucide-react";

import wodyTexto from "@/logos/wody-texto.png";
import unidosLogo from "@/logos/unidos-logo-completo.png";

export const metadata: Metadata = {
  title: "WODY — Gestión de rutinas para centros de entrenamiento",
  description:
    "Plataforma para gestionar rutinas, records y seguimiento de alumnos. CrossFit, gimnasios, funcional, GAP y más.",
};

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col bg-[#0A0A0F] text-white overflow-hidden">
      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 pt-20 pb-28 sm:pt-28 sm:pb-36 text-center relative">
        {/* Animated background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div
            className="absolute top-[20%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-25 blur-[150px] wody-orb-float"
            style={{
              background: "radial-gradient(circle, rgba(227,20,20,0.6) 0%, rgba(227,20,20,0.2) 35%, transparent 65%)",
            }}
          />
          <div
            className="absolute bottom-[10%] left-[10%] w-[400px] h-[400px] rounded-full opacity-20 blur-[120px] wody-orb-float-slow"
            style={{
              background: "radial-gradient(circle, rgba(227,20,20,0.4) 0%, rgba(150,20,20,0.1) 50%, transparent 70%)",
            }}
          />
          <div
            className="absolute top-[15%] right-[5%] w-[300px] h-[300px] rounded-full opacity-[0.07] blur-[100px] wody-orb-float-slow"
            style={{
              background: "radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)",
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: "linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)",
              backgroundSize: "50px 50px",
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.015]"
            style={{
              backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")",
            }}
          />
          <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#0A0A0F] to-transparent" />
        </div>

        <div className="relative z-10 flex flex-col items-center">
          <div className="mb-6">
            <Image
              src={wodyTexto}
              alt="WODY"
              width={360}
              height={100}
              className="w-56 sm:w-80 lg:w-96 h-auto mx-auto"
              priority
            />
          </div>

          <p className="text-lg sm:text-xl lg:text-2xl text-gray-300 max-w-xl mb-3 leading-relaxed font-body">
            La plataforma para gestionar
            <span className="text-white font-semibold"> rutinas</span>,
            <span className="text-white font-semibold"> records </span>
            y el seguimiento de tus alumnos.
          </p>

          <p className="text-sm text-gray-600 mb-10 font-body">
            CrossFit, gimnasios, funcional, GAP y más.
          </p>

          <a
            href="https://www.instagram.com/marlocomunica/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-10 py-4 font-heading font-bold uppercase tracking-[0.15em] text-gray-300 text-sm border border-gray-700 hover:border-[#E31414] hover:text-white transition-all duration-200 cursor-pointer"
          >
            Contactanos
          </a>
        </div>
      </section>

      {/* Para quién */}
      <section className="px-6 pb-20 relative">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-heading font-bold uppercase tracking-[0.3em] text-[#E31414] text-center mb-3">
            Para todo tipo de centro
          </p>
          <h2 className="text-2xl sm:text-3xl font-heading font-black uppercase tracking-[0.05em] text-white text-center mb-12">
            ¿Para quién es WODY?
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {["CrossFit", "Gimnasio", "Funcional", "GAP", "Pilates", "Personalizados"].map((tipo) => (
              <div key={tipo} className="bg-white/[0.03] border border-white/[0.06] py-5 px-4 text-center hover:border-[#E31414]/30 transition-all duration-300">
                <p className="text-sm font-heading font-bold uppercase tracking-[0.1em] text-white">{tipo}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 pb-24 relative">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-heading font-bold uppercase tracking-[0.3em] text-[#E31414] text-center mb-3">
            Todo lo que necesitás
          </p>
          <h2 className="text-2xl sm:text-3xl font-heading font-black uppercase tracking-[0.05em] text-white text-center mb-12">
            Funcionalidades
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FeatureCard
              icon={<CalendarDays size={20} />}
              title="Rutinas diarias"
              description="Cada alumno recibe su rutina personalizada para el día. El profe carga, edita y copia con un click."
            />
            <FeatureCard
              icon={<Trophy size={20} />}
              title="Records personales"
              description="Registro de mejores marcas con fecha. Editables y compartibles en redes con imagen generada."
            />
            <FeatureCard
              icon={<Building2 size={20} />}
              title="Multi-centro"
              description="Cada centro tiene su espacio aislado con datos, usuarios y branding independientes."
            />
            <FeatureCard
              icon={<Smartphone size={20} />}
              title="Mobile-first"
              description="Pensado para usar desde el celular en el gimnasio. Responsive y rápido."
            />
            <FeatureCard
              icon={<BarChart3 size={20} />}
              title="Historial completo"
              description="Todo el historial de rutinas y records del alumno, accesible en cualquier momento."
            />
            <FeatureCard
              icon={<Share2 size={20} />}
              title="Compartir logros"
              description="Genera imágenes para Instagram y WhatsApp cuando tu alumno rompe un record."
            />
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="border-t border-white/5 bg-[#08080D] px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-heading font-bold uppercase tracking-[0.3em] text-[#E31414] text-center mb-3">
            Simple y directo
          </p>
          <h2 className="text-2xl sm:text-3xl font-heading font-black uppercase tracking-[0.05em] text-white text-center mb-12">
            ¿Cómo funciona?
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <StepCard
              number="01"
              title="Creamos tu espacio"
              description="Te armamos tu centro en WODY con tu branding. Vos creás profes y alumnos."
            />
            <StepCard
              number="02"
              title="El profe carga rutinas"
              description="Cada profe ve sus alumnos y les carga la rutina del día con el editor."
            />
            <StepCard
              number="03"
              title="El alumno entrena"
              description="Abre la app, ve su rutina de hoy, registra sus records y comparte logros."
            />
          </div>
        </div>
      </section>

      {/* Roles */}
      <section className="border-t border-white/5 px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-heading font-black uppercase tracking-[0.05em] text-white text-center mb-12">
            Para cada rol
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <RoleCard
              role="Alumno"
              features={["Ver rutina de hoy", "Historial completo", "Cargar y editar records", "Compartir logros"]}
            />
            <RoleCard
              role="Profe"
              highlight
              features={["Cargar rutinas por alumno", "Copiar entre fechas y alumnos", "Editor con formato", "Gestión de alumnos"]}
            />
            <RoleCard
              role="Admin"
              features={["Crear profes y alumnos", "Asignar alumnos a profes", "Panel de control", "Gestión completa"]}
            />
          </div>
        </div>
      </section>

      {/* Clientes / Ingreso */}
      <section className="border-t border-white/5 bg-[#08080D] px-6 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs font-heading font-bold uppercase tracking-[0.3em] text-[#E31414] mb-3">
            Ya usan WODY
          </p>
          <h2 className="text-2xl sm:text-3xl font-heading font-black uppercase tracking-[0.05em] text-white mb-12">
            Ingreso
          </h2>

          <div className="flex flex-wrap justify-center gap-6">
            <Link
              href="/unidos-garage"
              className="flex flex-col items-center gap-4 p-8 bg-white/[0.03] border border-white/[0.06] hover:border-[#E31414]/40 hover:bg-white/[0.05] transition-all duration-300 cursor-pointer w-64 group"
            >
              <Image
                src={unidosLogo}
                alt="Unidos Garage"
                width={80}
                height={80}
                className="w-20 h-auto opacity-80 group-hover:opacity-100 transition-opacity duration-300"
              />
              <span className="text-sm font-heading font-bold uppercase tracking-[0.15em] text-gray-400 group-hover:text-white transition-colors duration-300">
                Unidos Garage
              </span>
              <span className="text-xs text-gray-600 font-body">
                CrossFit — Los Polvorines, BA
              </span>
            </Link>
          </div>

          <p className="mt-8 text-xs text-gray-700 font-body">
            ¿Querés WODY para tu centro?{" "}
            <a
              href="https://www.instagram.com/marlocomunica/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#E31414] hover:text-white transition-colors duration-200"
            >
              Contactanos
            </a>
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 text-center relative border-t border-white/5">
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full opacity-8 blur-[100px] pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(227,20,20,0.4) 0%, transparent 70%)",
          }}
          aria-hidden="true"
        />
        <div className="relative z-10">
          <h2 className="text-2xl sm:text-3xl font-heading font-black uppercase tracking-[0.05em] text-white mb-4">
            ¿Querés WODY para tu centro?
          </h2>
          <p className="text-sm text-gray-500 mb-8 font-body max-w-md mx-auto">
            Contactanos y te armamos el espacio para tu gimnasio, box o estudio en minutos.
          </p>
          <a
            href="https://www.instagram.com/marlocomunica/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-10 py-4 font-heading font-bold uppercase tracking-[0.15em] text-white text-sm bg-[#E31414] hover:bg-[#B00F0F] transition-colors duration-200 cursor-pointer"
          >
            Empezar ahora
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 text-center border-t border-white/5">
        <div className="flex items-center justify-center gap-2 flex-wrap text-xs text-gray-700 font-body tracking-wide">
          <span>&copy; {new Date().getFullYear()} WODY</span>
          <span className="text-gray-800">—</span>
          <a
            href="https://www.instagram.com/marlocomunica"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-gray-600 hover:text-white transition-colors duration-200"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
            </svg>
            @marlocomunica
          </a>
          <span className="text-gray-800">—</span>
          <a
            href="https://www.marlocomunica.com.ar"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 hover:text-white transition-colors duration-200"
          >
            www.marlocomunica.com.ar
          </a>
        </div>
      </footer>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] p-6 hover:bg-white/[0.05] hover:border-white/[0.1] transition-all duration-300 group">
      <div className="text-[#E31414] mb-4 group-hover:scale-110 transition-transform duration-300 inline-block">
        {icon}
      </div>
      <h3 className="text-sm font-heading font-bold uppercase tracking-[0.1em] text-white mb-2">
        {title}
      </h3>
      <p className="text-xs text-gray-500 font-body leading-relaxed">
        {description}
      </p>
    </div>
  );
}

function StepCard({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <p className="text-4xl font-heading font-black text-[#E31414]/20 mb-3">{number}</p>
      <h3 className="text-sm font-heading font-bold uppercase tracking-[0.1em] text-white mb-2">
        {title}
      </h3>
      <p className="text-xs text-gray-500 font-body leading-relaxed">
        {description}
      </p>
    </div>
  );
}

function RoleCard({
  role,
  features,
  highlight = false,
}: {
  role: string;
  features: string[];
  highlight?: boolean;
}) {
  return (
    <div
      className={[
        "p-6 border transition-all duration-300",
        highlight
          ? "bg-[#E31414]/5 border-[#E31414]/20"
          : "bg-white/[0.02] border-white/[0.06]",
      ].join(" ")}
    >
      <h3
        className={[
          "text-lg font-heading font-black uppercase tracking-[0.1em] mb-4",
          highlight ? "text-[#E31414]" : "text-white",
        ].join(" ")}
      >
        {role}
      </h3>
      <ul className="flex flex-col gap-2">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-xs text-gray-400 font-body">
            <span className="text-[#E31414] mt-0.5 flex-shrink-0">&#8226;</span>
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}
