import {
  Button,
  Heading,
  Section,
  Text,
} from "@react-email/components";
import React from "react";
import type { GymKind } from "@prisma/client";
import { EmailLayout, DEFAULT_PRIMARY_COLOR } from "./EmailLayout";
import { vocab } from "../vocab";

interface InviteEmailProps {
  gym: { name: string; primaryColor: string | null; logo: string | null; kind: GymKind };
  recipientName: string;
  activationUrl: string;
  expiresAt: Date;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function InviteEmail({ gym, recipientName, activationUrl, expiresAt }: InviteEmailProps) {
  const v = vocab(gym.kind);
  const primaryColor = gym.primaryColor ?? DEFAULT_PRIMARY_COLOR;

  return (
    <EmailLayout gym={gym} preview={`Activá tu cuenta en ${gym.name}`}>
      <Heading
        style={{
          fontSize: "22px",
          fontWeight: "700",
          margin: "16px 0 16px 0",
          color: "#18181b",
        }}
      >
        ¡Bienvenido/a {recipientName}!
      </Heading>

      <Text style={{ fontSize: "15px", color: "#3f3f46", lineHeight: "1.6", margin: "0 0 12px 0" }}>
        Te invitamos a unirte a {gym.name}, donde vas a poder llevar el seguimiento de tus{" "}
        {v.workoutWordPlural} y tus {v.recordWord}.
      </Text>

      <Text style={{ fontSize: "15px", color: "#3f3f46", lineHeight: "1.6", margin: "0 0 24px 0" }}>
        Para empezar, activá tu cuenta haciendo click en el botón de abajo y definí tu contraseña.
      </Text>

      <Section style={{ textAlign: "center", margin: "0 0 24px 0" }}>
        <Button
          href={activationUrl}
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
          Activar mi cuenta
        </Button>
      </Section>

      <Text style={{ fontSize: "13px", color: "#71717a", margin: "0 0 8px 0" }}>
        Este link expira el {formatDate(expiresAt)}.
      </Text>

      <Text style={{ fontSize: "13px", color: "#71717a", margin: "0" }}>
        Si el botón no funciona, copiá y pegá esta URL: {activationUrl}
      </Text>
    </EmailLayout>
  );
}
