/**
 * Email sending with a thin provider abstraction.
 *
 * Resolution order:
 *   1. RESEND_API_KEY        → Resend REST API (zero extra deps, uses fetch)
 *   2. SMTP_HOST + creds     → nodemailer (optional dependency, dynamically imported)
 *   3. neither, development  → log the message to the console (no-op send)
 *   4. neither, production   → throw (fail fast; verification email is required)
 */

export interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

function from(): string {
  return process.env.EMAIL_FROM || "Vouch <no-reply@vouch.app>";
}

async function sendViaResend(mail: Mail, apiKey: string): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: from(),
      to: [mail.to],
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend send failed (${res.status}): ${detail}`);
  }
}

async function sendViaSmtp(mail: Mail): Promise<void> {
  // Dynamic, non-literal specifier so the optional dependency isn't required at
  // type-check / bundle time. Install with `npm i nodemailer` to use SMTP.
  const specifier = "nodemailer";
  let nodemailer: {
    createTransport: (opts: unknown) => {
      sendMail: (msg: unknown) => Promise<unknown>;
    };
  };
  try {
    nodemailer = (await import(specifier)) as typeof nodemailer;
  } catch {
    throw new Error(
      "SMTP_HOST is set but 'nodemailer' is not installed. Run `npm i nodemailer`.",
    );
  }
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth:
      process.env.SMTP_USER || process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });
  await transport.sendMail({
    from: from(),
    to: mail.to,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  });
}

export async function sendMail(mail: Mail): Promise<void> {
  if (process.env.RESEND_API_KEY) {
    return sendViaResend(mail, process.env.RESEND_API_KEY);
  }
  if (process.env.SMTP_HOST) {
    return sendViaSmtp(mail);
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "No email provider configured. Set RESEND_API_KEY or SMTP_HOST in production.",
    );
  }
  // Development fallback: surface the message (incl. confirmation link) in logs.
  console.info(
    `\n[email:dev] To: ${mail.to}\n[email:dev] Subject: ${mail.subject}\n[email:dev] ${mail.text}\n`,
  );
}
