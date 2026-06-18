"use client";

import { useState } from "react";
import Link from "next/link";
import { useT } from "./I18nProvider";

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
  const m = useT().manage;
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
        <p className="sub">{m.doneBody(ownerName)}</p>
      </div>
    );
  }

  return (
    <div>
      <h1>{m.title}</h1>
      <p className="sub">
        {m.descPre}
        <strong>{ownerName}</strong>
        {m.descPost(reviewerName)}
      </p>
      {state.kind === "error" && (
        <div className="form-error">{state.message}</div>
      )}
      {state.kind === "confirm" ? (
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <button className="btn btn-rose btn-lg" onClick={withdraw}>
            {m.confirmYes}
          </button>
          <button
            className="btn btn-ghost btn-lg"
            onClick={() => setState({ kind: "idle" })}
          >
            {m.keep}
          </button>
        </div>
      ) : (
        <button
          className="btn btn-rose btn-lg"
          style={{ marginTop: 12 }}
          disabled={state.kind === "busy"}
          onClick={() => setState({ kind: "confirm" })}
        >
          {m.withdraw}
        </button>
      )}
      <p style={{ marginTop: 16 }}>
        <Link href={`/u/${ownerSlug}`}>{m.viewWall(ownerName)}</Link>
      </p>
    </div>
  );
}
