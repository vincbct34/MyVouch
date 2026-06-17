/**
 * Durable, retryable email delivery on top of lib/email.ts.
 *
 * Why: the confirmation/verification link is the spine of the trust model, but
 * sending happens out of the request path (fire-and-forget). A provider blip
 * there used to silently drop the link with no second chance. enqueueMail()
 * persists the message first, then attempts an immediate send; a periodic sweep
 * retries anything still unsent (failed or never picked up) until it succeeds or
 * hits MAX_ATTEMPTS. Single-process, no broker — the deliberate scaling ceiling.
 */

import {
  enqueueOutbox,
  pendingOutbox,
  markOutboxSent,
  markOutboxFailed,
} from "./db";
import { sendMail, type Mail } from "./email";

const MAX_ATTEMPTS = 6;
const SWEEP_BATCH = 20;

async function deliver(row: {
  id: number;
  recipient: string;
  subject: string;
  html: string;
  body_text: string;
}): Promise<void> {
  try {
    await sendMail({
      to: row.recipient,
      subject: row.subject,
      html: row.html,
      text: row.body_text,
    });
    markOutboxSent(row.id);
  } catch (err) {
    markOutboxFailed(row.id, err instanceof Error ? err.message : String(err));
    console.error(`[outbox] send failed for #${row.id}:`, err);
  }
}

/**
 * Persist a mail and kick off an immediate (background) delivery attempt. Safe to
 * call from a request handler: it returns as soon as the row is durably stored,
 * so the response never waits on the email provider, and a crash/failure leaves
 * the row for the sweep to retry.
 */
export function enqueueMail(mail: Mail): void {
  const id = enqueueOutbox({
    recipient: mail.to,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  });
  void deliver({
    id,
    recipient: mail.to,
    subject: mail.subject,
    html: mail.html,
    body_text: mail.text,
  });
}

let sweeping = false;

/** Retry a batch of unsent mail. Re-entrancy-guarded so overlapping ticks no-op. */
export async function sweepOutbox(): Promise<void> {
  if (sweeping) return;
  sweeping = true;
  try {
    const rows = pendingOutbox(MAX_ATTEMPTS, SWEEP_BATCH);
    for (const row of rows) await deliver(row);
  } finally {
    sweeping = false;
  }
}

// Background retry loop. Skipped under test (no provider, throwaway DB) and kept
// from holding the event loop open on its own.
if (typeof setInterval !== "undefined" && process.env.NODE_ENV !== "test") {
  const timer = setInterval(() => {
    void sweepOutbox();
  }, 60_000);
  (timer as { unref?: () => void }).unref?.();
}
