import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import React from "react";

interface LeadApprovedEmailProps {
  contactName: string;
  gymName: string;
  onboardingUrl: string;
  tokenExpiresAt: Date;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function LeadApprovedEmail({
  contactName,
  gymName,
  onboardingUrl,
  tokenExpiresAt,
}: LeadApprovedEmailProps) {
  const baseUrl = process.env.APP_URL ?? "https://www.wody.com.ar";
  const assetBaseUrl = baseUrl.replace("://wody.com.ar", "://www.wody.com.ar");
  const wodyLogoUrl = `${assetBaseUrl}/logos/wody-negro.png`;

  return (
    <Html lang="es">
      <Head />
      <Preview>Tu gym está aprobado — completá el registro de {gymName}</Preview>
      <Body
        style={{
          backgroundColor: "#f4f4f5",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          margin: "0",
          padding: "0",
        }}
      >
        <Container
          style={{
            backgroundColor: "#ffffff",
            maxWidth: "560px",
            margin: "32px auto",
            padding: "32px",
            borderRadius: "12px",
          }}
        >
          <Img
            src={wodyLogoUrl}
            alt="Wody"
            height={28}
            style={{ marginBottom: "24px" }}
          />

          <Heading
            style={{
              fontSize: "22px",
              fontWeight: "700",
              margin: "0 0 16px 0",
              color: "#18181b",
            }}
          >
            ¡{contactName}, tu gym está aprobado!
          </Heading>

          <Text style={{ fontSize: "15px", color: "#3f3f46", lineHeight: "1.6", margin: "0 0 12px 0" }}>
            Aprobamos la solicitud para <strong>{gymName}</strong> en Wody. Ya podés completar el registro y dejar tu gym listo para operar.
          </Text>

          <Text style={{ fontSize: "15px", color: "#3f3f46", lineHeight: "1.6", margin: "0 0 8px 0" }}>
            Con el link de abajo vas a poder:
          </Text>

          <Text style={{ fontSize: "15px", color: "#3f3f46", lineHeight: "1.6", margin: "0 0 24px 0" }}>
            · Elegir la URL de tu gym (por ejemplo, <em>wody.com.ar/mi-gym</em>)<br />
            · Subir tu logo y elegir tu color de marca<br />
            · Crear tu usuario administrador con contraseña
          </Text>

          <Section style={{ textAlign: "center", margin: "0 0 24px 0" }}>
            <Button
              href={onboardingUrl}
              style={{
                backgroundColor: "#E31414",
                color: "#ffffff",
                padding: "12px 28px",
                borderRadius: "6px",
                fontWeight: "600",
                fontSize: "15px",
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              Completar registro
            </Button>
          </Section>

          <Text style={{ fontSize: "13px", color: "#71717a", margin: "0 0 8px 0" }}>
            Este link expira el <strong>{formatDate(tokenExpiresAt)}</strong>. Si no lo usás antes de esa fecha, contactanos para renovarlo.
          </Text>

          <Text style={{ fontSize: "13px", color: "#71717a", margin: "0 0 24px 0" }}>
            Si el botón no funciona, copiá y pegá esta URL: {onboardingUrl}
          </Text>

          <Hr style={{ borderColor: "#e4e4e7", margin: "0 0 16px 0" }} />

          <Text
            style={{
              fontSize: "12px",
              color: "#71717a",
              margin: "0",
              lineHeight: "1.5",
              textAlign: "center",
            }}
          >
            Wody · Este es un mail automático, no respondas a esta dirección.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
