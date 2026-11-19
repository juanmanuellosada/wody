import Image from "next/image";
import styles from "./LandingExperience.module.css";

const WODY_ORIGIN = "https://www.wody.com.ar";

const SNAPSHOT_SOURCE = "https://www.wody.com.ar/";
const SNAPSHOT_CAPTURED_AT = "2026-09-19T21:24:44-03:00";

type SnapshotCoupon = {
  title: string;
  category: string;
  description: string;
  restriction?: string;
  logo: string;
};

const coupons: readonly SnapshotCoupon[] = [
  { title: "Quinque · Primera compra", category: "Tienda online", description: "10% de descuento en tu primera compra. Productos integrales, sin minimo de compra. Pastelería saludable. Los Polvorines. Envíos a domicilio.", restriction: "Productos integrales, sin minimo de compra. Pastelería saludable Aplica el cupon al finalizar tu compra NO APLICA A TORTAS Y TARTAS.", logo: "/_next/static/media/quinque.0oh.8l9cbjn1y.png" },
  { title: "Quinque · Clientes", category: "Tienda online", description: "15% de descuento en compras posteriores.", restriction: "Productos integrales, monto mínimo $20.000 Aplica el cupon al finalizar tu compra NO APLICA A TORTAS Y TARTAS.", logo: "/_next/static/media/quinque.0oh.8l9cbjn1y.png" },
  { title: "Floran's Belleza", category: "1 uso por mes", description: "10% de descuento en cualquier servicio. Villa de Mayo.", logo: "/_next/static/media/florans-belleza.0c1n7bitfeskl.png" },
  { title: "Nutrite con Lu", category: "Un solo uso", description: "Bioimpedancia de regalo con tu consulta nutricional. La consulta se abona y de regalo te hacen la bioimpedancia sin costo extra. Los Polvorines.", logo: "/_next/static/media/nutrite-con-lu.0-lss86tdvkmq.png" },
  { title: "Buena Vibra Cerámica · Piezas", category: "Un solo uso", description: "10% de descuento en piezas de cerámica. Envíos a todo el país.", logo: "https://yc8n1ahwk4h5hvb2.public.blob.vercel-storage.com/coupons/buena-vibra-NSNH08mZEgjEORbRiiDB29jxKcD3lb.webp" },
  { title: "Ready For Wod · Primera compra", category: "Un solo uso", description: "10% de descuento en tu primera compra. Zona Norte. Envíos a domicilio.", logo: "/_next/static/media/ready-for-wod.059i73a-261m4.png" },
  { title: "Ready For Wod · Clientes", category: "Uso libre", description: "5% de descuento desde tu segunda compra en adelante.", logo: "/_next/static/media/ready-for-wod.059i73a-261m4.png" },
  { title: "Buena Vibra Cerámica · Talleres", category: "Un solo uso", description: "10% de descuento en tu primer mes de talleres o tu primer workshop. San Miguel.", logo: "https://yc8n1ahwk4h5hvb2.public.blob.vercel-storage.com/coupons/632030054_18087572792142222_7612800306820298658_n-RoV9Rvz7cdUjWeVUt6ocBYrUKSTduM.webp" },
  { title: "Jenni Lescano Estetica", category: "Un solo uso", description: "20% de descuento en tu primera sesión de tratamientos faciales. Boulogne, Sourdeaux y a domicilio.", logo: "https://yc8n1ahwk4h5hvb2.public.blob.vercel-storage.com/coupons/775245025_17906527791526659_341163939026256019_n-pHYh4PxlbvyBXCxgwWZhOBNRfFlJ9b.webp" },
  { title: "A Todo Ritmo", category: "Uso libre", description: "10% de descuento abonando en efectivo o transferencia en el total de la compra. San Miguel.", logo: "/_next/static/media/atr.09g~77ibh-bkk.png" },
  { title: "Becasual FT", category: "Uso libre", description: "10% de descuento a partir de 2 prendas. Malvinas Argentinas. Puntos de encuentro y envíos.", logo: "/_next/static/media/becalsualf-ft.07-xyffwaf1fu.png" },
  { title: "Buena Vibra Sport", category: "Uso libre", description: "10% de descuento en indumentaria deportiva. Tigre, Buenos Aires. Envíos.", logo: "/_next/static/media/bv-sports.0oralk..ru64f.png" },
  { title: "Ray of Light · Primera clase particular", category: "Un solo uso", description: "10% de descuento en tu primera clase particular. Villa de Mayo.", logo: "/_next/static/media/ray-of-light.0m8.oa8awjdex.png" },
  { title: "Ray of Light · Primera clase online", category: "Un solo uso", description: "10% de descuento en tu primera clase online. Villa de Mayo.", logo: "/_next/static/media/ray-of-light.0m8.oa8awjdex.png" },
  { title: "Tica", category: "Tienda online", description: "10% de descuento en ticaclothes.com.ar. Envíos a todo el país.", restriction: "Aplican restricciones en fechas especiales y promos masivas como Cyber Monday, Black Friday, etc.", logo: "/_next/static/media/tica.0l84~tpksio0j.png" },
  { title: "Nutrilion · 5%", category: "Uso libre", description: "5% de descuento en toda la tienda. Sin mínimo de compra y sin tope de reintegro. Los Polvorines.", logo: "/_next/static/media/nutrilion.16xykdi98e66p.png" },
  { title: "Nutrilion · 10%", category: "Uso libre", description: "10% de descuento en toda la tienda. Mínimo de compra $30.000 y tope de reintegro de $10.000. Los Polvorines.", restriction: "Mínimo de compra $30.000. Tope de reintegro $10.000.", logo: "/_next/static/media/nutrilion.16xykdi98e66p.png" },
  { title: "Backerei Pastelería Fina", category: "Uso libre", description: "15% de descuento. Entregas en Zona Norte.", logo: "/_next/static/media/backerei.0_wlue01n-g6q.png" },
  { title: "Kaori Hogar", category: "Uso libre", description: "10% de descuento. Compra mínima de 2 productos. San Miguel y San Isidro. Envíos.", logo: "/_next/static/media/kaori.059u6mj7e__9w.png" },
  { title: "Ámbar Tienda Natural · 5%", category: "Uso libre", description: "5% de descuento en toda la tienda. Sin mínimo de compra y sin tope de reintegro. Los Polvorines.", logo: "/_next/static/media/ambar.1349r0fqzmkar.png" },
  { title: "Ámbar Tienda Natural · 10%", category: "Uso libre", description: "10% de descuento en toda la tienda. Mínimo de compra $30.000 y tope de reintegro de $10.000. Los Polvorines.", logo: "/_next/static/media/ambar.1349r0fqzmkar.png" },
  { title: "German Masajista", category: "Un solo uso", description: "25% de descuento en masajes deportivos o relajantes. Grand Bourg.", logo: "/_next/static/media/ger.02os3624qsqp9.png" },
  { title: "Estética Greysi", category: "Un solo uso", description: "15% de descuento en podología. Francisco Beiró 11, Boulogne, San Isidro.", logo: "/_next/static/media/greysi.0p-9_b0~ka_q-.png" },
  { title: "Estética Greysi", category: "Un solo uso", description: "10% de descuento en esmaltado semipermanente. Francisco Beiró 11, Boulogne, San Isidro.", logo: "/_next/static/media/greysi.0p-9_b0~ka_q-.png" },
];

