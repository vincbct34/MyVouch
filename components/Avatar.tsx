import { initials, avatarClass } from "@/lib/ui";

export function Avatar({
  name,
  size,
  square = false,
}: {
  name: string;
  size?: "sm" | "lg" | "xl";
  square?: boolean;
}) {
  const cls = ["avatar", avatarClass(name), size ?? "", square ? "sq" : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={cls} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
