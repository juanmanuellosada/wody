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
  title: "Control de acceso para gimnasios con QR | Wody",
  description:
    "Controlá el ingreso de socios con código QR desde un celular o tablet: estado de pago en pantalla, historial de accesos y funcionamiento sin internet. Sin comprar molinete.",
  alternates: { canonical: "/control-de-acceso-gimnasio-qr" },
  openGraph: {
    type: "article",
    url: `${SITE_URL}/control-de-acceso-gimnasio-qr`,
    title: "Control de acceso para gimnasios con QR | Wody",
    description:
      "Ingreso de socios con QR desde un celular, con estado de pago en pantalla e historial completo. Sin hardware.",
  },
};

const PASOS = [
  {
    n: "01",
    titulo: "El socio llega y se identifica",
    texto:
      "Muestra su código QR desde la aplicación, o dice su número de socio. También sirve el email. El primero que coincide, gana.",
  },
  {
    n: "02",
    titulo: "La pantalla muestra su ficha",
    texto:
      "Aparece el nombre, la foto de situación del socio, si tiene la cuota al día y si arrastra algún bloqueo. Verde, amarillo o rojo, para que se entienda de un vistazo.",
  },
  {
    n: "03",
    titulo: "El operador decide",
    texto:
      "Permitir o denegar, con motivo opcional. La decisión la toma una persona mirando la pantalla y la cara del socio, no un molinete.",
  },
  {
    n: "04",
    titulo: "Queda registrado",
    texto:
      "Cada ingreso guarda quién entró, a qué hora, qué se decidió y qué operador lo autorizó. El historial se filtra por día o por socio.",
  },
];

const VENTAJAS = [
  "Funciona con un celular o una tablet común en la entrada. No hay que comprar molinete ni lector.",
  "Sigue andando si se cae internet: guarda una copia local de los socios y sincroniza cuando vuelve.",
  "Hay un rol dedicado para el recepcionista, que solo ve la pantalla de ingresos y nada más del gimnasio.",
  "El QR de cada socio se puede regenerar: el anterior deja de servir al instante si se lo pasó a un amigo.",
  "El número de socio se asigna solo y es único dentro de tu gimnasio.",
];

const FAQ = [
  {
    q: "¿Necesito comprar un molinete o un lector de QR?",
    a: "No. Alcanza con un celular o una tablet con cámara en la entrada. El escaneo lo hace la cámara del dispositivo desde el navegador.",
  },
  {
    q: "¿Abre la puerta solo?",
    a: "No. Wody no se integra todavía con hardware de puerta ni con molinetes: muestra en pantalla si el socio puede pasar y la decisión la toma la persona que está en la entrada. Si lo que buscás es una barrera física que se abra sola, esto no lo reemplaza.",
  },
  {
    q: "¿Qué pasa si se cae internet?",
    a: "El control de ingresos sigue funcionando. Mantiene una copia local de los socios del gimnasio en el dispositivo de la entrada y sincroniza los registros cuando la conexión vuelve.",
  },
  {
    q: "¿Puedo ver quién entró y a qué hora?",
    a: "Sí. Hay un historial completo de accesos que se filtra por día o por socio, y guarda qué operador autorizó cada ingreso y con qué resultado.",
  },
  {
    q: "¿Se puede saber en la puerta si el socio debe la cuota?",
    a: "Sí. Al identificarse, la pantalla muestra el estado de pago junto con el nombre, así el recepcionista lo ve antes de dejarlo pasar.",
  },
  {
    q: "¿Y si un socio le presta el QR a otro?",
    a: "El código se puede regenerar desde el panel del gimnasio o desde el propio dashboard del socio, y el anterior deja de validar. Además, como la decisión final la toma una persona que ve quién está enfrente, el préstamo de código no alcanza para entrar.",
  },
];

export default function ControlDeAccesoQr() {
  return (
    <main className="min-h-screen flex flex-col bg-[#0A0A0F] text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQ)) }}
      />
      <MarketingHeader />

      <section className="px-6 pt-14 pb-14 max-w-3xl mx-auto w-full">
        <p className="text-xs font-heading font-bold uppercase tracking-[0.3em] text-brand-red mb-4">
          Control de ingresos
        </p>
        <h1 className="text-3xl sm:text-5xl font-heading font-black uppercase tracking-[0.02em] mb-6">
          Control de acceso con QR para tu gimnasio
        </h1>
        <p className="text-base text-gray-400 font-body leading-relaxed mb-4">
          Saber quién entra a tu gimnasio y si está al día no debería costar lo
          que sale un molinete. Con Wody alcanza con un celular o una tablet en
          la entrada: el socio muestra su código, la pantalla dice si puede
          pasar, y queda registrado.
        </p>
        <p className="text-base text-gray-400 font-body leading-relaxed">
          Está pensado para funcionar en la realidad de un gimnasio argentino,
          incluso cuando se cae internet.
        </p>
      </section>

      <section className="border-t border-white/5 bg-[#08080D] px-6 py-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl sm:text-2xl font-heading font-black uppercase tracking-[0.05em] mb-10">
            Cómo funciona
          </h2>
          <div className="flex flex-col gap-8">
            {PASOS.map((p) => (
              <div key={p.n} className="flex gap-5">
                <span className="text-2xl font-heading font-black text-brand-red/40 flex-shrink-0 leading-none pt-0.5">
                  {p.n}
                </span>
                <div>
                  <h3 className="text-base font-heading font-bold text-white mb-1.5">
                    {p.titulo}
                  </h3>
                  <p className="text-sm text-gray-400 font-body leading-relaxed">
                    {p.texto}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl sm:text-2xl font-heading font-black uppercase tracking-[0.05em] mb-9">
            Por qué así y no con un molinete
          </h2>
          <ul className="flex flex-col gap-4">
            {VENTAJAS.map((v) => (
              <li key={v} className="flex gap-3 text-sm text-gray-300 font-body">
                <Check
                  className="w-4 h-4 text-brand-red flex-shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                {v}
              </li>
            ))}
          </ul>
          <p className="mt-8 text-sm text-gray-500 font-body leading-relaxed">
            Dicho de frente: Wody todavía no se conecta con molinetes ni con
            cerraduras. Si necesitás que la puerta se abra sola, esto no lo
            reemplaza. Lo que reemplaza es el cuaderno de la entrada y el
            &ldquo;¿este pagó?&rdquo; a los gritos.
          </p>
        </div>
      </section>

      <MarketingFaq preguntas={FAQ} />

      <section className="px-6 pb-16">
        <div className="max-w-3xl mx-auto">
          <p className="text-sm text-gray-500 font-body">
            El control de ingresos viene incluido en{" "}
            <Link
              href="/software-gestion-gimnasios"
              className="text-white underline underline-offset-2 hover:text-brand-red"
            >
              el sistema de gestión completo
            </Link>
            , junto con rutinas, cuotas y turnos. No se cobra aparte.
          </p>
        </div>
      </section>

      <MarketingCta
        titulo="Probá el control de ingresos"
        bajada="7 días gratis, sin tarjeta y sin comprar nada. Si tenés una tablet vieja en un cajón, ya tenés el equipamiento."
      />
    </main>
  );
}
