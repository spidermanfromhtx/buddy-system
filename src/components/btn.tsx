import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

const KIND = {
  fill: "bg-rust text-on-rust hover:opacity-90",
  paper: "bg-paper/80 text-ink hover:bg-paper",
  rust: "bg-rust text-on-rust hover:opacity-90",
  ink: "bg-ink text-paper hover:opacity-90",
  line: "bg-paper/50 text-ink hover:bg-paper",
  night: "bg-paper/10 text-paper hover:bg-paper/20",
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
        "inline-flex h-11 shrink-0 items-center justify-center rounded-2xl px-5 text-sm font-medium tracking-tight transition-opacity duration-150 disabled:opacity-40",
        KIND[kind],
        className,
      )}
      {...props}
    />
  );
}