export type CouponRule = "ONCE_PER_USER" | "ONCE_GLOBAL" | "UNLIMITED";

export type DemoCoupon = {
  id: string;
  slug: string;
  name: string;
  description: string;
  instagramHandle: string;
  instagramUrl: string;
  rule: CouponRule;
  fixedCode: string | null;
  websiteUrl: string | null;
  restrictions: string | null;
};

export const demoBeneficios: DemoCoupon[] = [
  {
    id: "b1",
    slug: "suplementos-atlas",
    name: "Suplementos Atlas",
    description: "15% de descuento en toda la tienda online: proteínas, creatina y pre-workouts.",
    instagramHandle: "suplementosatlas",
    instagramUrl: "https://instagram.com/suplementosatlas",
    rule: "UNLIMITED",
    fixedCode: "WODY15",
    websiteUrl: "https://suplementosatlas.com.ar",
    restrictions: "No acumulable con otras promociones.",
  },
  {
    id: "b2",
    slug: "kinesis-ropa",
    name: "Kinesis Ropa Deportiva",
    description: "20% off en tu primera compra de indumentaria deportiva.",
    instagramHandle: "kinesisropa",
    instagramUrl: "https://instagram.com/kinesisropa",
    rule: "ONCE_PER_USER",
    fixedCode: "KINE20",
    websiteUrl: "https://kinesis.com.ar",
    restrictions: "Válido una vez por usuario. Solo en tienda online.",
  },
  {
    id: "b3",
    slug: "nutri-coaching",
    name: "Nutri Coaching",
    description: "Primera consulta nutricional con descuento de $3.000. Presentá el código al reservar.",
    instagramHandle: "nutricoachingba",
    instagramUrl: "https://instagram.com/nutricoachingba",
    rule: "ONCE_PER_USER",
    fixedCode: null,
    websiteUrl: null,
    restrictions: "Solo válido para nuevos pacientes.",
  },
  {
    id: "b4",
    slug: "estudio-move",
    name: "Estudio Move — Yoga & Pilates",
    description: "2 clases de prueba gratis para alumnos de cualquier gym WODY.",
    instagramHandle: "estudiomove",
    instagramUrl: "https://instagram.com/estudiomove",
    rule: "ONCE_PER_USER",
    fixedCode: null,
    websiteUrl: null,
    restrictions: "Sujeto a disponibilidad de horarios. Solo presencial.",
  },
  {
    id: "b5",
    slug: "verde-jugueria",
    name: "Verde Juguería Saludable",
    description: "Llevás 2 smoothies y pagás 1. Mostrá el código en caja.",
    instagramHandle: "verdejugueria",
    instagramUrl: "https://instagram.com/verdejugueria",
    rule: "UNLIMITED",
    fixedCode: "WODY2X1",
    websiteUrl: null,
    restrictions: "De lunes a viernes. No válido feriados.",
  },
  {
    id: "b6",
    slug: "fierro-equipamiento",
    name: "Fierro Equipamiento",
    description: "10% off en mancuernas, kettlebells y barras. Envío gratuito a partir de $50.000.",
    instagramHandle: "fierroequipamiento",
    instagramUrl: "https://instagram.com/fierroequipamiento",
    rule: "UNLIMITED",
    fixedCode: "WODY10",
    websiteUrl: "https://fierro.com.ar",
    restrictions: null,
  },
  {
    id: "b7",
    slug: "kinesiologia-activa",
    name: "Kinesiología Activa",
    description: "Sesión de evaluación postural gratuita. Reservá por DM con el código.",
    instagramHandle: "kinesiologiaactiva",
    instagramUrl: "https://instagram.com/kinesiologiaactiva",
    rule: "ONCE_GLOBAL",
    fixedCode: null,
    websiteUrl: null,
    restrictions: "Único turno disponible. Primero que llegue.",
  },
  {
    id: "b8",
    slug: "black-coffee",
    name: "Black Coffee Roasters",
    description: "Café de especialidad: 15% off en bolsas de 250g y 1kg. Solo tienda online.",
    instagramHandle: "blackcoffeeroasters",
    instagramUrl: "https://instagram.com/blackcoffeeroasters",
    rule: "UNLIMITED",
    fixedCode: "WODY15",
    websiteUrl: "https://blackcoffee.com.ar",
    restrictions: null,
  },
  {
    id: "b9",
    slug: "sport-tape",
    name: "Sport Tape Argentina",
    description: "Pack de vendaje kinesiológico con 20% de descuento. Ideal para entrenamiento.",
    instagramHandle: "sporttapearg",
    instagramUrl: "https://instagram.com/sporttapearg",
    rule: "ONCE_PER_USER",
    fixedCode: "TAPE20",
    websiteUrl: "https://sporttape.com.ar",
    restrictions: "Solo la primera compra online.",
  },
];
