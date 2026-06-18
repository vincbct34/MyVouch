import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { appBaseUrl } from "@/lib/url";
import { getMessages, isLocale } from "@/lib/i18n";
import { I18nProvider } from "@/components/I18nProvider";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { Footer } from "@/components/Footer";
import "../globals.css";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const m = getMessages(locale);
  const base = appBaseUrl();
  return {
    metadataBase: new URL(base),
    title: {
      default: m.layout.titleDefault,
      template: "%s · MyVouch",
    },
    description: m.layout.description,
    icons: {
      icon: "/favicon.svg",
    },
    openGraph: {
      type: "website",
      siteName: "MyVouch",
      title: m.layout.titleDefault,
      description: m.layout.description,
      url: `${base}/${locale}`,
      locale: locale === "fr" ? "fr_FR" : "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: m.layout.titleDefault,
      description: m.layout.description,
    },
  };
}

// Root layout. Lives under the [locale] segment so every page is locale-prefixed
// (/en/…, /fr/…) — middleware.ts redirects unprefixed paths here. The locale is
// the URL's source of truth; getLocale() reads the same value off the x-locale
// header that middleware sets, so child server components stay params-free.
export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <html lang={locale}>
      <body>
        <I18nProvider locale={locale}>
          {children}
          <Footer />
          <LocaleSwitcher />
        </I18nProvider>
      </body>
    </html>
  );
}
