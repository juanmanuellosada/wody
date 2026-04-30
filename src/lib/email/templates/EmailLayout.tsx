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
import type { GymKind } from "@prisma/client";

export const DEFAULT_PRIMARY_COLOR = "#E31414";

interface EmailLayoutProps {
  gym: { name: string; primaryColor: string | null; logo: string | null; kind: GymKind };
  preview: string;
  children: React.ReactNode;
}

export function EmailLayout({ gym, preview, children }: EmailLayoutProps) {
  return (
    <Html lang="es">
      <Head />
      <Preview>{preview}</Preview>
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
          {/* Header */}
          {gym.logo ? (
            <Img src={gym.logo} alt={gym.name} height={48} />
          ) : (
            <Heading
              style={{
                fontSize: "24px",
                fontWeight: "700",
                margin: "0 0 24px 0",
                color: "#18181b",
              }}
            >
              {gym.name}
            </Heading>
          )}

          {/* Content slot */}
          {children}

          {/* Footer */}
          <Hr style={{ borderColor: "#e4e4e7", margin: "32px 0 16px 0" }} />
          <Text
            style={{
              fontSize: "12px",
              color: "#71717a",
              margin: "0",
              lineHeight: "1.5",
            }}
          >
            {gym.name} · Este es un mail automático, no respondas a esta dirección. Si no esperabas este mensaje, ignoralo.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
