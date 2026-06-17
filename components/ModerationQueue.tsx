"use client";

import { useMemo, useRef, useState } from "react";
import type { Endorsement, Status } from "@/lib/db";
import { Avatar } from "./Avatar";
import { Stars } from "./Stars";
import { EmphasisText } from "./EmphasisText";
import { CheckIcon, ClockIcon, AlertIcon, SearchIcon } from "./Icons";
import { RELATIONSHIP_LABELS, formatDate, parseStrengths } from "@/lib/ui";

type Tab = "pending" | "approved" | "declined" | "all";
const TABS: { key: Tab; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Published" },
  { key: "declined", label: "Declined" },
  { key: "all", label: "All" },
];

export function ModerationQueue({ initial }: { initial: Endorsement[] }) {
  const [items, setItems] = useState<Endorsement[]>(initial);
  const [tab, setTab] = useState<Tab>("pending");
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, declined: 0, all: items.length };
    for (const e of items) c[e.status]++;
    return c;
  }, [items]);

  const avgPublished = useMemo(() => {
    const pub = items.filter((e) => e.status === "approved");
    return pub.length
      ? (pub.reduce((s, e) => s + e.rating, 0) / pub.length).toFixed(1)
      : "—";
  }, [items]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((e) => {
      if (tab !== "all" && e.status !== tab) return false;
      if (!q) return true;
      return (
        e.reviewer_name.toLowerCase().includes(q) ||
        (e.reviewer_company ?? "").toLowerCase().includes(q) ||
        e.body.toLowerCase().includes(q)
      );
    });
  }, [items, tab, query]);

  function fireToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }

  async function moderate(e: Endorsement, status: Status) {
    const res = await fetch(`/api/endorsements/${e.id}/moderate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      fireToast("Couldn’t save — try again.");
      return;
    }
    setItems((cur) =>
      cur.map((x) =>
        x.id === e.id
          ? { ...x, status, resolved_at: new Date().toISOString() }
          : x,
      ),
    );
    fireToast(
      status === "approved"
        ? "Published to your public wall"
        : "Declined — hidden from your wall",
    );
  }

  async function remove(e: Endorsement) {
    const res = await fetch(`/api/endorsements/${e.id}`, { method: "DELETE" });
    if (!res.ok) {
      fireToast("Couldn’t delete — try again.");
      return;
    }
    setItems((cur) => cur.filter((x) => x.id !== e.id));
    fireToast("Endorsement deleted");
  }

  async function saveEdit(e: Endorsement, body: string): Promise<boolean> {
    const res = await fetch(`/api/endorsements/${e.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (!res.ok) {
      fireToast("Couldn’t save — try again.");
      return false;
    }
    setItems((cur) => cur.map((x) => (x.id === e.id ? { ...x, body } : x)));
    fireToast("Endorsement updated");
    return true;
  }

  async function toggleLinkedIn(e: Endorsement) {
    const next = !e.linkedin_matched;
    const res = await fetch(`/api/endorsements/${e.id}/signals`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linkedin_matched: next }),
    });
    if (!res.ok) {
      fireToast("Couldn’t save — try again.");
      return;
    }
    setItems((cur) =>
      cur.map((x) =>
        x.id === e.id ? { ...x, linkedin_matched: next ? 1 : 0 } : x,
      ),
    );
    fireToast(next ? "Marked LinkedIn as matched" : "Removed LinkedIn match");
  }

  return (
    <>
      {/* KPIs */}
      <div className="wrap">
        <div className="admin-title">
          <h1>Moderation queue</h1>
          <p>
            Review incoming endorsements before they reach your public wall.
          </p>
        </div>
        <div className="kpis">
          <div className="kpi amber">
            <div className="n">{counts.pending}</div>
            <div className="l">Awaiting review</div>
          </div>
          <div className="kpi green">
            <div className="n">{counts.approved}</div>
            <div className="l">Published</div>
          </div>
          <div className="kpi">
            <div className="n">{avgPublished}</div>
            <div className="l">Avg published rating</div>
          </div>
          <div className="kpi rose">
            <div className="n">{counts.declined}</div>
            <div className="l">Declined</div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="tabbar">
        <div className="wrap bar">
          <div className="tabs">
            {TABS.map((t) => (
              <button
                key={t.key}
                className={`tab${tab === t.key ? " active" : ""}`}
                onClick={() => setTab(t.key)}
              >
                {t.label} <span className="ct">{counts[t.key]}</span>
              </button>
            ))}
          </div>
          <div className="admin-search">
            <SearchIcon />
            <input
              placeholder="Search endorsements"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Queue */}
      <div className="queue">
        <div className="wrap">
          {visible.length === 0 ? (
            <div className="empty-state">
              <span className="ec">
                <CheckIcon className="ic" />
              </span>
              <h3>You&rsquo;re all caught up</h3>
              <p>Nothing to review in this view.</p>
            </div>
          ) : (
            visible.map((e) => (
              <ModCard
                key={e.id}
                e={e}
                onModerate={moderate}
                onToggleLinkedIn={toggleLinkedIn}
                onDelete={remove}
                onSaveEdit={saveEdit}
              />
            ))
          )}
        </div>
      </div>

      <div className={`toast${toast ? " show" : ""}`}>
        {toast && <CheckIcon />}
        {toast}
      </div>
    </>
  );
}

