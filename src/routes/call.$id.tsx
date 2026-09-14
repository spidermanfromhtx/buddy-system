import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { AudioCall } from "@/components/audio-call";
import { Btn } from "@/components/btn";
import { Face } from "@/components/face";
import { PageWash } from "@/components/page-wash";
import { parseCallSearch } from "@/lib/call-search";
import { getCall, setCallStatus } from "@/lib/listings";
import { stopLocalStream } from "@/lib/media";
import { isPlus } from "@/lib/plan";
import { loadProfile } from "@/lib/profile";
import { pingBreak, playHangup } from "@/lib/ring";
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
  const pingRef = useRef<(() => void) | null>(null);
  const q = useQuery({
    queryKey: ["call", id],
    queryFn: () => getCall({ data: { id } }),
    enabled: !dummy,
    refetchInterval: 1000,
  });
  const name = search.name ?? (me && q.data?.callerId === me.id ? q.data?.calleeName : q.data?.callerName) ?? "Buddy";
  const color =
    search.color ?? (me && q.data?.callerId === me.id ? q.data?.calleeColor : q.data?.callerColor) ?? "#c45c3e";
  const photo = me && q.data?.callerId === me.id ? (q.data?.calleePhoto ?? null) : (q.data?.callerPhoto ?? null);
  const task = search.task ?? q.data?.task ?? "work";
  const lengthMin = search.lengthMin ?? q.data?.lengthMin ?? 25;
  const allowCamera = Boolean(search.allowCamera ?? q.data?.allowCamera);
  const [useCam, setUseCam] = useState(allowCamera);
  const room = search.room ?? q.data?.room;
  const breakEvery = (me?.breakEveryMin ?? 30) * 60;
  const startedAt = q.data?.startedAt ? Date.parse(q.data.startedAt) : null;

  useEffect(() => {
    if (dummy) {
      const t = setInterval(() => setSec((n) => n + 1), 1000);
      return () => clearInterval(t);
    }
    if (!startedAt) {
      setSec(0);
      return;
    }
    const tick = () => setSec(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [dummy, startedAt]);

  useEffect(() => {
    if (sec > 0 && breakEvery > 0 && sec - lastBreak.current >= breakEvery) {
      lastBreak.current = sec;
      pingRef.current?.();
      setBreakOn(true);
    }
  }, [sec, breakEvery]);
  useEffect(() => {
    if (!breakOn) return;
    pingBreak();
    const t = setInterval(pingBreak, 3500);
    return () => clearInterval(t);
  }, [breakOn]);
  useEffect(() => {
    if (!dummy && q.data?.status === "done") {
      stopLocalStream();
      void nav({ to: "/rate/$id", params: { id } });
    }
  }, [dummy, q.data?.status, nav, id]);

  async function markConnected() {
    if (!dummy && q.data?.status !== "live") await setCallStatus({ data: { id, status: "live" } });
  }
  async function hangup() {
    playHangup();
    await new Promise((r) => setTimeout(r, 450));
    stopLocalStream();
    if (room && me)
      void fetch("/api/rtc", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ op: "leave", room, peer: me.id }),
        keepalive: true,
      }).catch(() => {});
    if (!dummy) await setCallStatus({ data: { id, status: "done" } });
    if (dummy) void nav({ to: "/feed" });
    else void nav({ to: "/rate/$id", params: { id } });
  }

  return (
    <main className="relative z-10 flex min-h-dvh flex-col bg-transparent text-paper">
      <PageWash dark />
      <div className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-between px-5 py-8 sm:px-6 sm:py-10">
        <div className="flex w-full flex-col items-center text-center">
          <Face name={name} color={color} photo={photo} size="lg" />
          <p className="mt-5 text-sm uppercase tracking-[0.2em] text-paper/50">{task}</p>
          <h1 className="mt-2 font-display text-4xl tracking-tight sm:text-5xl">{name}</h1>
          <p className="mt-5 font-display text-6xl tabular-nums sm:text-7xl">{formatMmSs(sec)}</p>
          <p className="mt-1 text-base text-paper/50">{formatMmSs(lengthMin * 60)}</p>
        </div>
        <div className="w-full">
          {dummy && me ? (
            <AudioCall
              room="loop"
              selfId={me.id}
              name={me.name}
              wantCamera={allowCamera && useCam}
              allowCamera={allowCamera}
              onCamera={setUseCam}
              pingRef={pingRef}
              canShare={isPlus(me.plan)}
              onNudge={() => setBreakOn(true)}
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
              pingRef={pingRef}
              canShare={isPlus(me.plan)}
              onNudge={() => setBreakOn(true)}
              onCallConnected={() => void markConnected()}
            />
          ) : (
            <p className="text-center text-base text-paper/50">connecting</p>
          )}
          {breakOn ? (
            <div className="mt-6 rounded-3xl bg-paper p-5 text-ink">
              <p className="font-display text-xl">stretch</p>
              <p className="mt-1 text-base text-muted">stand up. 30 seconds. then back.</p>
              <Btn kind="fill" className="mt-4 h-12 w-full text-base" onClick={() => setBreakOn(false)}>
                still working
              </Btn>
            </div>
          ) : null}
          <div className="mt-8 flex flex-col gap-3">
            <Btn kind="fill" className="h-16 w-full text-xl" onClick={() => void hangup()}>
              Hang up
            </Btn>
            <Btn
              kind="night"
              className="h-12 w-full text-base"
              onClick={() => {
                pingRef.current?.();
                setBreakOn(true);
              }}
            >
              stretch ping
            </Btn>
          </div>
        </div>
      </div>
    </main>
  );
}
