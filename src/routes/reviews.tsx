import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Btn } from "@/components/btn";
import { Mark } from "@/components/mark";
import { PageWash } from "@/components/page-wash";
import { leaveAppReview, listAppReviews } from "@/lib/trust";
import { loadProfile } from "@/lib/profile";

export const Route = createFileRoute("/reviews")({ component: Reviews });

function Reviews() {
  const me = typeof window !== "undefined" ? loadProfile() : null;
  const q = useQuery({ queryKey: ["app-reviews"], queryFn: () => listAppReviews() });
  const rows = q.data ?? [];
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [note, setNote] = useState("");
  const save = useMutation({
    mutationFn: async () => {
      if (!me) throw new Error("Sign in first.");
      const res = await leaveAppReview({ data: { token: me.sessionToken, rating, body } });
      if (!res.ok) throw new Error(res.error);
    },
    onSuccess: () => {
      setBody("");
      setNote("Saved. Thank you.");
      void q.refetch();
    },
    onError: (err) => setNote(err instanceof Error ? err.message : "Could not save."),
  });

  return (
    <main className="relative z-10 min-h-dvh bg-transparent px-6 py-8 text-ink">
      <PageWash />
      <div className="relative z-10 mx-auto flex max-w-xl flex-col gap-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Mark />
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Hear from other buddies</h1>
              <p className="mt-1 text-sm text-muted">Reviews of Buddy System. Not of people.</p>
            </div>
          </div>
          <Link to="/feed" className="text-sm text-muted underline">
            Feed
          </Link>
        </div>
        {me ? (
          <form
            className="rounded-2xl bg-paper-2 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <p className="text-sm font-medium">Leave a review</p>
            <div className="mt-3 flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <Btn key={n} type="button" kind={rating === n ? "fill" : "line"} className="h-10 flex-1 px-0" onClick={() => setRating(n)}>
                  {n}
                </Btn>
              ))}
            </div>
            <textarea
              className="mt-3 min-h-24 w-full rounded-xl border border-ink/10 bg-paper px-3 py-2 text-sm outline-none"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={280}
              placeholder="What was it like to use Buddy System?"
            />
            {note ? <p className="mt-2 text-sm text-muted">{note}</p> : null}
            <Btn kind="fill" className="mt-3 h-11 w-full" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Post review"}
            </Btn>
          </form>
        ) : (
          <p className="text-sm text-muted">Sign in to leave a review of the app.</p>
        )}
        <ul className="flex flex-col gap-2">
          {rows.length === 0 ? (
            <li className="rounded-2xl bg-paper-2 px-4 py-6 text-sm text-muted">No app reviews yet.</li>
          ) : (
            rows.map((r, i) => (
              <li key={`${r.createdAt}-${i}`} className="rounded-2xl bg-paper-2 px-4 py-3">
                <p className="font-medium">
                  {r.name} · {r.rating}/5
                </p>
                {r.body ? <p className="mt-1 text-sm">{r.body}</p> : null}
              </li>
            ))
          )}
        </ul>
      </div>
    </main>
  );
}
