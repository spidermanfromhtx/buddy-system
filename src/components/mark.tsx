import { cn } from "@/lib/utils";

export function Mark({
  onDark = false,
  className,
}: {
  onDark?: boolean;
  className?: string;
}) {
  const body = onDark ? "var(--paper)" : "#e8875c";
  const face = onDark ? "#e8875c" : "var(--paper)";
  return (
    <svg viewBox="0 0 48 48" className={cn("size-9 shrink-0", className)} aria-hidden>
      <rect x="2" y="2" width="44" height="44" rx="12" fill={body} />
      <circle cx="18" cy="20" r="3.2" fill={face} />
      <circle cx="30" cy="20" r="3.2" fill={face} />
      <path
        d="M17 29c3.2 4.4 10.8 4.4 14 0"
        stroke={face}
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
