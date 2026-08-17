import { ImageResponse } from "next/og";
import { SITE_TITLE } from "@/lib/site";

export const alt = SITE_TITLE;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Imagen que ven WhatsApp, Instagram y Google cuando se comparte wody.com.ar.
 * Se genera en build en vez de mantener un PNG a mano: si cambia el mensaje,
 * cambia acá y no hay que reexportar nada desde el diseño.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          backgroundColor: "#0A0A0F",
          padding: "0 90px",
          position: "relative",
        }}
      >
        {/* Halo rojo de marca, mismo gesto que el hero de la landing. Va sobre
            todo el lienzo en vez de en una caja propia: si el degradado se
            corta antes del borde del div, la caja se ve como una costura. */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            backgroundImage:
              "radial-gradient(circle at 82% 12%, rgba(227,20,20,0.55) 0%, rgba(227,20,20,0.18) 32%, rgba(10,10,15,0) 62%)",
          }}
        />

        <div
          style={{
            display: "flex",
            fontSize: 150,
            fontWeight: 800,
            color: "#FFFFFF",
            letterSpacing: -6,
            lineHeight: 1,
          }}
        >
          WODY
        </div>

        <div
          style={{
            display: "flex",
            width: 150,
            height: 12,
            backgroundColor: "#E31414",
            margin: "34px 0 40px",
          }}
        />

        <div
          style={{
            display: "flex",
            fontSize: 46,
            color: "#E5E7EB",
            lineHeight: 1.25,
            maxWidth: 900,
          }}
        >
          Software de gestión para gimnasios y boxes de CrossFit
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 40,
            fontSize: 30,
            color: "#9CA3AF",
          }}
        >
          Rutinas · RMs · Turnos · Acceso con QR · Cuotas con Mercado Pago
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 56,
            right: 90,
            display: "flex",
            fontSize: 30,
            color: "#E31414",
            fontWeight: 700,
          }}
        >
          wody.com.ar
        </div>
      </div>
    ),
    { ...size }
  );
}
