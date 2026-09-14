import { CATEGORIES, parseCategories, type CategoryId } from "@/lib/categories";
import { cn } from "@/lib/utils";

export function CategoryPicker({
  value,
  onChange,
  multiple = true,
  onDark = false,
  allowAll = false,
}: {
  value: string[];
  onChange: (next: CategoryId[]) => void;
  multiple?: boolean;
  onDark?: boolean;
  allowAll?: boolean;
}) {
  const selected = parseCategories(value);
  const none = allowAll && selected.length === 0;

  function toggle(id: CategoryId) {
    if (multiple) {
      onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
      return;
    }
    onChange(allowAll && selected[0] === id ? [] : [id]);
  }

  function chip(on: boolean) {
    if (onDark) {
      return on
        ? "bg-paper text-night"
        : "border border-paper/30 bg-transparent text-paper hover:bg-paper/10";
    }
    return on
      ? "bg-rust text-on-rust"
      : "border border-ink/15 bg-paper text-ink hover:bg-paper-2";
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {allowAll ? (
        <button
          type="button"
          aria-pressed={none}
          className={cn(
            "inline-flex h-9 items-center justify-center whitespace-nowrap rounded-full px-3 text-sm font-medium",
            chip(none),
          )}
          onClick={() => onChange([])}
        >
          All
        </button>
      ) : null}
      {CATEGORIES.map((c) => {
        const on = selected.includes(c.id);
        return (
          <button
            key={c.id}
            type="button"
            aria-pressed={on}
            className={cn(
              "inline-flex h-9 items-center justify-center whitespace-nowrap rounded-full px-3 text-sm font-medium",
              chip(on),
            )}
            onClick={() => toggle(c.id)}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
