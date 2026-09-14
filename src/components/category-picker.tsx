import { Btn } from "@/components/btn";
import { CATEGORIES, parseCategories, type CategoryId } from "@/lib/categories";

export function CategoryPicker({
  value,
  onChange,
  multiple = false,
  onDark = false,
}: {
  value: string[];
  onChange: (next: CategoryId[]) => void;
  multiple?: boolean;
  onDark?: boolean;
}) {
  const selected = parseCategories(value);

  function toggle(id: CategoryId) {
    if (!multiple) {
      onChange([id]);
      return;
    }
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {CATEGORIES.map((c) => {
        const on = selected.includes(c.id);
        return (
          <Btn
            key={c.id}
            type="button"
            kind={on ? (onDark ? "paper" : "ink") : "line"}
            className="text-sm"
            onClick={() => toggle(c.id)}
          >
            {c.label}
          </Btn>
        );
      })}
    </div>
  );
}
