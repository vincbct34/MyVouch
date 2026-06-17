import type { AuditEntry } from "@/lib/db";
import { formatDate } from "@/lib/ui";

// Human labels for the action codes appendAuditLog writes. Unknown codes fall
// back to the raw string so a newly added action is still legible.
const ACTION_LABELS: Record<string, string> = {
  "endorsement.approved": "Published an endorsement",
  "endorsement.declined": "Declined an endorsement",
  "endorsement.edit": "Edited an endorsement",
  "endorsement.delete": "Deleted an endorsement",
  "password.change": "Changed password",
  "session.logout_all": "Signed out everywhere",
};

function label(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

/**
 * Read-only history of the owner's sensitive actions. The audit trail was
 * already captured (appendAuditLog) but had no surface; this gives owners a
 * dispute/forensics view of what changed on their account and when.
 */
export function AuditLog({ entries }: { entries: AuditEntry[] }) {
  return (
    <details className="audit-log">
      <summary>Account activity ({entries.length})</summary>
      {entries.length === 0 ? (
        <p className="sub">No recorded activity yet.</p>
      ) : (
        <ul className="audit-list">
          {entries.map((e) => (
            <li key={e.id} className="audit-item">
              <span className="audit-action">{label(e.action)}</span>
              {e.detail && <span className="audit-detail">{e.detail}</span>}
              <span className="audit-date">{formatDate(e.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
