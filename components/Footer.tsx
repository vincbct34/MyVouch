import Link from "next/link";
import { Brandmark } from "./Brandmark";
import { getLocale } from "@/lib/locale";
import { getMessages } from "@/lib/i18n";

export async function Footer() {
  const m = getMessages(await getLocale()).footer;
  return (
    <footer className="site-foot">
      <div className="wrap">
        <div className="foot-main">
          <div className="foot-brand">
            <Brandmark href="/" />
            <span className="foot-tag">{m.tagline}</span>
            <a
              className="foot-bmc"
              href="https://www.buymeacoffee.com/404factory"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src="https://img.buymeacoffee.com/button-api/?text=Buy me a coffee&emoji=☕&slug=404factory&button_colour=a54b24&font_colour=ffffff&outline_colour=ffffff&coffee_colour=FFDD00"
                alt="Offrez-moi un café"
                height={48}
              />
            </a>
          </div>
          <nav className="foot-nav" aria-label="Footer">
            <Link href="/">{m.home}</Link>
            <Link href="/login">{m.login}</Link>
            <Link href="/signup">{m.signup}</Link>
          </nav>
        </div>
        <div className="foot-legal">
          <span className="cp">© {new Date().getFullYear()} MyVouch</span>
          <Link href="/mentions-legales">{m.legalNotice}</Link>
          <Link href="/confidentialite">{m.privacy}</Link>
          <Link href="/cgu">{m.terms}</Link>
        </div>
      </div>
    </footer>
  );
}
