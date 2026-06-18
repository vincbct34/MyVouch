"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Brandmark } from "@/components/Brandmark";
import { useT } from "@/components/I18nProvider";

export default function SignupPage() {
  const router = useRouter();
  const m = useT().signup;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const data = Object.fromEntries(new FormData(e.currentTarget));
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? m.generic);
      setBusy(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="auth-wrap">
      <div className="auth-card">
        <Brandmark size="lg" />
        <div>
          <h1>{m.title}</h1>
          <p className="sub">{m.sub}</p>
        </div>
        {error && <div className="form-error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="name">{m.name}</label>
            <input className="input" id="name" name="name" required />
          </div>
          <div className="field">
            <label htmlFor="headline">{m.headline}</label>
            <input
              className="input"
              id="headline"
              name="headline"
              placeholder={m.headlinePlaceholder}
            />
            <span className="hint">{m.headlineHint}</span>
          </div>
          <div className="field">
            <label htmlFor="location">{m.location}</label>
            <input
              className="input"
              id="location"
              name="location"
              placeholder={m.locationPlaceholder}
            />
          </div>
          <div className="field">
            <label htmlFor="email">{m.email}</label>
            <input
              className="input"
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">{m.password}</label>
            <input
              className="input"
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
            <span className="hint">{m.passwordHint}</span>
          </div>
          <button className="btn btn-primary btn-lg" disabled={busy}>
            {busy ? m.submitting : m.submit}
          </button>
        </form>
        <p className="auth-foot">
          {m.footPre}
          <Link href="/login">{m.footLink}</Link>
        </p>
      </div>
    </main>
  );
}
