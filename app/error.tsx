"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Brandmark } from "@/components/Brandmark";

export default function Error({ reset }: { error: Error; reset: () => void }) {
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
        <h1>Something went wrong</h1>
        <p className="sub" style={{ marginTop: 0 }}>
          An unexpected error occurred. Try again, or head back home.
        </p>
        <div className="center" style={{ gap: 10 }}>
          <button className="btn btn-primary" onClick={reset}>
            Try again
          </button>
          <Link href="/" className="btn btn-ghost">
            Back home
          </Link>
        </div>
      </div>
    </main>
  );
}
