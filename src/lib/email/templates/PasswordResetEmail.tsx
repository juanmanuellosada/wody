import {
  Button,
  Heading,
  Section,
  Text,
} from "@react-email/components";
import React from "react";
import type { GymKind } from "@prisma/client";
import { EmailLayout, DEFAULT_PRIMARY_COLOR } from "./EmailLayout";

interface PasswordResetEmailProps {
  gym: { name: string; primaryColor: string | null; logo: string | null; kind: GymKind };
  recipientName: string;
  resetUrl: string;
  expiresAt: Date;
}

function formatDateWithTime(date: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function PasswordResetEmail({ gym, recipientName, resetUrl, expiresAt }: PasswordResetEmailProps) {
  const primaryColor = gym.primaryColor ?? DEFAULT_PRIMARY_COLOR;

  return (
    <EmailLayout gym={gym} preview={`Restablecé tu contraseña en ${gym.name}`}>
      <Heading
        style={{
          fontSize: "22px",
          fontWeight: "700",
          margin: "16px 0 16px 0",
          color: "#18181b",
        }}
      >
        Restablecé tu contraseña
      </Heading>

      <Text style={{ fontSize: "15px", color: "#3f3f46", lineHeight: "1.6", margin: "0 0 12px 0" }}>
        Hola {recipientName}, recibimos un pedido para cambiar tu contraseña en {gym.name}.
      </Text>

      <Text style={{ fontSize: "15px", color: "#3f3f46", lineHeight: "1.6", margin: "0 0 24px 0" }}>
        Si fuiste vos, hacé click en el botón. Si no, ignorá este mail — tu contraseña actual sigue siendo válida.
      </Text>

      <Section style={{ textAlign: "center", margin: "0 0 24px 0" }}>
        <Button
          href={resetUrl}
          style={{
            backgroundColor: primaryColor,
            color: "#ffffff",
            padding: "12px 24px",
            borderRadius: "6px",
            fontWeight: "600",
            fontSize: "15px",
            textDecoration: "none",
            display: "inline-block",
          }}
        >
          Cambiar mi contraseña
        </Button>
      </Section>

      <Text style={{ fontSize: "13px", color: "#71717a", margin: "0 0 8px 0" }}>
        Este link expira el {formatDateWithTime(expiresAt)}.
      </Text>

      <Text style={{ fontSize: "13px", color: "#71717a", margin: "0" }}>
        Si el botón no funciona, copiá y pegá esta URL: {resetUrl}
      </Text>
    </EmailLayout>
  );
}
