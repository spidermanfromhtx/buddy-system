import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

const KIND = {
  fill: "bg-ink text-paper shadow-[inset_0_2px_4px_rgba(20,17,14,0.35)] hover:bg-ink/90",
  paper: "bg-paper text-night hover:bg-paper/90",
  rust: "bg-ink text-paper shadow-[inset_0_2px_4px_rgba(20,17,14,0.35)] hover:bg-ink/90",
  ink: "bg-ink text-paper shadow-[inset_0_2px_4px_rgba(20,17,14,0.35)] hover:bg-ink/90",
  line: "border border-ink/15 bg-cream text-ink shadow-sm hover:bg-paper",
  night: "border border-paper/20 bg-transparent text-paper hover:bg-paper/10",
} as const;

export function Btn({
  kind = "line",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { kind?: keyof typeof KIND }) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-12 shrink-0 items-center justify-center rounded-full px-6 text-base font-medium transition-transform duration-150 ease-out active:scale-[0.98] disabled:opacity-50",
        KIND[kind],
        className,
      )}
      {...props}
    />
  );
}
