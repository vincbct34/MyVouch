"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Brandmark } from "./Brandmark";
import { Avatar } from "./Avatar";
import { LinkIcon } from "./Icons";
import { avatarUrl } from "@/lib/ui";
import { useT } from "./I18nProvider";

export function CopyLink({ url }: { url: string }) {
  const m = useT().chrome;
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
        {copied ? m.copied : m.copyLink}
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
  const m = useT().chrome;
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
          <strong>{m.verifyBannerStrong}</strong> {m.verifyBannerRest}
        </span>
        <button
          className="btn btn-primary btn-sm"
          onClick={resend}
          disabled={state === "busy" || state === "sent"}
        >
          {state === "sent"
            ? m.resendSent
            : state === "busy"
              ? m.resendBusy
              : state === "error"
                ? m.resendError
                : m.resendIdle}
        </button>
      </div>
    </div>
  );
}

export function LogoutButton() {
  const m = useT().chrome;
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }
  return (
    <button className="btn btn-ghost btn-sm" onClick={logout}>
      {m.logout}
    </button>
  );
}

export function DashboardHeader({
  user,
}: {
  user: {
    slug: string;
    name: string;
    avatarUpdatedAt: string | null;
  };
}) {
  const m = useT().chrome;
  const src = avatarUrl(user.slug, user.avatarUpdatedAt);
  return (
    <header className="admin-head">
      <div className="wrap bar admin-shell">
        <div className="center admin-brand">
          <Brandmark onDark href="/dashboard" />
          <span className="badge">{m.adminBadge}</span>
        </div>

        <div className="center admin-actions">
          <Link href={`/u/${user.slug}`} className="btn btn-ghost btn-sm">
            {m.viewPublic}
          </Link>
          <Link href="/account" className="btn btn-ghost btn-sm">
            {m.account}
          </Link>
          <LogoutButton />
          <Link href="/account" aria-label={m.account}>
            <Avatar name={user.name} size="sm" src={src} />
          </Link>
        </div>

        <details className="admin-menu">
          <summary className="btn btn-ghost btn-sm admin-menu-trigger">
            {m.menu}
            <MenuIcon />
          </summary>
          <div className="admin-menu-panel">
            <Link href={`/u/${user.slug}`} className="btn btn-ghost btn-sm">
              {m.viewPublic}
            </Link>
            <Link href="/account" className="btn btn-ghost btn-sm">
              {m.account}
            </Link>
            <LogoutButton />
            <div className="admin-menu-user">
              <Avatar name={user.name} size="sm" src={src} />
              <span>{user.name}</span>
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}
