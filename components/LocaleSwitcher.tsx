"use client";

import { useRouter } from "next/navigation";
import { LOCALES, LOCALE_COOKIE, messages } from "@/lib/i18n";
import { useLocale } from "./I18nProvider";

/**
 * Language toggle. Writes a year-long `locale` cookie (readable server-side, so
 * SSR picks it up) and refreshes so server components re-render in the new
 * locale. Not httpOnly by design — the client needs to set it.
 */
export function LocaleSwitcher() {
  const router = useRouter();
  const active = useLocale();

  function choose(next: string) {
    // Standard cookie write; the immutability rule misreads document.cookie.
    // eslint-disable-next-line react-hooks/immutability
    document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
    router.refresh();
  }

  return (
    <div
      className="locale-switcher"
      role="group"
      aria-label={messages[active].switcher.aria}
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          className={`locale-opt${l === active ? " active" : ""}`}
          aria-pressed={l === active}
          onClick={() => choose(l)}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
