import { render } from "@react-email/render";
import type { EmailLogType } from "@prisma/client";
import React from "react";
import { getMailer } from "@/lib/email/client";
import { prisma } from "@/lib/prisma";

interface SendEmailOptions {
  to: string;
  gymId?: string | null;
  type: EmailLogType;
  subject: string;
  react: React.ReactElement;
  replyTo?: string;
}

export async function sendEmail(
  options: SendEmailOptions
): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  const { to, gymId, type, subject, react, replyTo } = options;

  // Validate env vars before touching SMTP. If missing: log, no EmailLog row, return failure.
  if (!process.env.SMTP_HOST || !process.env.EMAIL_FROM) {
    console.error("[email] EMAIL_NOT_CONFIGURED");
    return { ok: false, error: "EMAIL_NOT_CONFIGURED" };
  }

  const from = process.env.EMAIL_FROM;
  const resolvedReplyTo =
    replyTo ?? process.env.EMAIL_REPLY_TO ?? undefined;

  let html: string;
  let text: string;
  try {
    html = await render(react);
    text = await render(react, { plainText: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email] render error:", message);
    return { ok: false, error: "EMAIL_NOT_CONFIGURED" };
  }

  try {
    const info = await getMailer().sendMail({
      from,
      to,
      subject,
      html,
      text,
      ...(resolvedReplyTo ? { replyTo: resolvedReplyTo } : {}),
    });

    // The SMTP Message-ID goes into the `resendId` column (named after the
    // previous provider; renaming it needs a migration).
    const messageId = info.messageId;
    await prisma.emailLog.create({
      data: { to, gymId: gymId ?? null, type, resendId: messageId, status: "SENT", errorMessage: null },
    });
    return { ok: true, messageId };
  } catch (err) {
    // EMAIL_NOT_CONFIGURED re-throws from getMailer — no EmailLog row.
    if (err instanceof Error && err.message.startsWith("EMAIL_NOT_CONFIGURED")) {
      console.error("[email] EMAIL_NOT_CONFIGURED");
      return { ok: false, error: "EMAIL_NOT_CONFIGURED" };
    }

    const errorMessage = (err instanceof Error ? err.message : String(err)).slice(0, 500);
    await prisma.emailLog.create({
      data: { to, gymId: gymId ?? null, type, resendId: null, status: "FAILED", errorMessage },
    });
    return { ok: false, error: errorMessage };
  }
}
