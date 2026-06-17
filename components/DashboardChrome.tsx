"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LinkIcon } from "./Icons";

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  }
  const display = url.replace(/^https?:\/\//, "");
  return (
    <div className="share-box">
      <LinkIcon className="ic" />
      <code>{display}</code>
      <button className="btn btn-primary btn-sm" onClick={copy}>
        {copied ? "Copied!" : "Copy link"}
      </button>
    </div>
  );
}

export function EmailVerifyBanner() {
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">(
    "idle",
  );
  async function resend() {
    setState("busy");
    try {
      const res = await fetch("/api/auth/email/resend", { method: "POST" });
      setState(res.ok ? "sent" : "error");
    } catch {
      setState("error");
    }
  }
  return (
    <div className="wrap" style={{ marginTop: 16 }}>
      <div className="verify-banner">
        <span>
          <strong>Confirm your email</strong> to unlock the employer-overlap
          signal for endorsements from your work-email domain.
        </span>
        <button
          className="btn btn-primary btn-sm"
          onClick={resend}
          disabled={state === "busy" || state === "sent"}
        >
          {state === "sent"
            ? "Email sent"
            : state === "busy"
              ? "Sending…"
              : state === "error"
                ? "Try again"
                : "Resend link"}
        </button>
      </div>
    </div>
  );
}

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }
  return (
    <button className="btn btn-ghost btn-sm" onClick={logout}>
      Log out
    </button>
  );
}
