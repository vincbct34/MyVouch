"use client";

import { useState } from "react";
import { useT, useLocale } from "./I18nProvider";
import { formatDate } from "@/lib/ui";

export interface ApiTokenView {
  id: number;
  name: string;
  last_used_at: string | null;
  created_at: string;
}

type Note = { kind: "ok" | "err"; text: string } | null;

/**
 * Owner self-service for personal API tokens. The raw token is shown exactly
 * once (right after creation, held in local state only) — after a refresh the
 * server can only return metadata, never the secret.
 */
export function ApiTokens({ initial }: { initial: ApiTokenView[] }) {
  const m = useT().account;
  const locale = useLocale();

  const [tokens, setTokens] = useState<ApiTokenView[]>(initial);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);
  // The one-time raw token to surface after a successful create.
  const [fresh, setFresh] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    setFresh(null);
    setCopied(false);
    const res = await fetch("/api/account/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setNote({ kind: "err", text: json.error ?? m.tokenCreateFail });
      return;
    }
    setFresh(json.token);
    setTokens((t) => [
      {
        id: json.id,
        name: json.name,
        last_used_at: null,
        created_at: new Date().toISOString(),
      },
      ...t,
    ]);
    setName("");
  }

  async function copy() {
    if (!fresh) return;
    try {
      await navigator.clipboard.writeText(fresh);
      setCopied(true);
    } catch {
      /* clipboard may be unavailable; the token is still shown for manual copy */
    }
  }

  async function revoke(id: number) {
    setNote(null);
    const res = await fetch(`/api/account/tokens/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setNote({ kind: "err", text: json.error ?? m.tokenRevokeFail });
      return;
    }
    setTokens((t) => t.filter((x) => x.id !== id));
  }

  return (
    <section className="account-card">
      <h2>{m.tokensTitle}</h2>
      <p className="hint">{m.tokensIntro}</p>

      <form className="settings-form" onSubmit={create}>
        <div className="field">
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder={m.tokenNamePlaceholder}
            aria-label={m.tokenNamePlaceholder}
          />
        </div>
        <div className="settings-actions">
          <button className="btn btn-primary btn-sm" disabled={busy}>
            {busy ? m.tokenCreating : m.tokenCreate}
          </button>
          {note && (
            <span
              className="settings-msg"
              style={{
                color:
                  note.kind === "err" ? "var(--rose-deep, #b4232a)" : undefined,
              }}
            >
              {note.text}
            </span>
          )}
        </div>
      </form>

      {fresh && (
        <div className="token-reveal">
          <p className="hint">{m.tokenCopyHint}</p>
          <div className="settings-actions">
            <code className="token-value">{fresh}</code>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={copy}
            >
              {copied ? m.tokenCopied : m.tokenCopy}
            </button>
          </div>
        </div>
      )}

      {tokens.length === 0 ? (
        <p className="sub">{m.tokensEmpty}</p>
      ) : (
        <ul className="token-list">
          {tokens.map((t) => (
            <li key={t.id} className="token-item">
              <div className="token-meta">
                <span className="token-name">{t.name}</span>
                <span className="sub">
                  {m.tokenCreatedAt(formatDate(t.created_at, locale))} ·{" "}
                  {t.last_used_at
                    ? m.tokenLastUsed(formatDate(t.last_used_at, locale))
                    : m.tokenNeverUsed}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-rose btn-sm"
                onClick={() => revoke(t.id)}
              >
                {m.tokenRevoke}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
