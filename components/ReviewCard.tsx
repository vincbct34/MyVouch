import { Avatar } from "./Avatar";
import { Stars } from "./Stars";
import { EmphasisText } from "./EmphasisText";
import type { PublicEndorsement } from "@/lib/db";
import { formatDate, parseStrengths } from "@/lib/ui";
import { useT, useLocale } from "./I18nProvider";

/** A single published endorsement on the public wall. */
export function ReviewCard({ e }: { e: PublicEndorsement }) {
  const t = useT();
  const locale = useLocale();
  const m = t.review;
  const strengths = parseStrengths(e.strengths);
  return (
    <article className="review">
      <div className="qmark">&ldquo;</div>
      <p className="body">
        <EmphasisText text={e.body} />
      </p>
      <div className="meta-row">
        <Stars value={e.rating} locale={locale} />
        {e.email_confirmed ? (
          <span className="chip chip-verified" title={m.verifiedTitle}>
            ✓ {m.verifiedChip}
          </span>
        ) : null}
        <span className="chip">{t.relationshipLabels[e.relationship]}</span>
        {strengths.slice(0, 2).map((s) => (
          <span key={s} className="chip chip-solid">
            {t.skillLabels[s] ?? s}
          </span>
        ))}
        <span className="date">
          {formatDate(e.resolved_at ?? e.submitted_at, locale)}
        </span>
      </div>
      <div className="foot">
        <Avatar name={e.reviewer_name} />
        <div className="who">
          <span className="nm">{e.reviewer_name}</span>
          <span className="rl">
            {[e.reviewer_role, e.reviewer_company]
              .filter(Boolean)
              .join(" · ") || m.defaultRef}
          </span>
        </div>
      </div>
    </article>
  );
}
