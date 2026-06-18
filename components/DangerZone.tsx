"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "./I18nProvider";

/**
 * Irreversible account deletion. Double-guarded UI to match the API: the owner
 * must enter their password AND type their public slug exactly before the button
 * arms. Mirrors POST /api/account/delete.
 */
export function DangerZone({ slug }: { slug: string }) {
  const m = useT().account;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const armed = password.length > 0 && confirm === slug;

  async function onDelete(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!armed) return;
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, confirm }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setBusy(false);
      setErr(json.error ?? m.deleteFail);
      return;
    }
    // Account gone, session cookie cleared by the route. Leave the app.
    router.push("/");
    router.refresh();
  }

  return (
    <section className="account-card danger-zone">
      <h2>{m.dangerTitle}</h2>
      <p className="hint">{m.dangerWarning}</p>

      {!open ? (
        <div className="settings-actions">
          <button
            type="button"
            className="btn btn-rose btn-sm"
            onClick={() => setOpen(true)}
          >
            {m.delete}
          </button>
        </div>
      ) : (
        <form className="settings-form" onSubmit={onDelete}>
          <div className="field">
            <label htmlFor="delete_password">{m.dangerPassword}</label>
            <input
              className="input"
              id="delete_password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="delete_confirm">{m.dangerConfirmLabel(slug)}</label>
            <input
              className="input"
              id="delete_confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={slug}
              autoComplete="off"
              required
            />
          </div>
          <div className="settings-actions">
            <button className="btn btn-rose btn-sm" disabled={!armed || busy}>
              {busy ? m.deleting : m.deleteConfirm}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              {m.cancel}
            </button>
            {err && (
              <span
                className="settings-msg"
                style={{ color: "var(--rose-deep, #b4232a)" }}
              >
                {err}
              </span>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
