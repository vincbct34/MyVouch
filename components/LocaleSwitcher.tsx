"use client";

import { useRouter, usePathname } from "next/navigation";
import { LOCALES, isLocale, messages } from "@/lib/i18n";
import { useLocale } from "./I18nProvider";

/**
 * Language toggle. Locale lives in the URL's first segment (/en/…, /fr/…), so
 * switching swaps that prefix and navigates; middleware then pins the matching
 * `locale` cookie. router.refresh() re-renders server components in the new
 * locale.
 */
export function LocaleSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const active = useLocale();

  function choose(next: string) {
    const segments = pathname.split("/");
    // segments[0] is "" (leading slash); segments[1] is the locale prefix.
    if (isLocale(segments[1])) {
      segments[1] = next;
    } else {
      segments.splice(1, 0, next);
    }
    router.push(segments.join("/") || `/${next}`);
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
