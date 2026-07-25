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

interface PaymentDueGymEmailProps {
  contactName: string;
  gymName: string;
  dueDate: Date;
  daysRemaining: number;
  /** En centavos — se divide por 100 al renderizar. */
  monthlyAmount: number;
  gymBillingUrl: string;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatAmount(monthlyAmountCentavos: number): string {
  return new Intl.NumberFormat("es-AR").format(Math.round(monthlyAmountCentavos / 100));
}

export function gymDueSubject(daysRemaining: number): string {
  return daysRemaining <= 0 ? "Tu cuota de Wody vence hoy" : "Tu cuota de Wody vence en 2 días";
}

export function PaymentDueGymEmail({
  contactName,
  gymName,
  dueDate,
  daysRemaining,
  monthlyAmount,
  gymBillingUrl,
}: PaymentDueGymEmailProps) {
  // Forzamos el host canónico (www.) para los assets del mail. wody.com.ar redirige 307
  // a www.wody.com.ar, y Gmail/Outlook no siguen redirects en <img>, lo que rompe el render.
  const baseUrl = process.env.APP_URL ?? "https://www.wody.com.ar";
  const assetBaseUrl = baseUrl.replace("://wody.com.ar", "://www.wody.com.ar");
  const wodyLogoUrl = `${assetBaseUrl}/logos/wody-negro.png`;
  const subject = gymDueSubject(daysRemaining);

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
            Hola {contactName}, la cuota de {gymName} vence el {formatDate(dueDate)}.
          </Text>

          <Text style={{ fontSize: "15px", color: "#3f3f46", lineHeight: "1.6", margin: "0 0 24px 0" }}>
            El monto es de ${formatAmount(monthlyAmount)}. Renovala a tiempo para que tu gimnasio siga funcionando sin interrupciones.
          </Text>

          <Section style={{ textAlign: "center", margin: "0 0 24px 0" }}>
            <Button
              href={gymBillingUrl}
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
