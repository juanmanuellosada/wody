import Link from "next/link";
import type { Metadata } from "next";
import { Check } from "lucide-react";

import { SITE_URL } from "@/lib/site";
import {
  MarketingHeader,
  MarketingCta,
  MarketingFaq,
  faqJsonLd,
} from "@/components/marketing/MarketingShell";

export const metadata: Metadata = {
  title: "Software de gestión para gimnasios en Argentina | Wody",
  description:
    "Sistema para administrar tu gimnasio: rutinas, cuotas y vencimientos, control de ingresos con QR, turnos y avisos push. Precio en pesos y 7 días de prueba gratis.",
  alternates: { canonical: "/software-gestion-gimnasios" },
  openGraph: {
    type: "article",
    url: `${SITE_URL}/software-gestion-gimnasios`,
    title: "Software de gestión para gimnasios en Argentina | Wody",
    description:
      "Rutinas, cuotas, ingresos con QR y turnos en una sola app. Precio en pesos, 7 días gratis.",
  },
};

const MODULOS = [
  {
    titulo: "Rutinas que el socio ve desde el celular",
    texto:
      "El profe carga la rutina y cada socio la ve en su teléfono, sin buscarla en un grupo de WhatsApp. Se pueden asignar a todo el gimnasio, a un grupo o a una persona sola. Para musculación existen rutinas fijas que se renuevan cada cierto tiempo.",
  },
  {
    titulo: "Cuotas y vencimientos",
    texto:
      "Registrás el pago de cada socio y la app te muestra quién está al día y quién venció. El socio recibe un aviso push antes de que se le venza, así no tenés que perseguirlo por mensaje.",
  },
  {
    titulo: "Control de ingresos en la puerta",
    texto:
      "Cada socio tiene número y código QR. En la entrada se lo escanea y en pantalla aparece su nombre, su estado de pago y si tiene algún bloqueo. Queda registrado quién entró, cuándo y quién lo autorizó.",
  },
  {
    titulo: "Turnos con cupo",
    texto:
      "Si trabajás con clases o con aforo limitado, cargás los horarios y el socio reserva su lugar desde la app. Ves cuántos anotados tenés en cada franja antes de que empiece.",
  },
  {
    titulo: "Récords y progreso",
    texto:
      "Cada socio registra sus marcas y ve su evolución en un gráfico. Es lo que hace que sostenga el entrenamiento en el tiempo, y es la razón más citada por la que alguien se queda en un gimnasio.",
  },
  {
    titulo: "Tu marca, no la nuestra",
    texto:
      "El gimnasio tiene su propia dirección web, su logo y su color. Cuando un socio comparte un logro en Instagram, sale con la marca de tu gimnasio.",
  },
];

const FAQ = [
  {
    q: "¿Cuánto sale un software de gestión para gimnasios en Argentina?",
    a: "Wody cuesta $40.000 por mes en pesos argentinos, sin límite de socios, con 7 días de prueba gratis y sin pedir tarjeta. Buena parte de las alternativas del rubro cobra en dólares o no publica el precio hasta que agendás una demo.",
  },
  {
    q: "¿Sirve para un gimnasio de musculación o solo para CrossFit?",
    a: "Para los dos. La aplicación cambia el vocabulario según el tipo de establecimiento: en un gimnasio tradicional habla de rutinas y récords personales, y en un box de CrossFit habla de WODs y RMs. Las rutinas fijas con renovación están pensadas específicamente para musculación.",
  },
  {
    q: "¿Hay que instalar algo o comprar equipamiento?",
    a: "No. Funciona desde el navegador y se puede instalar en el celular como una aplicación. Para el control de ingresos alcanza con un celular o una tablet en la entrada. No hace falta comprar molinetes ni lectores.",
  },
  {
    q: "¿Cómo se cobra la suscripción?",
    a: "Con Mercado Pago, en pesos y con débito automático mensual. No necesitás tarjeta internacional.",
  },
  {
    q: "¿Qué pasa con los datos de mis socios si dejo de usarlo?",
    a: "Los datos son del gimnasio. Si decidís dejarlo, se pueden exportar. La diferencia con una planilla en el celular de un profe es justamente esa: la información queda en el negocio.",
  },
  {
    q: "¿Cobra automáticamente la cuota a cada socio?",
    a: "Todavía no. Hoy el pago del socio se registra a mano y la app se encarga de los vencimientos y los avisos. El débito automático de la cuota del socio está en desarrollo. El que sí es automático es el cobro de la suscripción del gimnasio a Wody.",
  },
];

