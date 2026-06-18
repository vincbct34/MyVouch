"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "./Avatar";
import { useT } from "./I18nProvider";

interface AccountInitial {
  slug: string;
  name: string;
  email: string;
  emailConfirmed: boolean;
  headline: string | null;
  location: string | null;
  linkedinUrl: string | null;
  openToWork: boolean;
  avatarUrl: string | null;
}

type Note = { kind: "ok" | "err"; text: string } | null;

function Note({ note }: { note: Note }) {
  if (!note) return null;
  return (
    <span
      className="settings-msg"
      style={{
        color: note.kind === "err" ? "var(--rose-deep, #b4232a)" : undefined,
      }}
    >
      {note.text}
    </span>
  );
}

/**
 * Downscale a picked image to a square JPEG (<= side px) on the client so we
 * never upload a multi-megabyte original. Returns a Blob ready to POST.
 */
async function downscaleToSquare(file: File, side = 256): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const min = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - min) / 2;
  const sy = (bitmap.height - min) / 2;
  const canvas = document.createElement("canvas");
  canvas.width = side;
  canvas.height = side;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.drawImage(bitmap, sx, sy, min, min, 0, 0, side, side);
  bitmap.close?.();
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/jpeg",
      0.85,
    ),
  );
}

export function AccountPanels({ initial }: { initial: AccountInitial }) {
  const m = useT().account;
  const ms = useT().security;
  const router = useRouter();

  /* ---- Profile ---- */
  const [otw, setOtw] = useState(initial.openToWork);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileNote, setProfileNote] = useState<Note>(null);

  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setProfileBusy(true);
    setProfileNote(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        headline: fd.get("headline"),
        location: fd.get("location"),
        linkedin_url: fd.get("linkedin_url"),
        open_to_work: otw,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setProfileBusy(false);
    if (!res.ok) {
      setProfileNote({ kind: "err", text: json.error ?? m.saveFail });
      return;
    }
    setProfileNote({ kind: "ok", text: m.saved });
    router.refresh();
  }

  /* ---- Avatar ---- */
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarNote, setAvatarNote] = useState<Note>(null);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setAvatarBusy(true);
    setAvatarNote(null);
    try {
      const blob = await downscaleToSquare(file);
      const res = await fetch("/api/account/avatar", {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: blob,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAvatarNote({ kind: "err", text: json.error ?? m.saveFail });
        return;
      }
      router.refresh();
    } catch {
      setAvatarNote({ kind: "err", text: m.saveFail });
    } finally {
      setAvatarBusy(false);
    }
  }

  async function removeAvatar() {
    setAvatarBusy(true);
    setAvatarNote(null);
    const res = await fetch("/api/account/avatar", { method: "DELETE" });
    setAvatarBusy(false);
    if (!res.ok) {
      setAvatarNote({ kind: "err", text: m.saveFail });
      return;
    }
    router.refresh();
  }

  /* ---- Email ---- */
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailNote, setEmailNote] = useState<Note>(null);

  async function changeEmail(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEmailBusy(true);
    setEmailNote(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const res = await fetch("/api/account/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: fd.get("email"),
        password: fd.get("password"),
      }),
    });
    const json = await res.json().catch(() => ({}));
    setEmailBusy(false);
    if (!res.ok) {
      setEmailNote({ kind: "err", text: json.error ?? m.emailChangeFail });
      return;
    }
    form.reset();
    setEmailNote({ kind: "ok", text: m.emailChanged });
    router.refresh();
  }

  /* ---- Security: password + logout-all ---- */
  const [pwBusy, setPwBusy] = useState(false);
  const [pwNote, setPwNote] = useState<Note>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  async function changePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPwNote(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const next = String(fd.get("new_password") ?? "");
    if (next !== String(fd.get("confirm_password") ?? "")) {
      setPwNote({ kind: "err", text: ms.pwMismatch });
      return;
    }
    setPwBusy(true);
    const res = await fetch("/api/auth/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        current_password: fd.get("current_password"),
        new_password: next,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setPwBusy(false);
    if (!res.ok) {
      setPwNote({ kind: "err", text: json.error ?? ms.pwChangeFail });
      return;
    }
    form.reset();
    setPwNote({ kind: "ok", text: ms.pwChanged });
  }

  async function logoutEverywhere() {
    setLoggingOut(true);
    const res = await fetch("/api/auth/logout-all", { method: "POST" });
    if (!res.ok) {
      setLoggingOut(false);
      setPwNote({ kind: "err", text: ms.logoutFail });
      return;
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* Profile */}
      <section className="account-card">
        <h2>{m.profileTitle}</h2>

        <div className="avatar-row">
          <Avatar name={initial.name} size="lg" src={initial.avatarUrl} />
          <div className="avatar-controls">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={onPickFile}
            />
            <div className="settings-actions">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={avatarBusy}
                onClick={() => fileRef.current?.click()}
              >
                {avatarBusy ? m.avatarUploading : m.avatarUpload}
              </button>
              {initial.avatarUrl && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={avatarBusy}
                  onClick={removeAvatar}
                >
                  {m.avatarRemove}
                </button>
              )}
              <Note note={avatarNote} />
            </div>
            <p className="hint">{m.avatarHint}</p>
          </div>
        </div>

        <form className="settings-form" onSubmit={saveProfile}>
          <div className="field">
            <label htmlFor="name">{m.name}</label>
            <input
              className="input"
              id="name"
              name="name"
              defaultValue={initial.name}
              maxLength={120}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="headline">{m.headline}</label>
            <input
              className="input"
              id="headline"
              name="headline"
              defaultValue={initial.headline ?? ""}
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
              defaultValue={initial.location ?? ""}
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
              defaultValue={initial.linkedinUrl ?? ""}
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
            <button className="btn btn-primary btn-sm" disabled={profileBusy}>
              {profileBusy ? m.saving : m.save}
            </button>
            <Note note={profileNote} />
          </div>
        </form>
      </section>

      {/* Email */}
      <section className="account-card">
        <h2>{m.emailTitle}</h2>
        <p className="account-current">
          {m.emailCurrent}: <strong>{initial.email}</strong>{" "}
          <span
            className={`badge ${initial.emailConfirmed ? "chip-verified" : ""}`}
          >
            {initial.emailConfirmed ? m.emailVerified : m.emailUnverified}
          </span>
        </p>
        <form className="settings-form" onSubmit={changeEmail}>
          <div className="field">
            <label htmlFor="new_email">{m.newEmail}</label>
            <input
              className="input"
              id="new_email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="email_password">{m.currentPassword}</label>
            <input
              className="input"
              id="email_password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          <div className="settings-actions">
            <button className="btn btn-primary btn-sm" disabled={emailBusy}>
              {emailBusy ? m.emailChanging : m.emailChange}
            </button>
            <Note note={emailNote} />
          </div>
        </form>
      </section>

      {/* Security */}
      <section className="account-card">
        <h2>{m.securityTitle}</h2>
        <form className="settings-form" onSubmit={changePassword}>
          <div className="field">
            <label htmlFor="current_password">{ms.current}</label>
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
            <label htmlFor="new_password">{ms.new}</label>
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
            <label htmlFor="confirm_password">{ms.confirm}</label>
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
            <button className="btn btn-primary btn-sm" disabled={pwBusy}>
              {pwBusy ? ms.saving : ms.save}
            </button>
            <Note note={pwNote} />
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
            {loggingOut ? ms.loggingOut : ms.logoutAll}
          </button>
          <span className="settings-msg">{ms.logoutAllHint}</span>
        </div>
      </section>
    </>
  );
}
