import { Heading, Text } from "@react-email/components";
import React from "react";
import type { GymKind } from "@prisma/client";
import { EmailLayout } from "./EmailLayout";
import { gymTerms } from "@/lib/gym-terms";

interface PaymentDueStudentEmailProps {
  gym: { name: string; primaryColor: string | null; logo: string | null; kind: GymKind };
  recipientName: string;
  dueDate: Date;
  daysRemaining: number;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function studentDueSubject(daysRemaining: number): string {
  return daysRemaining <= 0 ? "Tu cuota vence hoy" : "Tu cuota vence en 2 días";
}

export function PaymentDueStudentEmail({
  gym,
  recipientName,
  dueDate,
  daysRemaining,
}: PaymentDueStudentEmailProps) {
  const kindWord = gymTerms(gym.kind).kindWord;
  const subject = studentDueSubject(daysRemaining);

  return (
    <EmailLayout gym={gym} preview={subject}>
      <Heading
        style={{
          fontSize: "22px",
          fontWeight: "700",
          margin: "16px 0 16px 0",
          color: "#18181b",
        }}
      >
        {subject}
      </Heading>

      <Text style={{ fontSize: "15px", color: "#3f3f46", lineHeight: "1.6", margin: "0 0 12px 0" }}>
        Hola {recipientName}, tu cuota de {gym.name} vence el {formatDate(dueDate)}.
      </Text>

      <Text style={{ fontSize: "15px", color: "#3f3f46", lineHeight: "1.6", margin: "0 0 24px 0" }}>
        Pasá por tu {kindWord} para renovarla y seguir entrenando sin interrupciones.
      </Text>

      <Text style={{ fontSize: "13px", color: "#71717a", margin: "0" }}>
        Si ya la abonaste, ignorá este mensaje.
      </Text>
    </EmailLayout>
  );
}