function assetUrl(path: string) {
  return path.startsWith("http") ? path : `${WODY_ORIGIN}${path}`;
}

export function PreviewBenefits() {
  return (
    <section className={styles.benefits} aria-labelledby="preview-benefits-title">
      <div className={styles.benefitsInner}>
        <h2 id="preview-benefits-title">Beneficios</h2>
        <p>Descuentos y regalos de comercios aliados, para alumnos de cualquier gym que use WODY.</p>
        <p className={styles.snapshotNote}>Snapshot público: <a href={SNAPSHOT_SOURCE} target="_blank" rel="noopener noreferrer">wody.com.ar</a> · capturado {SNAPSHOT_CAPTURED_AT}. Vigencia consultable en Wody.</p>
        <div className={styles.couponGrid}>
          {coupons.map((coupon, index) => (
            <article key={`${coupon.title}-${index}`} className={styles.couponCard}>
              <header>
                <Image src={assetUrl(coupon.logo)} alt={coupon.title} width={64} height={64} unoptimized />
                <div><h3>{coupon.title}</h3><p>{coupon.category}</p></div>
              </header>
              <p>{coupon.description}</p>
              {coupon.restriction && <p className={styles.couponRestriction}>{coupon.restriction}</p>}
              <a href={`${WODY_ORIGIN}/#benefits-login`} target="_blank" rel="noopener noreferrer">Ingresá para usar</a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
