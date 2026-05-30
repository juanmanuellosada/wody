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

interface PersonalLeadApprovedEmailProps {
  contactName: string;
  registroUrl: string;
}

export function PersonalLeadApprovedEmail({
  contactName,
  registroUrl,
}: PersonalLeadApprovedEmailProps) {
  const baseUrl = process.env.APP_URL ?? "https://www.wody.com.ar";
  const assetBaseUrl = baseUrl.replace("://wody.com.ar", "://www.wody.com.ar");
  const wodyLogoUrl = `${assetBaseUrl}/logos/wody-negro.png`;

  return (
    <Html lang="es">
      <Head />
      <Preview>Estás dentro de Wody Personal — completá tu registro</Preview>
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
            ¡{contactName}, estás dentro!
          </Heading>

          <Text style={{ fontSize: "15px", color: "#3f3f46", lineHeight: "1.6", margin: "0 0 12px 0" }}>
            Tu solicitud para usar Wody Personal fue aprobada. Ya podés completar tu registro y empezar a entrenar.
          </Text>

          <Text style={{ fontSize: "15px", color: "#3f3f46", lineHeight: "1.6", margin: "0 0 24px 0" }}>
            Vas a tener <strong>30 días gratis</strong> para probar la app sin necesidad de tarjeta.
          </Text>

          <Section style={{ textAlign: "center", margin: "0 0 24px 0" }}>
            <Button
              href={registroUrl}
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

          <Text style={{ fontSize: "13px", color: "#71717a", margin: "0 0 24px 0" }}>
            Si el botón no funciona, copiá y pegá esta URL: {registroUrl}
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
