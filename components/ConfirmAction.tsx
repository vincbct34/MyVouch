"use client";

import { useState } from "react";
import Link from "next/link";
import { useT } from "./I18nProvider";

type State =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "done"; slug: string }
  | { kind: "expired"; slug?: string }
  | { kind: "resent" }
  | { kind: "error"; message: string };

export function ConfirmAction({ token }: { token: string }) {
  const m = useT().confirmAction;
  const [state, setState] = useState<State>({ kind: "idle" });
  const [email, setEmail] = useState("");

  async function confirm() {
    setState({ kind: "busy" });
    try {
      const res = await fetch("/api/endorsements/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const json = await res.json();
      if (res.status === 410) {
        setState({ kind: "expired", slug: json.slug });
        return;
      }
      if (!res.ok) {
        setState({ kind: "error", message: json.error ?? m.generic });
        return;
      }
      setState({ kind: "done", slug: json.slug });
    } catch {
      setState({ kind: "error", message: m.network });
    }
  }

  async function resend(slug: string) {
    try {
      await fetch("/api/endorsements/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, reviewer_email: email }),
      });
      // Always generic — never reveal whether a pending endorsement exists.
      setState({ kind: "resent" });
    } catch {
      setState({ kind: "error", message: m.network });
    }
  }

  if (state.kind === "done") {
    return (
      <div>
        <h1>{m.doneTitle}</h1>
        <p className="sub">{m.doneBody}</p>
        <Link href={`/u/${state.slug}`} className="btn btn-primary btn-lg">
          {m.viewWall}
        </Link>
      </div>
    );
  }

  if (state.kind === "resent") {
    return (
      <div>
        <h1>{m.resentTitle}</h1>
        <p className="sub">{m.resentBody}</p>
      </div>
    );
  }

  if (state.kind === "expired") {
    return (
      <div>
        <h1>{m.expiredTitle}</h1>
        <p className="sub">{m.expiredBody}</p>
        <input
          type="email"
          className="input"
          placeholder={m.emailPlaceholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button
          className="btn btn-primary btn-lg"
          style={{ marginTop: 12 }}
          disabled={!email.trim() || !state.slug}
          onClick={() => state.slug && resend(state.slug)}
        >
          {m.sendNew}
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1>{m.title}</h1>
      <p className="sub">{m.body}</p>
      {state.kind === "error" && (
        <div className="form-error">{state.message}</div>
      )}
      <button
        className="btn btn-primary btn-lg"
        onClick={confirm}
        disabled={state.kind === "busy"}
      >
        {state.kind === "busy" ? m.confirming : m.confirm}
      </button>
    </div>
  );
}
