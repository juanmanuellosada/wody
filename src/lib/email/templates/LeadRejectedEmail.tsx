import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Text,
} from "@react-email/components";
import React from "react";

interface LeadRejectedEmailProps {
  contactName: string;
  gymName: string;
  rejectionReason?: string | null;
}

export function LeadRejectedEmail({ contactName, gymName, rejectionReason }: LeadRejectedEmailProps) {
  const baseUrl = process.env.APP_URL ?? "https://www.wody.com.ar";
  const assetBaseUrl = baseUrl.replace("://wody.com.ar", "://www.wody.com.ar");
  const wodyLogoUrl = `${assetBaseUrl}/logos/wody-negro.png`;

  return (
    <Html lang="es">
      <Head />
      <Preview>Respuesta sobre tu solicitud en Wody</Preview>
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
            Hola {contactName}
          </Heading>

          <Text style={{ fontSize: "15px", color: "#3f3f46", lineHeight: "1.6", margin: "0 0 12px 0" }}>
            Gracias por tu interés en sumar <strong>{gymName}</strong> a Wody. Luego de revisar tu solicitud, por el momento no podemos avanzar con el alta.
          </Text>

          {rejectionReason && (
            <Text style={{ fontSize: "15px", color: "#3f3f46", lineHeight: "1.6", margin: "0 0 12px 0" }}>
              {rejectionReason}
            </Text>
          )}

          <Text style={{ fontSize: "15px", color: "#3f3f46", lineHeight: "1.6", margin: "0 0 24px 0" }}>
            Si tenés preguntas o querés más información, podés escribirnos directamente.
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
