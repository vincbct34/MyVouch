import type { Metadata } from "next";
import { appBaseUrl } from "@/lib/url";
import { getLocale } from "@/lib/locale";
import { getMessages } from "@/lib/i18n";
import { I18nProvider } from "@/components/I18nProvider";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const m = getMessages(await getLocale());
  return {
    metadataBase: new URL(appBaseUrl()),
    title: {
      default: m.layout.titleDefault,
      template: "%s · MyVouch",
    },
    description: m.layout.description,
    icons: {
      icon: "/favicon.svg",
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body>
        <I18nProvider locale={locale}>
          {children}
          <LocaleSwitcher />
        </I18nProvider>
      </body>
    </html>
  );
}
