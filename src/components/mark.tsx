import { cn } from "@/lib/utils";

export function Mark({
  onDark = false,
  className,
}: {
  onDark?: boolean;
  className?: string;
}) {
  const body = onDark ? "#f7f2e9" : "#2a241f";
  const home = onDark ? "#14110e" : "#f7f2e9";
  return (
    <svg viewBox="0 0 48 48" className={cn("size-14 shrink-0", className)} aria-hidden>
      <rect x="12" y="2" width="24" height="44" rx="6" fill={body} />
      <rect x="15" y="6" width="18" height="32" rx="3" fill="#c45c3e" />
      <circle cx="21" cy="16" r="2.2" fill="#14110e" />
      <circle cx="27" cy="16" r="2.2" fill="#14110e" />
      <path
        d="M21 22c2 3.2 5 3.2 7 0"
        stroke="#14110e"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
      />
      <rect x="21" y="41" width="6" height="2" rx="1" fill={home} />
    </svg>
  );
}
