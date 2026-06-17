import { StarIcon } from "./Icons";

export function Stars({ value, lg = false }: { value: number; lg?: boolean }) {
  return (
    <span
      className={`stars${lg ? " lg" : ""}`}
      aria-label={`${value} out of 5`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <StarIcon key={i} className={i <= value ? "" : "off"} />
      ))}
    </span>
  );
}
