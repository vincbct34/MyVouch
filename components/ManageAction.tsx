"use client";

import { useState } from "react";
import Link from "next/link";

type State =
  | { kind: "idle" }
  | { kind: "confirm" }
  | { kind: "busy" }
  | { kind: "done" }
  | { kind: "error"; message: string };

/**
 * Reviewer-facing controls for an endorsement they wrote, reached via the
 * manage_token link in their confirmation email. Withdrawal is a two-step
 * confirm (it's a hard delete) and POSTs same-origin to the withdraw route.
 */
export function ManageAction({
  token,
  reviewerName,
  ownerName,
  ownerSlug,
}: {
  token: string;
  reviewerName: string;
  ownerName: string;
  ownerSlug: string;
}) {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function withdraw() {
    setState({ kind: "busy" });
    try {
      const res = await fetch("/api/endorsements/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
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
        <h1>Endorsement withdrawn</h1>
        <p className="sub">
          Your endorsement of {ownerName} has been removed. It will no longer
          appear anywhere on MyVouch.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1>Manage your endorsement</h1>
      <p className="sub">
        You wrote an endorsement of <strong>{ownerName}</strong> as{" "}
        {reviewerName}. You can withdraw it at any time — this permanently
        deletes it.
      </p>
      {state.kind === "error" && (
        <div className="form-error">{state.message}</div>
      )}
      {state.kind === "confirm" ? (
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <button className="btn btn-rose btn-lg" onClick={withdraw}>
            Yes, withdraw it
          </button>
          <button
            className="btn btn-ghost btn-lg"
            onClick={() => setState({ kind: "idle" })}
          >
            Keep it
          </button>
        </div>
      ) : (
        <button
          className="btn btn-rose btn-lg"
          style={{ marginTop: 12 }}
          disabled={state.kind === "busy"}
          onClick={() => setState({ kind: "confirm" })}
        >
          Withdraw my endorsement
        </button>
      )}
      <p style={{ marginTop: 16 }}>
        <Link href={`/u/${ownerSlug}`}>View {ownerName}&rsquo;s wall</Link>
      </p>
    </div>
  );
}
