import {
  Button,
  Heading,
  Section,
  Text,
} from "@react-email/components";
import React from "react";
import type { GymKind } from "@prisma/client";
import { EmailLayout, DEFAULT_PRIMARY_COLOR } from "./EmailLayout";

interface JoinApprovedEmailProps {
  gym: { name: string; primaryColor: string | null; logo: string | null; kind: GymKind };
  recipientName: string;
  loginUrl: string;
  installUrl: string;
}

export function JoinApprovedEmail({ gym, recipientName, loginUrl, installUrl }: JoinApprovedEmailProps) {
  const primaryColor = gym.primaryColor ?? DEFAULT_PRIMARY_COLOR;

  return (
    <EmailLayout gym={gym} preview={`Tu cuenta en ${gym.name} fue aprobada`}>
      <Heading
        style={{
          fontSize: "22px",
          fontWeight: "700",
          margin: "16px 0 16px 0",
          color: "#18181b",
        }}
      >
        ¡Tu cuenta fue aprobada!
      </Heading>

      <Text style={{ fontSize: "15px", color: "#3f3f46", lineHeight: "1.6", margin: "0 0 24px 0" }}>
        Hola {recipientName}, el admin de {gym.name} aprobó tu solicitud. Ya podés ingresar con la contraseña que elegiste cuando te registraste.
      </Text>

      <Section style={{ textAlign: "center", margin: "0 0 12px 0" }}>
        <Button
          href={loginUrl}
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
          Ingresar a {gym.name}
        </Button>
      </Section>

      <Section style={{ textAlign: "center", margin: "0 0 24px 0" }}>
        <Button
          href={installUrl}
          style={{
            backgroundColor: "transparent",
            color: primaryColor,
            padding: "10px 24px",
            borderRadius: "6px",
            fontWeight: "600",
            fontSize: "14px",
            textDecoration: "none",
            display: "inline-block",
            border: `1.5px solid ${primaryColor}`,
          }}
        >
          Instalar la app
        </Button>
      </Section>

      <Text style={{ fontSize: "13px", color: "#71717a", margin: "0 0 8px 0" }}>
        Si olvidaste tu contraseña, en el login podés usar &ldquo;Olvidé mi contraseña&rdquo; para resetearla.
      </Text>

      <Text style={{ fontSize: "13px", color: "#71717a", margin: "0" }}>
        Si el botón no funciona, copiá y pegá esta URL: {loginUrl}
      </Text>
    </EmailLayout>
  );
}
