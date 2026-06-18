"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Brandmark } from "./Brandmark";
import { Avatar } from "./Avatar";
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

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" className="ic" aria-hidden="true">
      <path
        d="M4 7h16M4 12h16M4 17h16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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

export function DashboardHeader({
  user,
}: {
  user: {
    slug: string;
    name: string;
  };
}) {
  return (
    <header className="admin-head">
      <div className="wrap bar admin-shell">
        <div className="center admin-brand">
          <Brandmark onDark href="/dashboard" />
          <span className="badge">Admin</span>
        </div>

        <div className="center admin-actions">
          <Link href={`/u/${user.slug}`} className="btn btn-ghost btn-sm">
            View public profile
          </Link>
          <LogoutButton />
          <Avatar name={user.name} size="sm" />
        </div>

        <details className="admin-menu">
          <summary className="btn btn-ghost btn-sm admin-menu-trigger">
            Menu
            <MenuIcon />
          </summary>
          <div className="admin-menu-panel">
            <Link href={`/u/${user.slug}`} className="btn btn-ghost btn-sm">
              View public profile
            </Link>
            <LogoutButton />
            <div className="admin-menu-user">
              <Avatar name={user.name} size="sm" />
              <span>{user.name}</span>
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}
