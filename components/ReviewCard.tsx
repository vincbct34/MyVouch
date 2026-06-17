import { Avatar } from "./Avatar";
import { Stars } from "./Stars";
import { EmphasisText } from "./EmphasisText";
import type { PublicEndorsement } from "@/lib/db";
import { RELATIONSHIP_LABELS, formatDate, parseStrengths } from "@/lib/ui";

/** A single published endorsement on the public wall. */
export function ReviewCard({ e }: { e: PublicEndorsement }) {
  const strengths = parseStrengths(e.strengths);
  return (
    <article className="review">
      <div className="qmark">&ldquo;</div>
      <p className="body">
        <EmphasisText text={e.body} />
      </p>
      <div className="meta-row">
        <Stars value={e.rating} />
        {e.email_confirmed ? (
          <span
            className="chip chip-verified"
            title="Reviewer confirmed their work email"
          >
            ✓ Verified
          </span>
        ) : null}
        <span className="chip">{RELATIONSHIP_LABELS[e.relationship]}</span>
        {strengths.slice(0, 2).map((s) => (
          <span key={s} className="chip chip-solid">
            {s}
          </span>
        ))}
        <span className="date">
          {formatDate(e.resolved_at ?? e.submitted_at)}
        </span>
      </div>
      <div className="foot">
        <Avatar name={e.reviewer_name} />
        <div className="who">
          <span className="nm">{e.reviewer_name}</span>
          <span className="rl">
            {[e.reviewer_role, e.reviewer_company]
              .filter(Boolean)
              .join(" · ") || "Verified reference"}
          </span>
        </div>
      </div>
    </article>
  );
}
