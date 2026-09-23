import { cn } from "@/lib/utils";

export function Mark({
  onDark = false,
  className,
}: {
  onDark?: boolean;
  className?: string;
}) {
  const body = onDark ? "var(--paper)" : "var(--rust)";
  const screen = onDark ? "var(--night)" : "var(--paper)";
  const face = onDark ? "var(--paper)" : "var(--rust)";
  const home = onDark ? "var(--night)" : "var(--paper)";
  return (
    <svg viewBox="0 0 36 52" className={cn("h-10 w-7 shrink-0", className)} aria-hidden>
      <rect x="2" y="1" width="32" height="50" rx="9" fill={body} />
      <rect x="6" y="6" width="24" height="34" rx="4" fill={screen} />
      <circle cx="14.5" cy="18" r="2.6" fill={face} />
      <circle cx="21.5" cy="18" r="2.6" fill={face} />
      <path
        d="M13.5 24.5c2.6 3.6 6.4 3.6 9 0"
        stroke={face}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="18" cy="45.5" r="2.1" fill={home} />
    </svg>
  );
}
