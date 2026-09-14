import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Btn } from "@/components/btn";
import { Face } from "@/components/face";
import { PageWash } from "@/components/page-wash";
import { parseCallSearch } from "@/lib/call-search";
import { getCall, setCallStatus } from "@/lib/listings";
import { getLocalStream, unlockOutput } from "@/lib/media";
import { loadProfile } from "@/lib/profile";
import { armRing, startRing, stopRing } from "@/lib/ring";

export const Route = createFileRoute("/incoming/$id")({ validateSearch: (s) => parseCallSearch(s as Record<string, unknown>), component: Incoming });

function Incoming() {
  const { id } = Route.useParams(); const search = Route.useSearch(); const nav = useNavigate(); const dummy = Boolean(search.dummy) || id.startsWith("dummy-");
  const q = useQuery({ queryKey: ["call", id], queryFn: () => getCall({ data: { id } }), enabled: !dummy, refetchInterval: 1500 });
  const me = typeof window !== "undefined" ? loadProfile() : null;
  const bothRing = Boolean(search.bothRing ?? q.data?.bothRing);
  const other = me && q.data?.callerId === me.id ? { name: q.data.calleeName, color: q.data.calleeColor, photo: q.data.calleePhoto } : me && q.data?.calleeId === me.id ? { name: q.data.callerName, color: q.data.callerColor, photo: q.data.callerPhoto } : null;
  const name = other?.name ?? search.name ?? q.data?.callerName ?? "Buddy";
  const color = other?.color ?? search.color ?? q.data?.callerColor ?? "#c45c3e";
  const photo = other?.photo ?? q.data?.callerPhoto ?? null;
  const task = search.task ?? q.data?.task ?? "work"; const lengthMin = search.lengthMin ?? q.data?.lengthMin ?? 25; const urgent = search.urgent ?? false;
  const allowCamera = Boolean(search.allowCamera ?? q.data?.allowCamera); const [useCam, setUseCam] = useState(allowCamera);
  const ringingYou = bothRing || (!dummy && !!q.data && !!me && q.data.calleeId === me.id);
  useEffect(() => { if (!ringingYou && !bothRing && !dummy) return; void armRing().then(startRing); return () => stopRing(); }, [ringingYou, bothRing, dummy]);
  useEffect(() => { if (dummy) return; if (q.data?.status === "declined" || q.data?.status === "done") { stopRing(); void nav({ to: "/feed" }); } }, [dummy, q.data?.status, nav]);
  async function answer() {
    stopRing();
    try {
      await getLocalStream(allowCamera && useCam);
    } catch {
      // call page will ask again
    }
    void unlockOutput();
    void nav({
      to: "/call/$id",
      params: { id },
      search: { ...search, camera: allowCamera && useCam, allowCamera, room: search.room ?? q.data?.room },
    });
  }
  async function decline() { stopRing(); if (!dummy) await setCallStatus({ data: { id, status: "declined" } }); void nav({ to: "/feed" }); }
  return <main className="relative z-10 flex min-h-dvh flex-col bg-transparent text-paper"><PageWash dark /><div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-12 text-center"><p className="text-xs uppercase tracking-[0.22em] text-paper/50">{dummy ? "demo ring" : ringingYou || bothRing ? "incoming" : "calling"}</p><div className="mt-10"><Face name={name} color={color} photo={photo} size="lg" ringing /></div><h1 className="mt-8 font-display text-5xl tracking-tight">{name}</h1><p className="mt-3 text-lg text-paper/80">{task}</p><p className="mt-2 text-sm text-paper/50">{urgent ? "urgent · " : ""}{lengthMin} min{allowCamera ? " · camera available" : ""}</p>{allowCamera ? <div className="mt-8 flex w-full gap-2"><Btn type="button" kind={!useCam ? "fill" : "night"} className="flex-1" onClick={() => setUseCam(false)}>Audio only</Btn><Btn type="button" kind={useCam ? "fill" : "night"} className="flex-1" onClick={() => setUseCam(true)}>Camera</Btn></div> : null}<div className="mt-12 flex w-full flex-col gap-2"><Btn kind="fill" className="h-14 w-full text-lg" onClick={() => void answer()}>Answer</Btn><Btn kind="night" className="h-12 w-full" onClick={() => void decline()}>Decline</Btn></div></div></main>;
}
