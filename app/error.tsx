"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Brandmark } from "@/components/Brandmark";
import { useT } from "@/components/I18nProvider";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  const m = useT().error;
  useEffect(() => {
    // Surface to your monitoring here in production.
  }, []);

  return (
    <main className="auth-wrap">
      <div
        className="auth-card"
        style={{ textAlign: "center", alignItems: "center" }}
      >
        <Brandmark size="lg" />
        <h1>{m.title}</h1>
        <p className="sub" style={{ marginTop: 0 }}>
          {m.sub}
        </p>
        <div className="center" style={{ gap: 10 }}>
          <button className="btn btn-primary" onClick={reset}>
            {m.retry}
          </button>
          <Link href="/" className="btn btn-ghost">
            {m.back}
          </Link>
        </div>
      </div>
    </main>
  );
}
