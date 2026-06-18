"use client";

import { useMemo, useState } from "react";
import type { PublicEndorsement, Relationship } from "@/lib/db";
import { ReviewCard } from "./ReviewCard";
import { CheckIcon } from "./Icons";
import { useT } from "./I18nProvider";

type Filter = "all" | Relationship;

const FILTER_ORDER: Filter[] = [
  "all",
  "manager",
  "peer",
  "report",
  "client",
  "partner",
  "mentee",
];

/** Toolbar + masonry wall with client-side relationship filtering. */
export function ProfileWall({
  slug,
  initial,
  initialCursor,
  total,
}: {
  slug: string;
  initial: PublicEndorsement[];
  initialCursor: string | null;
  total: number;
}) {
  const t = useT();
  const m = t.wall;
  const [filter, setFilter] = useState<Filter>("all");
  const [endorsements, setEndorsements] =
    useState<PublicEndorsement[]>(initial);
  const [loading, setLoading] = useState(false);
  // Keyset cursor for the next page (computed server-side from the SSR'd first
  // page); null once there are no more rows to fetch.
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const hasMore = cursor !== null && endorsements.length < total;

  async function loadMore() {
    setLoading(true);
    try {
      const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
      const res = await fetch(`/api/u/${slug}/endorsements${qs}`);
      if (res.ok) {
        const json = await res.json();
        const next = (json.endorsements ?? []) as PublicEndorsement[];
        setCursor((json.nextCursor ?? null) as string | null);
        // De-dupe by id in case of overlap; append the rest.
        setEndorsements((cur) => {
          const seen = new Set(cur.map((e) => e.id));
          return [...cur, ...next.filter((e) => !seen.has(e.id))];
        });
      }
    } finally {
      setLoading(false);
    }
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: endorsements.length };
    for (const e of endorsements)
      c[e.relationship] = (c[e.relationship] ?? 0) + 1;
    return c;
  }, [endorsements]);

  const visible = useMemo(
    () =>
      filter === "all"
        ? endorsements
        : endorsements.filter((e) => e.relationship === filter),
    [endorsements, filter],
  );

  const activeFilters = FILTER_ORDER.filter(
    (f) => f === "all" || counts[f] > 0,
  );

  return (
    <>
      <div className="toolbar">
        <div className="filters">
          {activeFilters.map((f) => (
            <button
              key={f}
              className={`filt${filter === f ? " active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f === "all"
                ? m.filterAll
                : `${t.relationshipLabels[f as Relationship]}s`}
              <span className="ct">{counts[f] ?? 0}</span>
            </button>
          ))}
        </div>
        <span className="sortby">
          {m.sortedByPre}
          <b>{m.sortedByValue}</b>
        </span>
      </div>

      {visible.length === 0 ? (
        <div className="empty-wall">
          <span className="ec">
            <CheckIcon className="ic" />
          </span>
          {m.emptyView}
        </div>
      ) : (
        <div className="masonry">
          {visible.map((e) => (
            <ReviewCard key={e.id} e={e} />
          ))}
        </div>
      )}

      {hasMore && filter === "all" && (
        <div className="load-more">
          <button
            className="btn btn-ghost"
            onClick={loadMore}
            disabled={loading}
          >
            {loading ? m.loading : m.loadMore}
          </button>
        </div>
      )}
    </>
  );
}
