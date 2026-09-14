import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Face } from "@/components/face";
import { Mark } from "@/components/mark";
import { PageWash } from "@/components/page-wash";
import { listReviews } from "@/lib/trust";

export const Route = createFileRoute("/reviews")({ component: Reviews });

function Stars({ n }: { n: number }) {
  return <span className="tabular-nums">{n}/5</span>;
}

function Reviews() {
  const q = useQuery({ queryKey: ["reviews"], queryFn: () => listReviews() });
  const rows = q.data ?? [];
  return (
    <main className="relative z-10 min-h-dvh bg-transparent px-6 py-8 text-ink">
      <PageWash />
      <div className="relative z-10 mx-auto flex max-w-xl flex-col gap-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Mark />
            <div>
              <h1 className="font-display text-3xl tracking-tight">Hear from other buddies</h1>
              <p className="mt-1 text-sm text-muted">Anonymous ratings. Public so you can see who you might join.</p>
            </div>
          </div>
          <Link to="/feed" className="text-sm text-muted underline">
            Feed
          </Link>
        </div>
        <ul className="flex flex-col gap-2">
          {rows.length === 0 ? (
            <li className="rounded-2xl bg-paper-2 px-4 py-6 text-sm text-muted">No reviews yet. Rate someone after a call.</li>
          ) : (
            rows.map((r, i) => (
              <li key={`${r.createdAt}-${i}`} className="flex items-start gap-3 rounded-2xl bg-paper-2 px-4 py-3">
                <Face name={r.name} color={r.color} photo={r.photo} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {r.name} · <Stars n={r.rating} />
                  </p>
                  <p className="text-xs text-muted">From a buddy. Name hidden.</p>
                  {r.body ? <p className="mt-1 text-sm">{r.body}</p> : null}
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </main>
  );
}
