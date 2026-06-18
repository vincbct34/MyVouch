"use client";

import { useState } from "react";
import Link from "next/link";
import { useT } from "./I18nProvider";

type State =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "done" }
  | { kind: "error"; message: string };

/** Owner-side confirmation of their own email (posts to /api/auth/email/confirm). */
export function EmailConfirmAction({ token }: { token: string }) {
  const m = useT().emailConfirm;
  const [state, setState] = useState<State>({ kind: "idle" });

  async function confirm() {
    setState({ kind: "busy" });
    try {
      const res = await fetch("/api/auth/email/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const json = await res.json();
      if (!res.ok) {
        setState({ kind: "error", message: json.error ?? m.generic });
        return;
      }
      setState({ kind: "done" });
    } catch {
      setState({ kind: "error", message: m.network });
    }
  }

  if (state.kind === "done") {
    return (
      <div>
        <h1>{m.doneTitle}</h1>
        <p className="sub">{m.doneBody}</p>
        <Link href="/dashboard" className="btn btn-primary btn-lg">
          {m.dashboard}
        </Link>
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
