import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Btn } from "@/components/btn";
import { Face } from "@/components/face";
import { PageWash } from "@/components/page-wash";
import { getCall } from "@/lib/listings";
import { loadProfile } from "@/lib/profile";
import { fileReport, leaveReview } from "@/lib/trust";

export const Route = createFileRoute("/rate/$id")({ component: Rate });

function Rate() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const me = typeof window !== "undefined" ? loadProfile() : null;
  const q = useQuery({ queryKey: ["call", id], queryFn: () => getCall({ data: { id } }) });
  const call = q.data;
  const other =
    me && call
      ? me.id === call.callerId
        ? { id: call.calleeId, name: call.calleeName, color: call.calleeColor, photo: call.calleePhoto }
        : { id: call.callerId, name: call.callerName, color: call.callerColor, photo: call.callerPhoto }
      : null;
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [report, setReport] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!me || !other) return;
    setBusy(true);
    setNote("");
    try {
      const rev = await leaveReview({
        data: { token: me.sessionToken, subjectId: other.id, callId: id, rating, body },
      });
      if (!rev.ok) {
        setNote(rev.error);
        setBusy(false);
        return;
      }
      if (report.trim().length >= 8) {
        const rep = await fileReport({
          data: { token: me.sessionToken, subjectId: other.id, callId: id, body: report },
        });
        if (!rep.ok) {
          setNote(rep.error);
          setBusy(false);
          return;
        }
      }
      void nav({ to: "/feed" });
    } catch {
      setNote("Could not save that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative z-10 min-h-dvh bg-transparent px-6 pb-10 pt-12 text-ink">
      <PageWash />
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-6">
        <h1 className="text-3xl font-semibold tracking-tight">How was that call?</h1>
        <p className="text-sm text-muted">
          This is only about this person. To review Buddy System itself, use{" "}
          <button type="button" className="underline" onClick={() => void nav({ to: "/reviews" })}>
            Reviews of the app
          </button>
          .
        </p>
        {other ? (
          <div className="flex items-center gap-3">
            <Face name={other.name} color={other.color} photo={other.photo} size="sm" />
            <p>{other.name}</p>
          </div>
        ) : (
          <p className="text-sm text-muted">Loading the call…</p>
        )}
        <fieldset>
          <legend className="text-sm font-medium">Anonymous rating. They will not see it was you.</legend>
          <div className="mt-3 flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <Btn key={n} type="button" kind={rating === n ? "fill" : "line"} className="h-10 flex-1 px-0" onClick={() => setRating(n)}>
                {n}
              </Btn>
            ))}
          </div>
        </fieldset>
        <label className="text-sm font-medium">
          Optional note
          <textarea
            className="mt-2 min-h-20 w-full rounded-xl border border-ink/10 bg-paper px-3 py-2 font-normal outline-none"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={280}
            placeholder="Kept the call. Showed up."
          />
        </label>
        <label className="text-sm font-medium">
          Report this call or person
          <p className="mt-1 text-xs font-normal text-muted">
            Optional. We read the words. Harm language can close an account. Other reports can send a warning. We do not name you.
          </p>
          <textarea
            className="mt-2 min-h-24 w-full rounded-xl border border-ink/10 bg-paper px-3 py-2 font-normal outline-none"
            value={report}
            onChange={(e) => setReport(e.target.value)}
            maxLength={800}
            placeholder="What happened."
          />
        </label>
        {note ? <p className="text-sm text-rust">{note}</p> : null}
        <Btn kind="fill" disabled={busy || !other} onClick={() => void submit()}>
          {busy ? "Saving…" : "Done"}
        </Btn>
        <Btn onClick={() => void nav({ to: "/feed" })}>Skip</Btn>
      </div>
    </main>
  );
}
