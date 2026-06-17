"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SecuritySettings() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );
  const [loggingOut, setLoggingOut] = useState(false);

  async function changePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const next = String(fd.get("new_password") ?? "");
    const confirm = String(fd.get("confirm_password") ?? "");
    if (next !== confirm) {
      setMsg({ kind: "err", text: "New passwords don’t match." });
      return;
    }
    setBusy(true);
    const res = await fetch("/api/auth/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        current_password: fd.get("current_password"),
        new_password: next,
      }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg({ kind: "err", text: json.error ?? "Couldn’t change password." });
      return;
    }
    form.reset();
    setMsg({
      kind: "ok",
      text: "Password changed. Other devices have been signed out.",
    });
  }

  async function logoutEverywhere() {
    setLoggingOut(true);
    const res = await fetch("/api/auth/logout-all", { method: "POST" });
    if (!res.ok) {
      setLoggingOut(false);
      setMsg({ kind: "err", text: "Couldn’t sign out. Try again." });
      return;
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <details className="profile-settings">
      <summary className="btn btn-ghost btn-sm">Security</summary>
      <div className="settings-form">
        <form
          className="settings-form"
          style={{ border: 0, padding: 0, margin: 0 }}
          onSubmit={changePassword}
        >
          <div className="field">
            <label htmlFor="current_password">Current password</label>
            <input
              className="input"
              id="current_password"
              name="current_password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="new_password">New password</label>
            <input
              className="input"
              id="new_password"
              name="new_password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="confirm_password">Confirm new password</label>
            <input
              className="input"
              id="confirm_password"
              name="confirm_password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <div className="settings-actions">
            <button className="btn btn-primary btn-sm" disabled={busy}>
              {busy ? "Saving…" : "Change password"}
            </button>
            {msg && (
              <span
                className="settings-msg"
                style={{
                  color:
                    msg.kind === "err"
                      ? "var(--rose-deep, #b4232a)"
                      : undefined,
                }}
              >
                {msg.text}
              </span>
            )}
          </div>
        </form>

        <div className="security-divider" />

        <div className="settings-actions">
          <button
            type="button"
            className="btn btn-rose btn-sm"
            onClick={logoutEverywhere}
            disabled={loggingOut}
          >
            {loggingOut ? "Signing out…" : "Log out everywhere"}
          </button>
          <span className="settings-msg">
            Signs out this and all other devices.
          </span>
        </div>
      </div>
    </details>
  );
}
