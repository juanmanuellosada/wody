import nodemailer, { type Transporter } from "nodemailer";

const globalForMailer = globalThis as unknown as {
  mailer: Transporter | undefined;
};

/**
 * Transporte SMTP. En producción apunta al servidor de mail propio; en local,
 * a Mailpit (docker-compose.yml), que captura los mails sin enviarlos.
 *
 * SMTP_SECURE=true usa TLS directo (puerto 465). Si no, se conecta en claro y
 * sube a TLS con STARTTLS cuando el servidor lo ofrece (puerto 587).
 */
export function getMailer(): Transporter {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;

  if (!SMTP_HOST) {
    throw new Error("EMAIL_NOT_CONFIGURED: SMTP_HOST no está configurada");
  }

  if (!globalForMailer.mailer) {
    const secure = SMTP_SECURE === "true";
    globalForMailer.mailer = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT ? parseInt(SMTP_PORT, 10) : secure ? 465 : 587,
      secure,
      ...(SMTP_USER ? { auth: { user: SMTP_USER, pass: SMTP_PASS ?? "" } } : {}),
    });
  }

  return globalForMailer.mailer;
}
