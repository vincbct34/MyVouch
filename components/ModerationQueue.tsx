"use client";

import { useMemo, useRef, useState } from "react";
import type { Endorsement, Status } from "@/lib/db";
import { Avatar } from "./Avatar";
import { Stars } from "./Stars";
import { EmphasisText } from "./EmphasisText";
import { CheckIcon, ClockIcon, AlertIcon, SearchIcon } from "./Icons";
import { formatDate, parseStrengths } from "@/lib/ui";
import { useT, useLocale } from "./I18nProvider";

type Tab = "pending" | "approved" | "declined" | "all";
const TAB_KEYS: Tab[] = ["pending", "approved", "declined", "all"];
type TabLabelKey = "tabPending" | "tabApproved" | "tabDeclined" | "tabAll";
const TAB_LABEL: Record<Tab, TabLabelKey> = {
  pending: "tabPending",
  approved: "tabApproved",
  declined: "tabDeclined",
  all: "tabAll",
};

export function ModerationQueue({ initial }: { initial: Endorsement[] }) {
  const m = useT().queue;
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
      fireToast(m.saveErr);
      return;
    }
    setItems((cur) =>
      cur.map((x) =>
        x.id === e.id
          ? { ...x, status, resolved_at: new Date().toISOString() }
          : x,
      ),
    );
    fireToast(status === "approved" ? m.toastApproved : m.toastDeclined);
  }

  async function remove(e: Endorsement) {
    const res = await fetch(`/api/endorsements/${e.id}`, { method: "DELETE" });
    if (!res.ok) {
      fireToast(m.deleteErr);
      return;
    }
    setItems((cur) => cur.filter((x) => x.id !== e.id));
    fireToast(m.toastDeleted);
  }

  async function saveEdit(e: Endorsement, body: string): Promise<boolean> {
    const res = await fetch(`/api/endorsements/${e.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (!res.ok) {
      fireToast(m.saveErr);
      return false;
    }
    setItems((cur) => cur.map((x) => (x.id === e.id ? { ...x, body } : x)));
    fireToast(m.toastUpdated);
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
      fireToast(m.saveErr);
      return;
    }
    setItems((cur) =>
      cur.map((x) =>
        x.id === e.id ? { ...x, linkedin_matched: next ? 1 : 0 } : x,
      ),
    );
    fireToast(next ? m.toastLinkedinOn : m.toastLinkedinOff);
  }

  return (
    <>
      {/* KPIs */}
      <div className="wrap">
        <div className="admin-title">
          <h1>{m.title}</h1>
          <p>{m.subtitle}</p>
        </div>
        <div className="kpis">
          <div className="kpi amber">
            <div className="n">{counts.pending}</div>
            <div className="l">{m.kpiPending}</div>
          </div>
          <div className="kpi green">
            <div className="n">{counts.approved}</div>
            <div className="l">{m.kpiPublished}</div>
          </div>
          <div className="kpi">
            <div className="n">{avgPublished}</div>
            <div className="l">{m.kpiAvg}</div>
          </div>
          <div className="kpi rose">
            <div className="n">{counts.declined}</div>
            <div className="l">{m.kpiDeclined}</div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="tabbar">
        <div className="wrap bar">
          <div className="tabs">
            {TAB_KEYS.map((key) => (
              <button
                key={key}
                className={`tab${tab === key ? " active" : ""}`}
                onClick={() => setTab(key)}
              >
                {m[TAB_LABEL[key]]} <span className="ct">{counts[key]}</span>
              </button>
            ))}
          </div>
          <div className="admin-search">
            <SearchIcon />
            <input
              placeholder={m.searchPlaceholder}
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
              <h3>{m.emptyTitle}</h3>
              <p>{m.emptyBody}</p>
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
  const t = useT();
  const m = t.queue;
  const locale = useLocale();
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
        <span className="dot" /> {m.badgePublished}
      </span>
    ) : e.status === "declined" ? (
      <span className="badge badge-declined">
        <span className="dot" /> {m.badgeDeclined}
      </span>
    ) : lowTrust ? (
      <span className="badge badge-neutral">
        <span className="dot" /> {m.badgeNeedsAttention}
      </span>
    ) : (
      <span className="badge badge-pending">
        <span className="dot" /> {m.badgePending}
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
                  .join(" · ") || m.defaultReviewer}
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
                  {m.save}
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setDraft(e.body);
                    setEditing(false);
                  }}
                >
                  {m.cancel}
                </button>
              </div>
            </div>
          ) : (
            <p className="text">
              <EmphasisText text={e.body} />
            </p>
          )}
          <div className="tags">
            <Stars value={e.rating} locale={locale} />
            <span className="chip">{t.relationshipLabels[e.relationship]}</span>
            {strengths.slice(0, 3).map((s) => (
              <span key={s} className="chip chip-solid">
                {t.skillLabels[s] ?? s}
              </span>
            ))}
            <span className="sub">
              {m.submitted(formatDate(e.submitted_at, locale))}
            </span>
          </div>
        </div>

        <div className="side">
          <div className="verify-list">
            <Signal
              ok={!!e.email_confirmed}
              okLabel={m.signalEmailOk}
              waitLabel={m.signalEmailWait}
            />
            <Signal
              ok={!!e.employer_overlap_verified}
              okLabel={m.signalDomainOk}
              waitLabel={m.signalDomainWait}
            />
            <Signal
              ok={!!e.linkedin_matched}
              okLabel={m.signalLinkedinOk}
              waitLabel={m.signalLinkedinWait}
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
                {m.openLinkedin}
              </a>
            )}
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => onToggleLinkedIn(e)}
            >
              {e.linkedin_matched ? m.unmarkLinkedin : m.markLinkedin}
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setEditing((v) => !v)}
            >
              {editing ? m.closeEditor : m.editText}
            </button>
            {confirmDelete ? (
              <>
                <button
                  className="btn btn-rose btn-sm"
                  onClick={() => onDelete(e)}
                >
                  {m.confirmDelete}
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setConfirmDelete(false)}
                >
                  {m.cancel}
                </button>
              </>
            ) : (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setConfirmDelete(true)}
              >
                {m.delete}
              </button>
            )}
          </div>

          {e.status === "pending" ? (
            <div className="actions">
              <button
                className="btn btn-verified"
                onClick={() => onModerate(e, "approved")}
              >
                <CheckIcon className="ic" /> {m.approvePublish}
              </button>
              <button
                className="btn btn-rose"
                onClick={() => onModerate(e, "declined")}
              >
                {m.decline}
              </button>
            </div>
          ) : e.status === "approved" ? (
            <>
              <div className="resolved-note live">
                <CheckIcon /> {m.liveNote}
              </div>
              <div className="actions">
                <button
                  className="btn btn-rose"
                  onClick={() => onModerate(e, "declined")}
                >
                  {m.unpublish}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="resolved-note">
                <AlertIcon /> {m.hiddenNote}
              </div>
              <div className="actions">
                <button
                  className="btn btn-verified"
                  onClick={() => onModerate(e, "approved")}
                >
                  <CheckIcon className="ic" /> {m.publish}
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
