import type { AuditEntry } from "@/lib/db";
import { formatDate } from "@/lib/ui";
import { getMessages, type Locale } from "@/lib/i18n";

// Maps the action codes appendAuditLog writes to message keys. Unknown codes
// fall back to the raw string so a newly added action is still legible.
type ActionKey =
  | "approved"
  | "declined"
  | "edit"
  | "delete"
  | "passwordChange"
  | "logoutAll"
  | "emailChange"
  | "tokenCreate"
  | "tokenRevoke";

const ACTION_KEYS: Record<string, ActionKey> = {
  "endorsement.approved": "approved",
  "endorsement.declined": "declined",
  "endorsement.edit": "edit",
  "endorsement.delete": "delete",
  "password.change": "passwordChange",
  "session.logout_all": "logoutAll",
  "email.change": "emailChange",
  "token.create": "tokenCreate",
  "token.revoke": "tokenRevoke",
};

/**
 * Read-only history of the owner's sensitive actions. The audit trail was
 * already captured (appendAuditLog) but had no surface; this gives owners a
 * dispute/forensics view of what changed on their account and when.
 */
export function AuditLog({
  entries,
  locale,
}: {
  entries: AuditEntry[];
  locale: Locale;
}) {
  const m = getMessages(locale).audit;
  const label = (action: string) =>
    ACTION_KEYS[action] ? m[ACTION_KEYS[action]] : action;
  return (
    <details className="audit-log">
      <summary>{m.summary(entries.length)}</summary>
      {entries.length === 0 ? (
        <p className="sub">{m.empty}</p>
      ) : (
        <ul className="audit-list">
          {entries.map((e) => (
            <li key={e.id} className="audit-item">
              <span className="audit-action">{label(e.action)}</span>
              {e.detail && <span className="audit-detail">{e.detail}</span>}
              <span className="audit-date">
                {formatDate(e.created_at, locale)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
