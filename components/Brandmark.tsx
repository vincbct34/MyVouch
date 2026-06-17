import Link from "next/link";

/** Vouch logo: speech bubble fused with a checkmark (endorsement + verification). */
export function Brandmark({
  size = "default",
  onDark = false,
  href = "/",
  label = "Vouch",
}: {
  size?: "default" | "lg";
  onDark?: boolean;
  href?: string | null;
  label?: string;
}) {
  const inner = (
    <span
      className={`brandmark${size === "lg" ? " lg" : ""}${onDark ? " on-dark" : ""}`}
    >
      <svg
        className="mark"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M6 4h20a4 4 0 0 1 4 4v11a4 4 0 0 1-4 4H15l-6.4 5.2a.8.8 0 0 1-1.3-.62V23H6a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4z"
          fill="currentColor"
        />
        <path
          d="M10.2 14.3l3.7 3.8 7.9-8.4"
          stroke={onDark ? "var(--ink)" : "var(--on-brand)"}
          strokeWidth="2.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {label}
    </span>
  );
  if (!href) return inner;
  return (
    <Link href={href} aria-label={`${label} home`}>
      {inner}
    </Link>
  );
}
