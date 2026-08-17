/**
 * Contenido de las páginas /comparativa/[competidor].
 *
 * Regla de oro: cada dato de un competidor sale de su sitio oficial y va con
 * fecha y link. Publicar un precio inventado de un competidor es, además de
 * desleal, la forma más rápida de perder la venta cuando el prospecto lo
 * verifica. Los datos de Wody salen del repo, no del marketing: si acá dice
 * que algo no existe, es porque efectivamente no existe todavía.
 */

export type FilaComparativa = {
  criterio: string;
  wody: string;
  rival: string;
  /** Quién gana la fila. `rival` se usa de verdad: la honestidad es el argumento. */
  ventaja: "wody" | "rival" | "empate";
};

export type Comparativa = {
  slug: string;
  competidor: string;
  /** <title> — arranca por la keyword, no por la marca. */
  title: string;
  h1: string;
  description: string;
  intro: string;
  filas: FilaComparativa[];
  porQueWody: string[];
  cuandoElRival: string[];
  /** Solo cuando se comparan datos publicados por un competidor. */
  verificadoEl?: string;
  fuente?: { url: string; label: string };
};

const VERIFICADO = "17 de agosto de 2026";

export const COMPARATIVAS: Comparativa[] = [
  {
    slug: "whatsapp-y-planillas",
    competidor: "WhatsApp y planillas",
    title: "Dejar de manejar el gimnasio por WhatsApp y Excel | Wody",
    h1: "Wody vs WhatsApp y planillas",
    description:
      "La mayoría de los gimnasios argentinos se manejan con un grupo de WhatsApp y una planilla. Qué se gana y qué se pierde al pasar a una app de gestión.",
    intro:
      "Antes de comparar Wody con otro software conviene comparar con lo que realmente estás usando hoy: un grupo de WhatsApp para mandar las rutinas y una planilla para saber quién pagó. Funciona, es gratis y lo conocés de memoria. El problema aparece cuando el gimnasio crece: el mensaje se pierde entre veinte audios, nadie sabe cuál es la rutina de hoy, y la planilla la tenés solo vos.",
    filas: [
      {
        criterio: "Costo mensual",
        wody: "$40.000 ARS",
        rival: "Cero",
        ventaja: "rival",
      },
      {
        criterio: "Encontrar la rutina de hoy",
        wody: "Está en la pantalla principal del alumno",
        rival: "Hay que buscarla entre los mensajes del grupo",
        ventaja: "wody",
      },
      {
        criterio: "Saber quién debe la cuota",
        wody: "Lista de vencidos y aviso automático",
        rival: "Depende de que alguien mire la planilla",
        ventaja: "wody",
      },
      {
        criterio: "Historial de récords del alumno",
        wody: "Guardado, con gráfico de evolución",
        rival: "En la memoria del profe o en un cuaderno",
        ventaja: "wody",
      },
      {
        criterio: "Saber quién entró hoy",
        wody: "Registro de ingresos con QR e historial",
        rival: "No queda registro",
        ventaja: "wody",
      },
      {
        criterio: "Si se va el profe que llevaba todo",
        wody: "Los datos quedan en el gimnasio",
        rival: "Se van con él, en su celular",
        ventaja: "wody",
      },
      {
        criterio: "Reserva de turnos con cupo",
        wody: "El alumno reserva y ve los lugares disponibles",
        rival: "Se cuenta a mano o no se controla",
        ventaja: "wody",
      },
      {
        criterio: "Curva de aprendizaje",
        wody: "Hay que cargar los alumnos y aprender la app",
        rival: "Ninguna: ya lo sabés usar",
        ventaja: "rival",
      },
    ],
    porQueWody: [
      "El alumno abre la app y ve la rutina del día. No pregunta más por WhatsApp.",
      "Sabés en cualquier momento quién está al día y quién no, sin abrir una planilla.",
      "El progreso de cada alumno queda guardado y con gráfico: es lo que hace que se quede.",
      "Los datos son del gimnasio, no del celular del profe que un día se va.",
      "El tiempo que hoy se te va contestando mensajes vuelve a ser tiempo de dar clase.",
    ],
    cuandoElRival: [
      "Si tenés menos de quince alumnos y los conocés a todos por el nombre, WhatsApp y una planilla te alcanzan. No pagues por algo que todavía no necesitás.",
      "Si el gimnasio es tuyo y de nadie más, no delegás y no planeás crecer, el orden que aporta una app te va a sobrar.",
      "Nada de esto es gratis: son $40.000 por mes y un rato de carga inicial. Si el desorden actual no te está costando plata ni alumnos, esperá.",
    ],
  },
  {
    slug: "crosshero",
    competidor: "CrossHero",
    title: "Wody vs CrossHero: cuál conviene en Argentina | Wody",
    h1: "Wody vs CrossHero",
    description:
      "Comparación entre Wody y CrossHero para boxes y gimnasios argentinos: precio transparente vs demo comercial, Mercado Pago, y en qué casos conviene cada uno.",
    intro:
      "CrossHero es el competidor más serio de la región: más de mil gimnasios en España y Latinoamérica, y muy fuerte en centros multi-disciplina. La diferencia principal es de transparencia y de medio de pago: CrossHero no publica precios —hay que pedir una demo para saber cuánto sale— y no menciona Mercado Pago en su sitio.",
    filas: [
      {
        criterio: "Precio público",
        wody: "$40.000 ARS por mes, publicado en la web",
        rival: "No publica precios: hay que pedir una demo",
        ventaja: "wody",
      },
      {
        criterio: "Prueba gratis",
        wody: "7 días, sin tarjeta",
        rival: "Ofrece prueba gratis, sin especificar duración",
        ventaja: "empate",
      },
      {
        criterio: "Cobro con Mercado Pago",
        wody: "Sí, suscripción automática",
        rival: "Dice permitir pago en moneda local, pero no nombra Mercado Pago",
        ventaja: "wody",
      },
      {
        criterio: "Presencia en Argentina",
        wody: "Es su único mercado",
        rival: "Sí, con gimnasios y embajadores en el país",
        ventaja: "empate",
      },
      {
        criterio: "Reserva de turnos con cupo",
        wody: "Sí",
        rival: "Sí, con control de aforo",
        ventaja: "empate",
      },
      {
        criterio: "Disciplinas cubiertas",
        wody: "CrossFit, musculación y funcional",
        rival: "Además yoga, pilates, danza y artes marciales",
        ventaja: "rival",
      },
      {
        criterio: "Escala",
        wody: "Producto joven, pocos gimnasios",
        rival: "Más de 1.000 gimnasios en España y LatAm",
        ventaja: "rival",
      },
      {
        criterio: "Soporte",
        wody: "Directo con quien desarrolla el producto",
        rival: "Equipo de soporte establecido",
        ventaja: "empate",
      },
    ],
    porQueWody: [
      "Sabés cuánto pagás antes de hablar con nadie: el precio está publicado.",
      "Mercado Pago nativo, en pesos, sin pasarela extranjera de por medio.",
      "Probás 7 días sin cargar tarjeta ni agendar una llamada comercial.",
      "Hablás directo con quien desarrolla la app, no con un equipo de soporte por ticket.",
    ],
    cuandoElRival: [
      "Si tu centro combina muchas disciplinas distintas (yoga, danza, artes marciales), CrossHero está pensado para esa variedad y Wody está enfocado en CrossFit, musculación y funcional.",
      "Si te pesa la trayectoria: CrossHero tiene más de mil gimnasios encima. Wody es un producto joven y hay que decirlo.",
    ],
    verificadoEl: VERIFICADO,
    fuente: { url: "https://business.crosshero.com/", label: "business.crosshero.com" },
  },
  {
    slug: "wodify",
    competidor: "Wodify",
    title: "Wody vs Wodify: alternativa en pesos para tu box | Wody",
    h1: "Wody vs Wodify",
    description:
      "Comparación entre Wody y Wodify para boxes de CrossFit argentinos: costo en pesos vs dólares, leaderboards, soporte en español y cuándo conviene cada uno.",
    intro:
      "Wodify es el referente global del CrossFit y su registro de resultados con leaderboards es el mejor del rubro: en eso nos gana y no tiene sentido discutirlo. La comparación relevante para un box argentino es otra: Wodify cobra en dólares por sede, y ese costo se mueve con el tipo de cambio todos los meses.",
    filas: [
      {
        criterio: "Moneda del abono",
        wody: "Pesos argentinos",
        rival: "Dólares",
        ventaja: "wody",
      },
      {
        criterio: "Precio publicado",
        wody: "$40.000 ARS por mes",
        rival: "Plan Essentials desde USD 199 por mes por sede (con promoción vigente a USD 99)",
        ventaja: "wody",
      },
      {
        criterio: "Resultados de WOD y leaderboards",
        wody: "No lo tiene todavía: guarda RMs con historial, pero no scores por WOD",
        rival: "Es su punto más fuerte del rubro",
        ventaja: "rival",
      },
      {
        criterio: "Prueba gratis",
        wody: "7 días, sin tarjeta",
        rival: "No publica prueba gratis; ofrece un primer mes a USD 1",
        ventaja: "empate",
      },
      {
        criterio: "Soporte en español",
        wody: "Sí, en tu huso horario",
        rival: "No lo menciona en su sitio de precios",
        ventaja: "wody",
      },
      {
        criterio: "Cobro con Mercado Pago",
        wody: "Sí, suscripción automática",
        rival: "No lo menciona",
        ventaja: "wody",
      },
      {
        criterio: "App nativa iOS y Android",
        wody: "No: es una app web que se instala en el celular",
        rival: "Sí, app nativa",
        ventaja: "rival",
      },
    ],
    porQueWody: [
      "Pagás en pesos: el costo no se te mueve con el dólar todos los meses.",
      "Mercado Pago nativo, sin tarjeta internacional.",
      "Soporte en español y en tu huso horario, no a doce horas de diferencia.",
      "Probás 7 días gratis sin cargar tarjeta.",
    ],
    cuandoElRival: [
      "Si el leaderboard y el seguimiento de resultados por WOD son el corazón de tu box, Wodify lo hace mejor que nadie y Wody todavía no lo tiene.",
      "Si necesitás una app nativa con la marca de tu box en las tiendas, Wodify la ofrece y Wody funciona como app web instalable.",
      "Si facturás en dólares o tenés sedes fuera de Argentina, la ventaja de precio de Wody desaparece.",
    ],
    verificadoEl: VERIFICADO,
    fuente: { url: "https://www.wodify.com/pricing", label: "wodify.com/pricing" },
  },
];

export function getComparativa(slug: string): Comparativa | undefined {
  return COMPARATIVAS.find((c) => c.slug === slug);
}
