import type { Metadata } from "next";
import { appBaseUrl } from "@/lib/url";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(appBaseUrl()),
  title: {
    default: "Vouch — Verified endorsements",
    template: "%s · Vouch",
  },
  description:
    "Collect, verify, and publish trusted references. Vouch turns word-of-mouth into a verified endorsement wall you own.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