function ModCard({
  e,
  onModerate,
  onToggleLinkedIn,
  onDelete,
  onSaveEdit,
}: {
  e: Endorsement;
  onModerate: (e: Endorsement, s: Status) => void;
  onToggleLinkedIn: (e: Endorsement) => void;
  onDelete: (e: Endorsement) => void;
  onSaveEdit: (e: Endorsement, body: string) => Promise<boolean>;
}) {
  const strengths = parseStrengths(e.strengths);
  const lowTrust = !e.email_confirmed && !e.employer_overlap_verified;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(e.body);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function commitEdit() {
    const ok = await onSaveEdit(e, draft.trim());
    if (ok) setEditing(false);
  }

  const statusBadge =
    e.status === "approved" ? (
      <span className="badge badge-verified">
        <span className="dot" /> Published
      </span>
    ) : e.status === "declined" ? (
      <span className="badge badge-declined">
        <span className="dot" /> Declined
      </span>
    ) : lowTrust ? (
      <span className="badge badge-neutral">
        <span className="dot" /> Needs attention
      </span>
    ) : (
      <span className="badge badge-pending">
        <span className="dot" /> Pending review
      </span>
    );

  return (
    <article className="mod" data-status={e.status}>
      <div className="rail" />
      <div className="inner">
        <div className="lead">
          <div className="author">
            <Avatar name={e.reviewer_name} />
            <div className="who">
              <span className="nm">{e.reviewer_name}</span>
              <span className="rl">
                {[e.reviewer_role, e.reviewer_company]
                  .filter(Boolean)
                  .join(" · ") || "Reviewer"}
              </span>
            </div>
            {statusBadge}
          </div>
          {editing ? (
            <div className="edit-box">
              <textarea
                className="textarea"
                value={draft}
                maxLength={600}
                onChange={(ev) => setDraft(ev.target.value)}
              />
              <div className="edit-actions">
                <button
                  className="btn btn-primary btn-sm"
                  disabled={draft.trim().length < 20}
                  onClick={commitEdit}
                >
                  Save
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setDraft(e.body);
                    setEditing(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text">
              <EmphasisText text={e.body} />
            </p>
          )}
          <div className="tags">
            <Stars value={e.rating} />
            <span className="chip">{RELATIONSHIP_LABELS[e.relationship]}</span>
            {strengths.slice(0, 3).map((s) => (
              <span key={s} className="chip chip-solid">
                {s}
              </span>
            ))}
            <span className="sub">Submitted {formatDate(e.submitted_at)}</span>
          </div>
        </div>

        <div className="side">
          <div className="verify-list">
            <Signal
              ok={!!e.email_confirmed}
              okLabel="Work email confirmed"
              waitLabel="Email confirmation pending"
            />
            <Signal
              ok={!!e.employer_overlap_verified}
              okLabel="Same work-email domain as you"
              waitLabel="Different email domain"
            />
            <Signal
              ok={!!e.linkedin_matched}
              okLabel="LinkedIn identity matched"
              waitLabel="LinkedIn not matched"
            />
          </div>

          <div className="linkedin-control">
            {e.reviewer_linkedin && (
              <a
                href={e.reviewer_linkedin}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="btn btn-ghost btn-sm"
              >
                Open LinkedIn
              </a>
            )}
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => onToggleLinkedIn(e)}
            >
              {e.linkedin_matched
                ? "Unmark LinkedIn match"
                : "Mark LinkedIn match"}
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setEditing((v) => !v)}
            >
              {editing ? "Close editor" : "Edit text"}
            </button>
            {confirmDelete ? (
              <>
                <button
                  className="btn btn-rose btn-sm"
                  onClick={() => onDelete(e)}
                >
                  Confirm delete
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </button>
            )}
          </div>

          {e.status === "pending" ? (
            <div className="actions">
              <button
                className="btn btn-verified"
                onClick={() => onModerate(e, "approved")}
              >
                <CheckIcon className="ic" /> Approve &amp; publish
              </button>
              <button
                className="btn btn-rose"
                onClick={() => onModerate(e, "declined")}
              >
                Decline
              </button>
            </div>
          ) : e.status === "approved" ? (
            <>
              <div className="resolved-note live">
                <CheckIcon /> Live on your public profile
              </div>
              <div className="actions">
                <button
                  className="btn btn-rose"
                  onClick={() => onModerate(e, "declined")}
                >
                  Unpublish
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="resolved-note">
                <AlertIcon /> Hidden — not shown publicly
              </div>
              <div className="actions">
                <button
                  className="btn btn-verified"
                  onClick={() => onModerate(e, "approved")}
                >
                  <CheckIcon className="ic" /> Publish
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function Signal({
  ok,
  okLabel,
  waitLabel,
}: {
  ok: boolean;
  okLabel: string;
  waitLabel: string;
}) {
  return (
    <div className={`v ${ok ? "ok" : "wait"}`}>
      {ok ? <CheckIcon /> : <ClockIcon />}
      {ok ? okLabel : waitLabel}
    </div>
  );
}
