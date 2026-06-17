"use client";

import { useState } from "react";
import Link from "next/link";

type State =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "done"; slug: string }
  | { kind: "expired"; slug?: string }
  | { kind: "resent" }
  | { kind: "error"; message: string };

export function ConfirmAction({ token }: { token: string }) {
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
        setState({
          kind: "error",
          message: json.error ?? "Something went wrong.",
        });
        return;
      }
      setState({ kind: "done", slug: json.slug });
    } catch {
      setState({ kind: "error", message: "Network error. Please try again." });
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
      setState({ kind: "error", message: "Network error. Please try again." });
    }
  }

  if (state.kind === "done") {
    return (
      <div>
        <h1>Email confirmed</h1>
        <p className="sub">
          Thanks — your work email is verified. The profile owner will see your
          endorsement marked as confirmed when they review it.
        </p>
        <Link href={`/u/${state.slug}`} className="btn btn-primary btn-lg">
          View the wall
        </Link>
      </div>
    );
  }

  if (state.kind === "resent") {
    return (
      <div>
        <h1>Check your inbox</h1>
        <p className="sub">
          If you have a pending endorsement, a fresh confirmation link is on its
          way. It may take a minute to arrive.
        </p>
      </div>
    );
  }

  if (state.kind === "expired") {
    return (
      <div>
        <h1>Link expired</h1>
        <p className="sub">
          This confirmation link has expired. Enter the email you submitted with
          and we&rsquo;ll send a fresh one.
        </p>
        <input
          type="email"
          className="input"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button
          className="btn btn-primary btn-lg"
          style={{ marginTop: 12 }}
          disabled={!email.trim() || !state.slug}
          onClick={() => state.slug && resend(state.slug)}
        >
          Send a new link
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1>Confirm your endorsement</h1>
      <p className="sub">
        Click below to confirm your work email and verify the endorsement you
        submitted.
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
