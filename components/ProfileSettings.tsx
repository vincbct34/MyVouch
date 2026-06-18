"use client";

import { useState } from "react";
import { useT } from "./I18nProvider";

export function ProfileSettings({
  headline,
  location,
  linkedinUrl,
  openToWork,
}: {
  headline: string | null;
  location: string | null;
  linkedinUrl: string | null;
  openToWork: boolean;
}) {
  const m = useT().settings;
  const [open, setOpen] = useState(false);
  const [otw, setOtw] = useState(openToWork);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        headline: fd.get("headline"),
        location: fd.get("location"),
        linkedin_url: fd.get("linkedin_url"),
        open_to_work: otw,
      }),
    });
    const json = await res.json();
    setBusy(false);
    setMsg(res.ok ? m.saved : (json.error ?? m.saveFail));
  }

  return (
    <details
      className="profile-settings"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="btn btn-ghost btn-sm">{m.summary}</summary>
      <form className="settings-form" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="headline">{m.headline}</label>
          <input
            className="input"
            id="headline"
            name="headline"
            defaultValue={headline ?? ""}
            maxLength={160}
            placeholder={m.headlinePlaceholder}
          />
        </div>
        <div className="field">
          <label htmlFor="location">{m.location}</label>
          <input
            className="input"
            id="location"
            name="location"
            defaultValue={location ?? ""}
            maxLength={120}
            placeholder={m.locationPlaceholder}
          />
        </div>
        <div className="field">
          <label htmlFor="linkedin_url">{m.linkedin}</label>
          <input
            className="input"
            id="linkedin_url"
            name="linkedin_url"
            type="url"
            defaultValue={linkedinUrl ?? ""}
            maxLength={200}
            placeholder="https://linkedin.com/in/you"
          />
        </div>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={otw}
            onChange={(e) => setOtw(e.target.checked)}
          />
          {m.openToWork}
        </label>
        <div className="settings-actions">
          <button className="btn btn-primary btn-sm" disabled={busy}>
            {busy ? m.saving : m.save}
          </button>
          {msg && <span className="settings-msg">{msg}</span>}
        </div>
      </form>
    </details>
  );
}
