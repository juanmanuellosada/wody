import { Resend } from "resend";

const globalForResend = globalThis as unknown as {
  resend: Resend | undefined;
};

export function getResendClient(): Resend {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("EMAIL_NOT_CONFIGURED: RESEND_API_KEY no está configurada");
  }

  if (!globalForResend.resend) {
    globalForResend.resend = new Resend(process.env.RESEND_API_KEY);
  }

  return globalForResend.resend;
}