export default function SoftwareGestionGimnasios() {
  return (
    <main className="min-h-screen flex flex-col bg-[#0A0A0F] text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQ)) }}
      />
      <MarketingHeader />

      <section className="px-6 pt-14 pb-14 max-w-3xl mx-auto w-full">
        <p className="text-xs font-heading font-bold uppercase tracking-[0.3em] text-brand-red mb-4">
          Para gimnasios y boxes
        </p>
        <h1 className="text-3xl sm:text-5xl font-heading font-black uppercase tracking-[0.02em] mb-6">
          Software de gestión para gimnasios
        </h1>
        <p className="text-base text-gray-400 font-body leading-relaxed mb-4">
          Administrar un gimnasio en Argentina termina siendo lo mismo en todos
          lados: un grupo de WhatsApp para las rutinas, una planilla para las
          cuotas y la memoria del profe para el resto. Wody junta esas tres
          cosas en una sola aplicación, cobra en pesos y se paga con Mercado
          Pago.
        </p>
        <p className="text-base text-gray-400 font-body leading-relaxed">
          Sirve tanto para un gimnasio de musculación como para un box de
          CrossFit: la aplicación cambia el vocabulario según el caso.
        </p>
      </section>

      <section className="border-t border-white/5 bg-[#08080D] px-6 py-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl sm:text-2xl font-heading font-black uppercase tracking-[0.05em] mb-10">
            Qué resuelve
          </h2>
          <div className="grid sm:grid-cols-2 gap-x-10 gap-y-9">
            {MODULOS.map((m) => (
              <div key={m.titulo}>
                <h3 className="text-base font-heading font-bold text-white mb-2 flex gap-2">
                  <Check
                    className="w-4 h-4 text-brand-red flex-shrink-0 mt-1"
                    aria-hidden="true"
                  />
                  {m.titulo}
                </h3>
                <p className="text-sm text-gray-400 font-body leading-relaxed">
                  {m.texto}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl sm:text-2xl font-heading font-black uppercase tracking-[0.05em] mb-4">
            Qué todavía no hace
          </h2>
          <p className="text-sm text-gray-400 font-body leading-relaxed mb-4">
            Para que no te enteres a mitad de la prueba: Wody todavía no cobra
            automáticamente la cuota de cada socio (el pago se registra a mano y
            la app maneja vencimientos y avisos), no tiene aplicación nativa en
            las tiendas —funciona como aplicación web instalable— y no guarda
            resultados de WOD con tabla de posiciones.
          </p>
          <p className="text-sm text-gray-400 font-body leading-relaxed">
            Si alguna de esas tres cosas es indispensable para vos, conviene que
            lo sepas ahora.{" "}
            <Link
              href="/comparativa"
              className="text-white underline underline-offset-2 hover:text-brand-red"
            >
              Mirá las comparativas
            </Link>{" "}
            para ver cómo queda frente a las alternativas.
          </p>
        </div>
      </section>

      <MarketingFaq preguntas={FAQ} />

      <MarketingCta
        titulo="Probalo con tu gimnasio cargado"
        bajada="7 días gratis, sin tarjeta. Te dejamos el gimnasio precargado para que lo veas andando con tus datos."
      />
    </main>
  );
}
