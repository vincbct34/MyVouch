import { initials, avatarClass } from "@/lib/ui";

export function Avatar({
  name,
  size,
  square = false,
  src,
}: {
  name: string;
  size?: "sm" | "lg" | "xl";
  square?: boolean;
  /** Profile photo URL. When present, shows the image; otherwise generated initials. */
  src?: string | null;
}) {
  const cls = ["avatar", avatarClass(name), size ?? "", square ? "sq" : ""]
    .filter(Boolean)
    .join(" ");
  if (src) {
    // Plain <img>: the bytes are served from our own API route and already
    // downscaled on upload, so next/image's optimizer adds no value here.
    return <img className={`${cls} avatar-img`} src={src} alt={name} />;
  }
  return (
    <span className={cls} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
