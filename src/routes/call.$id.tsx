import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { AudioCall } from "@/components/audio-call";
import { Btn } from "@/components/btn";
import { Face } from "@/components/face";
import { parseCallSearch } from "@/lib/call-search";
import { getCall, setCallStatus } from "@/lib/listings";
import { stopLocalStream } from "@/lib/media";
import { loadProfile } from "@/lib/profile";
import { formatMmSs } from "@/lib/utils";

export const Route = createFileRoute("/call/$id")({
  validateSearch: (s) => parseCallSearch(s as Record<string, unknown>),
  component: CallScreen,
});

function CallScreen() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const nav = useNavigate();
  const dummy = Boolean(search.dummy) || id.startsWith("dummy-");
  const me = typeof window !== "undefined" ? loadProfile() : null;
  const [sec, setSec] = useState(0);
  const [breakOn, setBreakOn] = useState(false);
  const lastBreak = useRef(0);

  const q = useQuery({
    queryKey: ["call", id],
    queryFn: () => getCall({ data: { id } }),
    enabled: !dummy,
    refetchInterval: 3000,
  });

  const name = search.name ?? (me && q.data?.callerId === me.id ? q.data?.calleeName : q.data?.callerName) ?? "Buddy";
  const color =
    search.color ?? (me && q.data?.callerId === me.id ? q.data?.calleeColor : q.data?.callerColor) ?? "#c45c3e";
  const photo =
    me && q.data?.callerId === me.id ? (q.data?.calleePhoto ?? null) : (q.data?.callerPhoto ?? null);
  const task = search.task ?? q.data?.task ?? "work";
  const lengthMin = search.lengthMin ?? q.data?.lengthMin ?? 25;
  const allowCamera = Boolean(search.allowCamera ?? q.data?.allowCamera);
  const [useCam, setUseCam] = useState(Boolean(search.camera) && allowCamera);
  const room = search.room ?? q.data?.room;
  const breakEvery = (me?.breakEveryMin ?? 30) * 60;

  useEffect(() => {
    const t = setInterval(() => setSec((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (sec > 0 && breakEvery > 0 && sec - lastBreak.current >= breakEvery) {
      lastBreak.current = sec;
      setBreakOn(true);
    }
  }, [sec, breakEvery]);

  useEffect(() => {
    if (!dummy && q.data?.status === "done") {
      stopLocalStream();
      void nav({ to: "/feed" });
    }
  }, [dummy, q.data?.status, nav]);

  async function hangup() {
    stopLocalStream();
    if (room && me) {
      void fetch("/api/rtc", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ op: "leave", room, peer: me.id }),
        keepalive: true,
      }).catch(() => {});
    }
    if (!dummy) await setCallStatus({ data: { id, status: "done" } });
    void nav({ to: "/feed" });
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-12 text-center">
      <div className="flex w-full max-w-md flex-col items-center px-6 py-12 md:px-10">
        {useCam ? null : <Face name={name} color={color} photo={photo} size="lg" />}
        <h1 className="mt-6 font-display text-4xl tracking-tight">{name}</h1>
        <p className="mt-3 text-lg">{task}</p>
        <p className="mt-4 font-display text-3xl tabular-nums text-muted">
          {formatMmSs(sec)} / {formatMmSs(lengthMin * 60)}
        </p>
        <div className="mt-6 w-full">
          {dummy && me ? (
            <AudioCall
              room="loop"
              selfId={me.id}
              name={me.name}
              wantCamera={allowCamera && useCam}
              allowCamera={allowCamera}
              onCamera={setUseCam}
              loopback
            />
          ) : !dummy && room && me ? (
            <AudioCall
              room={room}
              selfId={me.id}
              name={me.name}
              wantCamera={allowCamera && useCam}
              allowCamera={allowCamera}
              onCamera={setUseCam}
            />
          ) : (
            <p className="text-sm text-muted">connecting</p>
          )}
        </div>
        {breakOn ? (
          <div className="mt-8 w-full rounded-2xl bg-paper-2 p-5 text-ink">
            <p className="font-display text-lg">stretch</p>
            <p className="mt-1 text-sm">stand up. 30 seconds. then back.</p>
            <Btn kind="ink" className="mt-4 h-10 w-full" onClick={() => setBreakOn(false)}>
              still working
            </Btn>
          </div>
        ) : null}
        <div className="mt-10 flex w-full flex-col gap-2">
          <Btn kind="fill" className="h-14 w-full text-lg" onClick={() => void hangup()}>
            Hang up
          </Btn>
          <Btn className="w-full" onClick={() => setBreakOn(true)}>
            stretch ping
          </Btn>
        </div>
      </div>
    </main>
  );
}
