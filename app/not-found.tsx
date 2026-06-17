import Link from "next/link";
import { Brandmark } from "@/components/Brandmark";

export default function NotFound() {
  return (
    <main className="auth-wrap">
      <div
        className="auth-card"
        style={{ textAlign: "center", alignItems: "center" }}
      >
        <Brandmark size="lg" />
        <h1>Not found</h1>
        <p className="sub" style={{ marginTop: 0 }}>
          This page or profile doesn&rsquo;t exist.
        </p>
        <Link href="/" className="btn btn-primary">
          Back home
        </Link>
      </div>
    </main>
  );
}
