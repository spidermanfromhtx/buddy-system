import { HOUSE, HOUSE_INK } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function Face({
  name,
  color,
  photo,
  size = "md",
  ringing = false,
}: {
  name: string;
  color: string;
  photo?: string | null;
  size?: "sm" | "md" | "lg";
  ringing?: boolean;
}) {
  const fill = color || HOUSE;
  const marks = color ? "#1a1a1a" : HOUSE_INK;
  const dim = size === "lg" ? "size-28 sm:size-32" : size === "sm" ? "size-12 sm:size-14" : "size-16 sm:size-18";
  return (
    <div
      className={cn("relative shrink-0 overflow-hidden rounded-2xl", dim)}
      aria-label={name}
      title={name}
      style={{ backgroundColor: fill }}
    >
      {ringing ? (
        <span className="absolute inset-0 animate-ping rounded-2xl bg-rust/40" />
      ) : null}
      {photo ? (
        <img src={photo} alt="" className="relative size-full object-cover" />
      ) : (
        <svg viewBox="0 0 64 64" className="relative size-full" aria-hidden>
          <circle cx="32" cy="32" r="32" fill={fill} />
          <circle cx="23" cy="26" r="4.2" fill={marks} />
          <circle cx="41" cy="26" r="4.2" fill={marks} />
          <path
            d="M23 41c5 7 13 7 18 0"
            stroke={marks}
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      )}
    </div>
  );
}
