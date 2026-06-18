"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Brandmark } from "@/components/Brandmark";
import { useT } from "@/components/I18nProvider";

export default function LoginPage() {
  const router = useRouter();
  const m = useT().login;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const data = Object.fromEntries(new FormData(e.currentTarget));
    const res = await fetch("/api/auth/login", {
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
              autoComplete="current-password"
              required
            />
          </div>
          <button className="btn btn-primary btn-lg" disabled={busy}>
            {busy ? m.submitting : m.submit}
          </button>
        </form>
        <p className="auth-foot">
          {m.footPre}
          <Link href="/signup">{m.footLink}</Link>
        </p>
      </div>
    </main>
  );
}
