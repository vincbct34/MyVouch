import { StarIcon } from "./Icons";
import { getMessages, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

export function Stars({
  value,
  lg = false,
  locale = DEFAULT_LOCALE,
}: {
  value: number;
  lg?: boolean;
  locale?: Locale;
}) {
  return (
    <span
      className={`stars${lg ? " lg" : ""}`}
      aria-label={getMessages(locale).stars.aria(value)}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <StarIcon key={i} className={i <= value ? "" : "off"} />
      ))}
    </span>
  );
}
