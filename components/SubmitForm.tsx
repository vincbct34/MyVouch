"use client";

import { useState } from "react";
import Link from "next/link";
import { StarIcon, ShieldIcon, CheckIcon } from "./Icons";
import { SKILL_OPTIONS } from "@/lib/ui";
import { useT } from "./I18nProvider";
import type { Relationship } from "@/lib/db";

const MAX = 600;

export function SubmitForm({
  ownerName,
  ownerSlug,
}: {
  ownerName: string;
  ownerSlug: string;
}) {
  const t = useT();
  const m = t.submit;
  const firstName = ownerName.split(" ")[0];

  // Bot defense: a hidden honeypot field real users never fill, plus the time
  // the form was rendered so the server can reject implausibly fast submits.
  const [renderedAt] = useState(() => Date.now());
  const [relationship, setRelationship] = useState<Relationship | null>(null);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const shown = hover || rating;

  function toggleSkill(s: string) {
    setSkills((cur) =>
      cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s],
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!relationship) return setError(m.errRel);
    if (rating < 1) return setError(m.errRating);
    if (body.trim().length < 20) return setError(m.errShort);

    const fd = new FormData(e.currentTarget);
    setBusy(true);
    const res = await fetch(`/api/u/${ownerSlug}/endorsements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reviewer_name: fd.get("name"),
        reviewer_email: fd.get("email"),
        reviewer_role: fd.get("role"),
        reviewer_company: fd.get("company"),
        reviewer_linkedin: fd.get("linkedin"),
        relationship,
        rating,
        body,
        strengths: skills,
        company_url: fd.get("company_url"), // honeypot — must stay empty
        elapsed_ms: Date.now() - renderedAt,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? m.generic);
      setBusy(false);
      return;
    }
    setDone(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (done) {
    return (
      <div className="form-card success-card">
        <span className="seal">
          <CheckIcon />
        </span>
        <h2>{m.successTitle}</h2>
        <p className="muted" style={{ maxWidth: 420 }}>
          {m.successBody(firstName)}
        </p>
        <div className="links">
          <Link href={`/u/${ownerSlug}`} className="btn btn-ghost">
            {m.viewWall(firstName)}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form className="form-card" onSubmit={onSubmit}>
      {/* Honeypot: off-screen, hidden from AT and tab order. Bots fill it, humans don't. */}
      <input
        type="text"
        name="company_url"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "-9999px",
          width: 1,
          height: 1,
          opacity: 0,
        }}
      />

      {/* 1 — Who are you */}
      <section className="step">
        <div className="step-head">
          <span className="step-num">1</span>
          <h3>{m.step1}</h3>
        </div>
        <div className="row-2">
          <div className="field">
            <label htmlFor="name">{m.name}</label>
            <input className="input" id="name" name="name" required />
          </div>
          <div className="field">
            <label htmlFor="email">{m.email}</label>
            <input
              className="input"
              id="email"
              name="email"
              type="email"
              required
            />
          </div>
        </div>
        <div className="row-2">
          <div className="field">
            <label htmlFor="role">{m.role}</label>
            <input
              className="input"
              id="role"
              name="role"
              placeholder={m.rolePlaceholder}
            />
          </div>
          <div className="field">
            <label htmlFor="company">{m.company}</label>
            <input
              className="input"
              id="company"
              name="company"
              placeholder={m.companyPlaceholder}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="linkedin">
            {m.linkedin} <span className="muted">{m.optional}</span>
          </label>
          <input
            className="input"
            id="linkedin"
            name="linkedin"
            type="url"
            placeholder="https://linkedin.com/in/you"
          />
        </div>
      </section>

      {/* 2 — Relationship */}
      <section className="step">
        <div className="step-head">
          <span className="step-num">2</span>
          <h3>{m.step2}</h3>
        </div>
        <div className="rel-grid">
          {t.relationshipTiles.map((tile) => (
            <button
              type="button"
              key={tile.value}
              className={`rel${relationship === tile.value ? " sel" : ""}`}
              onClick={() => setRelationship(tile.value)}
            >
              <span className="em">{tile.emoji}</span>
              <span className="t">{tile.title}</span>
              <span className="s">{tile.sub}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 3 — Rating */}
      <section className="step">
        <div className="step-head">
          <span className="step-num">3</span>
          <h3>{m.step3(firstName)}</h3>
        </div>
        <div className="star-row">
          <span className="star-pick" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((i) => (
              <button
                type="button"
                key={i}
                aria-label={m.starAria(i)}
                onMouseEnter={() => setHover(i)}
                onClick={() => setRating(i)}
              >
                <StarIcon className={`star${i <= shown ? " on" : ""}`} />
              </button>
            ))}
          </span>
          {shown > 0 && (
            <span className="star-label">{t.ratingWords[shown]}</span>
          )}
        </div>
      </section>

      {/* 4 — Endorsement */}
      <section className="step">
        <div className="step-head">
          <span className="step-num">4</span>
          <h3>{m.step4}</h3>
        </div>
        <textarea
          className="textarea"
          name="body"
          maxLength={MAX}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={m.bodyPlaceholder(firstName)}
        />
        <div className="counter">
          {body.length}/{MAX}
        </div>
      </section>

      {/* 5 — Strengths */}
      <section className="step">
        <div className="step-head">
          <span className="step-num">5</span>
          <h3>
            {m.step5} <span className="muted">{m.optional}</span>
          </h3>
        </div>
        <div className="skills">
          {SKILL_OPTIONS.map((s) => (
            <button
              type="button"
              key={s}
              className={`skill${skills.includes(s) ? " sel" : ""}`}
              onClick={() => toggleSkill(s)}
            >
              {t.skillLabels[s] ?? s}
            </button>
          ))}
        </div>
      </section>

      {error && (
        <div className="form-error" style={{ marginTop: 8 }}>
          {error}
        </div>
      )}

      <div className="submit-bar">
        <span className="trust">
          <ShieldIcon />
          {m.trust(firstName)}
        </span>
        <button className="btn btn-primary btn-lg" disabled={busy}>
          {busy ? m.submitting : m.submit}
        </button>
      </div>
    </form>
  );
}
