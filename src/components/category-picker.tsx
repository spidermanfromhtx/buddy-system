import { Btn } from "@/components/btn";
import { CATEGORIES, parseCategories, type CategoryId } from "@/lib/categories";

export function CategoryPicker({
  value,
  onChange,
  multiple = false,
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
    if (!multiple) {
      onChange(allowAll && selected[0] === id ? [] : [id]);
      return;
    }
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {allowAll ? (
        <Btn
          type="button"
          kind={none ? (onDark ? "paper" : "ink") : onDark ? "night" : "line"}
          className="h-10 text-sm"
          aria-pressed={none}
          onClick={() => onChange([])}
        >
          All
        </Btn>
      ) : null}
      {CATEGORIES.map((c) => {
        const on = selected.includes(c.id);
        return (
          <Btn
            key={c.id}
            type="button"
            kind={on ? (onDark ? "paper" : "ink") : onDark ? "night" : "line"}
            className="h-10 text-sm"
            aria-pressed={on}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggle(c.id);
            }}
          >
            {c.label}
          </Btn>
        );
      })}
    </div>
  );
}
