import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";
import React from "react";

interface QuotaAlertEmailProps {
  threshold: 80 | 95;
  currentCount: number;
  monthlyLimit: number;
  monthLabel: string;
}

export function QuotaAlertEmail({ threshold, currentCount, monthlyLimit, monthLabel }: QuotaAlertEmailProps) {
  const actionText =
    threshold === 80
      ? "Considerá monitorear más seguido o preparar el upgrade del plan."
      : "Estás por tocar el tope. Subí el plan o pausá el flujo (`EMAIL_FLOW_ENABLED=false`).";

  return (
    <Html lang="es">
      <Head />
      <Preview>{`Cuota Resend al ${threshold}% — ${monthLabel}`}</Preview>
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
          <Text
            style={{
              fontSize: "14px",
              fontWeight: "700",
              color: "#E31414",
              margin: "0 0 16px 0",
              letterSpacing: "0.02em",
            }}
          >
            Wody · Alerta de cuota
          </Text>

          <Heading
            style={{
              fontSize: "22px",
              fontWeight: "700",
              margin: "0 0 16px 0",
              color: "#18181b",
            }}
          >
            Cuota mensual al {threshold}%
          </Heading>

          <Text style={{ fontSize: "15px", color: "#3f3f46", lineHeight: "1.6", margin: "0 0 12px 0" }}>
            El uso de Resend para {monthLabel} alcanzó el {threshold}% del límite.
          </Text>

          <Text style={{ fontSize: "15px", color: "#3f3f46", lineHeight: "1.6", margin: "0 0 12px 0" }}>
            Enviados: {currentCount} / {monthlyLimit}
          </Text>

          <Text style={{ fontSize: "15px", color: "#3f3f46", lineHeight: "1.6", margin: "0 0 24px 0" }}>
            {actionText}
          </Text>

          <Text style={{ fontSize: "12px", color: "#71717a", margin: "0" }}>
            Runbook: docs/emails-resend.md
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
