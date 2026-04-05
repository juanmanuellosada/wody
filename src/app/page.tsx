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
} from "lucide-react";

import wodyTexto from "@/logos/wody-texto.png";
import wodyBlanco from "@/logos/wody-blanco.png";
import unidosLogo from "@/logos/unidos-logo-completo.png";

export const metadata: Metadata = {
  title: "WODY — Gestion de WODs para CrossFit",
  description:
    "Plataforma de gestion de entrenamientos y records personales para boxes de CrossFit.",
};

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col bg-[#0A0A0F] text-white overflow-hidden">
      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 pt-20 pb-28 sm:pt-28 sm:pb-36 text-center relative">
        {/* Animated background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          {/* Large red orb — top center */}
          <div
            className="absolute top-[20%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-25 blur-[150px] wody-orb-float"
            style={{
              background: "radial-gradient(circle, rgba(227,20,20,0.6) 0%, rgba(227,20,20,0.2) 35%, transparent 65%)",
            }}
          />
          {/* Accent orb — bottom left */}
          <div
            className="absolute bottom-[10%] left-[10%] w-[400px] h-[400px] rounded-full opacity-20 blur-[120px] wody-orb-float-slow"
            style={{
              background: "radial-gradient(circle, rgba(227,20,20,0.4) 0%, rgba(150,20,20,0.1) 50%, transparent 70%)",
            }}
          />
          {/* Cool white orb — top right */}
          <div
            className="absolute top-[15%] right-[5%] w-[300px] h-[300px] rounded-full opacity-[0.07] blur-[100px] wody-orb-float-slow"
            style={{
              background: "radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)",
            }}
          />
          {/* Grid pattern */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: "linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)",
              backgroundSize: "50px 50px",
            }}
          />
          {/* Noise texture overlay */}
          <div
            className="absolute inset-0 opacity-[0.015]"
            style={{
              backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")",
            }}
          />
          {/* Gradient fade at bottom */}
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

          <p className="text-lg sm:text-xl lg:text-2xl text-gray-300 max-w-lg mb-3 leading-relaxed font-body">
            La plataforma de gestion de
            <span className="text-white font-semibold"> WODs </span>
            y
            <span className="text-white font-semibold"> records </span>
            para tu box de CrossFit.
          </p>

          <p className="text-sm text-gray-600 mb-10 font-body">
            Multi-gym. Mobile-first. En tiempo real.
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

      {/* Features — glass cards grid */}
      <section className="px-6 pb-24 relative">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-heading font-bold uppercase tracking-[0.3em] text-[#E31414] text-center mb-3">
            Todo lo que necesitas
          </p>
          <h2 className="text-2xl sm:text-3xl font-heading font-black uppercase tracking-[0.05em] text-white text-center mb-12">
            Funcionalidades
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FeatureCard
              icon={<Dumbbell size={20} />}
              title="WODs diarios"
              description="Cada atleta recibe su WOD personalizado. El profe carga, edita y copia con un click."
            />
            <FeatureCard
              icon={<Trophy size={20} />}
              title="Records (RMs)"
              description="Registro de rep max con fecha. Editable y compartible en redes con imagen generada."
            />
            <FeatureCard
              icon={<Users size={20} />}
              title="Multi-gym"
              description="Cada box tiene su espacio aislado. Datos, usuarios y branding independientes."
            />
            <FeatureCard
              icon={<Smartphone size={20} />}
              title="Mobile-first"
              description="Pensado para usar desde el celular en el box. Responsive y rapido."
            />
            <FeatureCard
              icon={<BarChart3 size={20} />}
              title="Historial completo"
              description="Todo el historial de WODs y RMs del atleta, accesible en cualquier momento."
            />
            <FeatureCard
              icon={<Share2 size={20} />}
              title="Compartir logros"
              description="Genera imagenes para Instagram y WhatsApp cuando rompes un record."
            />
          </div>
        </div>
      </section>

      {/* Roles section */}
      <section className="border-t border-white/5 bg-[#08080D] px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-heading font-black uppercase tracking-[0.05em] text-white text-center mb-12">
            Para cada rol
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <RoleCard
              role="Atleta"
              features={["Ver WOD de hoy", "Historial de WODs", "Cargar y editar RMs", "Compartir records"]}
            />
            <RoleCard
              role="Profe"
              highlight
              features={["Cargar WODs por alumno", "Copiar entre fechas/atletas", "Editor Markdown", "Ver todos sus alumnos"]}
            />
            <RoleCard
              role="Admin"
              features={["Crear profes y atletas", "Asignar alumnos", "Panel de control", "Gestion completa"]}
            />
          </div>
        </div>
      </section>

      {/* Clients / Ingreso */}
      <section className="border-t border-white/5 px-6 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs font-heading font-bold uppercase tracking-[0.3em] text-[#E31414] mb-3">
            Nuestros boxes
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
                Los Polvorines, BA
              </span>
            </Link>
          </div>

          <p className="mt-8 text-xs text-gray-700 font-body">
            Queres tu box aca?{" "}
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
      <section className="px-6 py-20 text-center relative border-t border-white/5 bg-[#08080D]">
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full opacity-8 blur-[100px] pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(227,20,20,0.4) 0%, transparent 70%)",
          }}
          aria-hidden="true"
        />
        <div className="relative z-10">
          <h2 className="text-2xl sm:text-3xl font-heading font-black uppercase tracking-[0.05em] text-white mb-4">
            ¿Querés WODY para tu box?
          </h2>
          <p className="text-sm text-gray-500 mb-8 font-body max-w-md mx-auto">
            Contactanos y te armamos el espacio para tu gimnasio en minutos.
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
        <p className="text-xs text-gray-700 font-body tracking-wide">
          &copy; {new Date().getFullYear()} WODY
        </p>
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
