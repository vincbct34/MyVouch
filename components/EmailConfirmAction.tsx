"use client";

import { useState } from "react";
import Link from "next/link";

type State =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "done" }
  | { kind: "error"; message: string };

/** Owner-side confirmation of their own email (posts to /api/auth/email/confirm). */
export function EmailConfirmAction({ token }: { token: string }) {
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
        setState({
          kind: "error",
          message: json.error ?? "Something went wrong.",
        });
        return;
      }
      setState({ kind: "done" });
    } catch {
      setState({ kind: "error", message: "Network error. Please try again." });
    }
  }

  if (state.kind === "done") {
    return (
      <div>
        <h1>Email confirmed</h1>
        <p className="sub">
          Your email is verified. Endorsements from the same work-email domain
          can now earn the employer-overlap signal.
        </p>
        <Link href="/dashboard" className="btn btn-primary btn-lg">
          Go to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1>Confirm your email</h1>
      <p className="sub">
        Click below to confirm the email on your MyVouch account.
      </p>
      {state.kind === "error" && (
        <div className="form-error">{state.message}</div>
      )}
      <button
        className="btn btn-primary btn-lg"
        onClick={confirm}
        disabled={state.kind === "busy"}
      >
        {state.kind === "busy" ? "Confirming…" : "Confirm my email"}
      </button>
    </div>
  );
}
