import { Fragment } from "react";

/**
 * Renders body text, converting <em>…</em> spans into styled emphasis.
 * Parsing is done by regex split (no raw HTML injection) so user-submitted
 * text stays safe — any other markup is shown as plain text.
 */
export function EmphasisText({ text }: { text: string }) {
  const parts = text.split(/(<em>.*?<\/em>)/g);
  return (
    <>
      {parts.map((p, i) => {
        const m = p.match(/^<em>(.*?)<\/em>$/);
        return m ? <em key={i}>{m[1]}</em> : <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}
