import { Brandmark } from "./Brandmark";
import { getLocale } from "@/lib/locale";
import { getMessages } from "@/lib/i18n";

export async function Footer() {
  const m = getMessages(await getLocale());
  return (
    <footer className="site-foot">
      <div className="wrap row">
        <Brandmark href={null} />
        <span className="cp">
          © {new Date().getFullYear()} MyVouch · {m.footer.tagline}
        </span>
      </div>
    </footer>
  );
}
