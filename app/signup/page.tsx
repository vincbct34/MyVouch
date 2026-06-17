"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Brandmark } from "@/components/Brandmark";

export default function SignupPage() {
  const router = useRouter();
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
      setError(json.error ?? "Something went wrong.");
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
          <h1>Build your wall</h1>
          <p className="sub">
            Start collecting verified endorsements in minutes.
          </p>
        </div>
        {error && <div className="form-error">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="name">Full name</label>
            <input className="input" id="name" name="name" required />
          </div>
          <div className="field">
            <label htmlFor="headline">Headline</label>
            <input
              className="input"
              id="headline"
              name="headline"
              placeholder="Product Designer · ex-Stripe"
            />
            <span className="hint">Shown under your name on your wall.</span>
          </div>
          <div className="field">
            <label htmlFor="location">Location</label>
            <input
              className="input"
              id="location"
              name="location"
              placeholder="Paris, France"
            />
          </div>
          <div className="field">
            <label htmlFor="email">Work email</label>
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
            <label htmlFor="password">Password</label>
            <input
              className="input"
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
            <span className="hint">At least 8 characters.</span>
          </div>
          <button className="btn btn-primary btn-lg" disabled={busy}>
            {busy ? "Creating…" : "Create my wall"}
          </button>
        </form>
        <p className="auth-foot">
          Already have an account? <Link href="/login">Log in</Link>
        </p>
      </div>
    </main>
  );
}
