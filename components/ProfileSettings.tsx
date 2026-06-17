"use client";

import { useState } from "react";

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
    setMsg(res.ok ? "Saved." : (json.error ?? "Couldn’t save."));
  }

  return (
    <details
      className="profile-settings"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="btn btn-ghost btn-sm">Edit profile</summary>
      <form className="settings-form" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="headline">Headline</label>
          <input
            className="input"
            id="headline"
            name="headline"
            defaultValue={headline ?? ""}
            maxLength={160}
            placeholder="Senior Product Designer · ex-Figma"
          />
        </div>
        <div className="field">
          <label htmlFor="location">Location</label>
          <input
            className="input"
            id="location"
            name="location"
            defaultValue={location ?? ""}
            maxLength={120}
            placeholder="Lisbon, Portugal"
          />
        </div>
        <div className="field">
          <label htmlFor="linkedin_url">LinkedIn URL</label>
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
          Open to work
        </label>
        <div className="settings-actions">
          <button className="btn btn-primary btn-sm" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </button>
          {msg && <span className="settings-msg">{msg}</span>}
        </div>
      </form>
    </details>
  );
}
