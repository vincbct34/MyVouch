import type { Metadata } from "next";
import { getLocale } from "@/lib/locale";
import { getMessages } from "@/lib/i18n";
import { LegalPage } from "@/components/LegalPage";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getMessages(await getLocale()).legal.terms.title };
}

export default function CguPage() {
  return <LegalPage which="terms" />;
}
