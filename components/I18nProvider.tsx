"use client";

import { createContext, useContext } from "react";
import {
  DEFAULT_LOCALE,
  messages,
  type Locale,
  type Messages,
} from "@/lib/i18n";

// Only the locale string crosses the server→client boundary. The catalog holds
// functions (not serializable), so the client imports `messages` itself and
// indexes it by the locale from context.
const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return (
    <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

/** Active catalog for client components. */
export function useT(): Messages {
  return messages[useContext(LocaleContext)];
}
