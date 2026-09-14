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
  const dim = size === "lg" ? "size-28" : size === "sm" ? "size-12" : "size-16";
  return (
    <div
      className={cn("relative shrink-0 overflow-hidden rounded-2xl", dim)}
      aria-label={name}
      title={name}
      style={{ backgroundColor: color }}
    >
      {ringing ? (
        <span className="absolute inset-0 animate-ping rounded-2xl bg-rust/40" />
      ) : null}
      {photo ? (
        <img src={photo} alt="" className="relative size-full object-cover" />
      ) : (
        <svg viewBox="0 0 64 64" className="relative size-full" aria-hidden>
          <circle cx="32" cy="32" r="32" fill={color} />
          <circle cx="23" cy="26" r="4.2" fill="#14110e" />
          <circle cx="41" cy="26" r="4.2" fill="#14110e" />
          <path
            d="M23 41c5 7 13 7 18 0"
            stroke="#14110e"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      )}
    </div>
  );
}
