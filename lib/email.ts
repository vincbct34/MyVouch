/**
 * Email sending via Resend.
 *
 * Resolution order:
 *   1. RESEND_API_KEY        → Resend REST API (zero extra deps, uses fetch)
 *   2. unset, development    → log the message to the console (no-op send)
 *   3. unset, production     → throw (fail fast; verification email is required)
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

export async function sendMail(mail: Mail): Promise<void> {
  if (process.env.RESEND_API_KEY) {
    return sendViaResend(mail, process.env.RESEND_API_KEY);
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "No email provider configured. Set RESEND_API_KEY in production.",
    );
  }
  // Development fallback: surface the message (incl. confirmation link) in logs.
  console.info(
    `\n[email:dev] To: ${mail.to}\n[email:dev] Subject: ${mail.subject}\n[email:dev] ${mail.text}\n`,
  );
}
