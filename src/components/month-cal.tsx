import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Btn } from "@/components/btn";
import { cn, todayIso } from "@/lib/utils";

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function ymOf(value: string) {
  const [y, m] = value.split("-").map(Number);
  return { y: y || new Date().getFullYear(), m: m || new Date().getMonth() + 1 };
}

export function MonthCal({
  value,
  onChange,
  min,
}: {
  value: string;
  onChange: (next: string) => void;
  min?: string;
}) {
  const [{ y, m }, setYm] = useState(() => ymOf(value || todayIso()));

  useEffect(() => {
    setYm(ymOf(value || todayIso()));
  }, [value]);

  const cells = useMemo(() => {
    const first = new Date(y, m - 1, 1);
    const pad = first.getDay();
    const days = new Date(y, m, 0).getDate();
    const out: (string | null)[] = [];
    for (let i = 0; i < pad; i++) out.push(null);
    for (let d = 1; d <= days; d++) out.push(iso(y, m, d));
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [y, m]);

  const title = new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const today = todayIso();
  const floor = min ?? today;

  function shift(delta: number) {
    const dt = new Date(y, m - 1 + delta, 1);
    setYm({ y: dt.getFullYear(), m: dt.getMonth() + 1 });
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <Btn type="button" className="size-10 px-0" aria-label="previous month" onClick={() => shift(-1)}>
          <ChevronLeft className="size-5" />
        </Btn>
        <p className="font-display text-lg">{title}</p>
        <Btn type="button" className="size-10 px-0" aria-label="next month" onClick={() => shift(1)}>
          <ChevronRight className="size-5" />
        </Btn>
      </div>
      <div className="grid grid-cols-7 text-center text-xs text-muted">
        {DOW.map((d, i) => (
          <div key={`${d}${i}`} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} className="h-10" />;
          const past = day < floor;
          const selected = day === value;
          const isToday = day === today;
          return (
            <button
              key={day}
              type="button"
              disabled={past}
              aria-label={day}
              aria-pressed={selected}
              onClick={() => onChange(day)}
              className={cn(
                "h-11 w-full rounded-full text-sm",
                past && "text-muted",
                selected && "bg-ink text-paper",
                !selected && isToday && "border border-ink/30",
              )}
            >
              {Number(day.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
