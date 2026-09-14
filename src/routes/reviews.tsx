import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Btn } from "@/components/btn";
import { Mark } from "@/components/mark";
import { PageWash } from "@/components/page-wash";
import { leaveAppReview, listAppReviews } from "@/lib/trust";
import { loadProfile } from "@/lib/profile";

export const Route = createFileRoute("/reviews")({ component: Reviews });

type Sort = "new" | "high" | "low";

function Reviews() {
  const nav = useNavigate();
  const me = typeof window !== "undefined" ? loadProfile() : null;
  const q = useQuery({ queryKey: ["app-reviews"], queryFn: () => listAppReviews() });
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [note, setNote] = useState("");
  const [sort, setSort] = useState<Sort>("new");
  const save = useMutation({
    mutationFn: async () => {
      if (!me) throw new Error("Sign in first.");
      const res = await leaveAppReview({ data: { token: me.sessionToken, rating, body } });
      if (!res.ok) throw new Error("error" in res ? String(res.error) : "Could not save.");
      return res;
    },
    onSuccess: async () => {
      setBody("");
      setNote("Posted.");
      await q.refetch();
    },
    onError: (err) => setNote(err instanceof Error ? err.message : "Could not save."),
  });

  const rows = useMemo(() => {
    const list = [...(q.data ?? [])];
    if (sort === "high") list.sort((a, b) => b.rating - a.rating || b.createdAt.localeCompare(a.createdAt));
    else if (sort === "low") list.sort((a, b) => a.rating - b.rating || b.createdAt.localeCompare(a.createdAt));
    else list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return list;
  }, [q.data, sort]);

  return (
    <main className="relative isolate z-10 min-h-dvh bg-transparent text-ink">
      <PageWash />
      <header className="relative z-20 flex items-center justify-between gap-3 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:px-10">
        <div className="flex min-w-0 items-center gap-2">
          <Mark />
          <p className="truncate text-base font-semibold tracking-tight">Buddy System</p>
        </div>
        <Btn className="h-9 px-4 text-sm" onClick={() => void nav({ to: me ? "/feed" : "/" })}>
          {me ? "Feed" : "Home"}
        </Btn>
      </header>
      <div className="relative z-10 mx-auto flex w-full max-w-xl flex-col gap-6 px-5 pb-12 pt-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Reviews of the app</h1>
          <p className="mt-2 text-sm text-muted">
            What people think of Buddy System. Not a person. Not a call. Signed-in users can post anytime.
          </p>
        </div>
        {me ? (
          <form
            className="panel p-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <p className="text-sm font-medium">Leave a review of Buddy System</p>
            <p className="mt-1 text-xs text-muted">Stars plus a few words. You can change it later.</p>
            <div className="mt-3 flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <Btn key={n} type="button" kind={rating === n ? "fill" : "line"} className="h-10 flex-1 px-0" onClick={() => setRating(n)}>
                  {n}
                </Btn>
              ))}
            </div>
            <textarea
              className="mt-3 min-h-28 w-full rounded-2xl border-0 bg-paper/80 px-3 py-2 text-sm outline-none"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={280}
              placeholder="How has the app been for you?"
            />
            {note ? <p className="mt-2 text-sm text-muted">{note}</p> : null}
            <Btn type="submit" kind="fill" className="mt-3 h-11 w-full" disabled={save.isPending}>
              {save.isPending ? "Posting…" : "Post review"}
            </Btn>
          </form>
        ) : (
          <div className="panel p-4">
            <p className="text-sm">Sign in to leave a review of the app. You can still read the ones below.</p>
            <Link to="/" className="mt-3 inline-flex h-11 items-center rounded-full bg-rust px-5 text-sm font-medium text-on-rust">
              Sign in
            </Link>
          </div>
        )}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-[0.18em] text-muted">All reviews · {rows.length}</p>
            <div className="flex rounded-full bg-paper-2 p-0.5">
              {(
                [
                  ["new", "Newest"],
                  ["high", "Highest"],
                  ["low", "Lowest"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`rounded-full px-3 py-1.5 text-sm ${sort === id ? "bg-rust text-on-rust" : "text-muted"}`}
                  onClick={() => setSort(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <ul className="mt-2 flex flex-col gap-2">
            {q.isLoading ? (
              <li className="rounded-2xl bg-paper-2 px-4 py-6 text-sm text-muted">Loading reviews…</li>
            ) : rows.length === 0 ? (
              <li className="rounded-2xl bg-paper-2 px-4 py-6 text-sm text-muted">Nobody has reviewed the app yet. Be the first.</li>
            ) : (
              rows.map((r, i) => (
                <li key={`${r.createdAt}-${r.name}-${i}`} className="rounded-2xl bg-paper-2 px-4 py-3">
                  <p className="font-medium">
                    {r.name} · {r.rating}/5
                  </p>
                  {r.body ? <p className="mt-1 text-sm leading-snug">{r.body}</p> : null}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </main>
  );
}
