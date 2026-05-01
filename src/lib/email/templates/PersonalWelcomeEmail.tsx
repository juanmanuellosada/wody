import {
  Button,
  Heading,
  Hr,
  Section,
  Text,
} from "@react-email/components";
import React from "react";
import type { GymKind } from "@prisma/client";
import { EmailLayout, DEFAULT_PRIMARY_COLOR } from "./EmailLayout";

interface PersonalWelcomeEmailProps {
  recipientName: string;
  confirmUrl: string;
  registerUrl: string;
}

// Minimal gym shape for the layout — the personal tenant doesn't have a logo
// or custom color, so we use fixed values.
const PERSONAL_GYM: { name: string; primaryColor: string | null; logo: string | null; kind: GymKind } = {
  name: "Wody Personal",
  primaryColor: DEFAULT_PRIMARY_COLOR,
  logo: null,
  kind: "PERSONAL",
};

export function PersonalWelcomeEmail({
  recipientName,
  confirmUrl,
  registerUrl,
}: PersonalWelcomeEmailProps) {
  const primaryColor = DEFAULT_PRIMARY_COLOR;

  return (
    <EmailLayout gym={PERSONAL_GYM} preview="Confirmá tu cuenta de Wody Personal">
      <Heading
        style={{
          fontSize: "22px",
          fontWeight: "700",
          margin: "16px 0 16px 0",
          color: "#18181b",
        }}
      >
        ¡Bienvenido/a a Wody Personal!
      </Heading>

      <Text style={{ fontSize: "15px", color: "#3f3f46", lineHeight: "1.6", margin: "0 0 12px 0" }}>
        Hola {recipientName},
      </Text>

      <Text style={{ fontSize: "15px", color: "#3f3f46", lineHeight: "1.6", margin: "0 0 12px 0" }}>
        Te damos la bienvenida a Wody Personal — la versión de Wody para entrenar por tu cuenta, llevar tus rutinas y récords sin pertenecer a un gimnasio.
      </Text>

      <Text style={{ fontSize: "15px", color: "#3f3f46", lineHeight: "1.6", margin: "0 0 24px 0" }}>
        Para activar tu cuenta hacé click en el siguiente link:
      </Text>

      <Section style={{ textAlign: "center", margin: "0 0 24px 0" }}>
        <Button
          href={confirmUrl}
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
          Confirmar mi cuenta
        </Button>
      </Section>

      <Text style={{ fontSize: "13px", color: "#71717a", margin: "0 0 8px 0" }}>
        El link es válido por 48 horas. Si expiró o tenés problemas, podés volver a registrarte en{" "}
        <a href={registerUrl} style={{ color: primaryColor }}>{registerUrl}</a> con el mismo email.
      </Text>

      <Hr style={{ borderColor: "#e4e4e7", margin: "20px 0" }} />

      <Text style={{ fontSize: "14px", color: "#3f3f46", lineHeight: "1.6", margin: "0 0 8px 0" }}>
        Una vez confirmada la cuenta vas a poder:
      </Text>

      <Text style={{ fontSize: "14px", color: "#3f3f46", lineHeight: "1.6", margin: "0 0 4px 0" }}>
        • Crear y editar tus propias rutinas (WODs).
      </Text>
      <Text style={{ fontSize: "14px", color: "#3f3f46", lineHeight: "1.6", margin: "0 0 4px 0" }}>
        • Registrar tus récords personales (PRs/RMs).
      </Text>
      <Text style={{ fontSize: "14px", color: "#3f3f46", lineHeight: "1.6", margin: "0 0 24px 0" }}>
        • Usar los cronómetros para tus entrenamientos.
      </Text>

      <Text style={{ fontSize: "13px", color: "#71717a", margin: "0 0 8px 0" }}>
        Si no fuiste vos quien se registró, ignorá este mail.
      </Text>

      <Text style={{ fontSize: "13px", color: "#71717a", margin: "0 0 8px 0" }}>
        Si el botón no funciona, copiá y pegá esta URL: {confirmUrl}
      </Text>

      <Text style={{ fontSize: "14px", color: "#3f3f46", margin: "0" }}>
        ¡A entrenar!{"\n"}El equipo de Wody
      </Text>
    </EmailLayout>
  );
}
