import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

const KIND = {
  fill: "bg-rust text-on-rust hover:opacity-90",
  paper: "bg-paper text-ink hover:bg-paper-2",
  rust: "bg-rust text-on-rust hover:opacity-90",
  ink: "bg-rust text-on-rust hover:opacity-90",
  line: "border border-ink/15 bg-paper text-ink hover:bg-paper-2",
  night: "border border-paper/25 bg-transparent text-paper hover:bg-paper/10",
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
