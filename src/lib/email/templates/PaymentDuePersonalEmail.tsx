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

interface PaymentDuePersonalEmailProps {
  contactName: string;
  dueDate: Date;
  daysRemaining: number;
  personalBillingUrl: string;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function personalDueSubject(daysRemaining: number): string {
  return daysRemaining <= 0
    ? "Tu cuota de Wody Personal vence hoy"
    : "Tu cuota de Wody Personal vence en 2 días";
}

export function PaymentDuePersonalEmail({
  contactName,
  dueDate,
  daysRemaining,
  personalBillingUrl,
}: PaymentDuePersonalEmailProps) {
  // Forzamos el host canónico (www.) para los assets del mail. wody.com.ar redirige 307
  // a www.wody.com.ar, y Gmail/Outlook no siguen redirects en <img>, lo que rompe el render.
  const baseUrl = process.env.APP_URL ?? "https://www.wody.com.ar";
  const assetBaseUrl = baseUrl.replace("://wody.com.ar", "://www.wody.com.ar");
  const wodyLogoUrl = `${assetBaseUrl}/logos/wody-negro.png`;
  const subject = personalDueSubject(daysRemaining);

  return (
    <Html lang="es">
      <Head />
      <Preview>{subject}</Preview>
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
            {subject}
          </Heading>

          <Text style={{ fontSize: "15px", color: "#3f3f46", lineHeight: "1.6", margin: "0 0 12px 0" }}>
            Hola {contactName}, tu cuota de Wody Personal vence el {formatDate(dueDate)}.
          </Text>

          <Text style={{ fontSize: "15px", color: "#3f3f46", lineHeight: "1.6", margin: "0 0 24px 0" }}>
            Renovala a tiempo para no perder acceso a tus rutinas y tus PRs.
          </Text>

          <Section style={{ textAlign: "center", margin: "0 0 24px 0" }}>
            <Button
              href={personalBillingUrl}
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
              Ver mi suscripción
            </Button>
          </Section>

          <Text style={{ fontSize: "13px", color: "#71717a", margin: "0 0 24px 0" }}>
            Si ya la abonaste, ignorá este mensaje.
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
