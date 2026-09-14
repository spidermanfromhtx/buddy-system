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
    <svg viewBox="0 0 32 48" className={cn("h-10 w-7 shrink-0", className)} aria-hidden>
      <rect x="1" y="1" width="30" height="46" rx="7" fill={body} />
      <rect x="4.5" y="5.5" width="23" height="32" rx="3.5" fill={screen} />
      <circle cx="12" cy="16" r="2.3" fill={face} />
      <circle cx="20" cy="16" r="2.3" fill={face} />
      <path
        d="M12 22c2.2 3.2 5.8 3.2 8 0"
        stroke={face}
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
      />
      <rect x="13" y="40.5" width="6" height="2.2" rx="1.1" fill={home} />
    </svg>
  );
}
