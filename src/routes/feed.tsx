import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Btn } from "@/components/btn";
import { CategoryPicker } from "@/components/category-picker";
import { Face } from "@/components/face";
import { LookFields } from "@/components/look-fields";
import { Mark } from "@/components/mark";
import { MonthCal } from "@/components/month-cal";
import { CampusVerify } from "@/components/campus-verify";
import { JoinForm } from "@/components/join-form";
import { readAccount, saveAccount, startPlusCheckout } from "@/lib/account";
import { categoryLabel } from "@/lib/categories";
import { FREE_MAX_MIN, FREE_SESSIONS, PLUS_PRICE_LABEL, isPlus, maxSessionMin, sessionsLeft } from "@/lib/plan";
import {
  bookWindow,
  closeLive,
  incomingFor,
  listOpen,
  stampSchool,
  startCall,
  upsertLive,
  type Listing,
} from "@/lib/listings";
import { clearProfile, loadProfile, profileFromAccount, saveProfile, type Profile } from "@/lib/profile";
import { getLocalStream, micHint, unlockOutput } from "@/lib/media";
import { formatDue, formatWindow, newId, todayIso, windowRange } from "@/lib/utils";
import { armRing } from "@/lib/ring";

export const Route = createFileRoute("/feed")({ component: Feed });

function minutesLeft(iso: string | null) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.ceil(ms / 60_000));
}

function Card({
  name,
  color,
  photo,
  task,
  urgent,
  dueDate,
  lengthMin,
  extra,
  category,
  offerCamera,
  action,
}: {
  name: string;
  color: string;
  photo?: string | null;
  task: string;
  urgent: boolean;
  dueDate?: string | null;
  lengthMin: number;
  extra?: string;
  category?: string | null;
  offerCamera?: boolean;
  action: ReactNode;
}) {
  const due = formatDue(dueDate);
  const bits = [
    `${lengthMin} min`,
    category ? categoryLabel(category) : "",
    offerCamera ? "camera" : "",
    due,
    extra,
  ].filter(Boolean);
  return (
    <li className="flex flex-col rounded-3xl bg-paper-2 p-5">
      <div className="flex items-start gap-4">
        <Face name={name} color={color} photo={photo} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-2xl leading-tight tracking-tight">{task}</p>
          <p className="mt-1 text-sm text-muted">{name}</p>
        </div>
        {urgent ? (
          <span className="shrink-0 rounded-full bg-rust px-2.5 py-1 text-xs font-medium text-on-rust">urgent</span>
        ) : null}
      </div>
      {bits.length ? (
        <p className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
          {bits.map((b) => (
            <span key={b} className="rounded-full bg-paper px-2.5 py-1">
              {b}
            </span>
          ))}
        </p>
      ) : null}
      <div className="mt-4">{action}</div>
    </li>
  );
}

function Feed() {
  const nav = useNavigate();
  const [me, setMe] = useState<Profile | null>(null);
  const [sheet, setSheet] = useState<"none" | "open" | "book" | "settings">("none");
  const [task, setTask] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [lengthMin, setLengthMin] = useState(25);
  const [camera, setCamera] = useState(false);
  const [windowDate, setWindowDate] = useState(todayIso);
  const [windowStart, setWindowStart] = useState("20:00");
  const [windowEnd, setWindowEnd] = useState("22:00");
  const [similar, setSimilar] = useState<"similar" | "different" | "either">("either");
  const [dueDate, setDueDate] = useState("");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [liveId, setLiveId] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | "school">("all");
  const [feedCat, setFeedCat] = useState("");
  const [pane, setPane] = useState<"live" | "book">("live");

  useEffect(() => {
    const p = loadProfile();
    if (p) {
      setMe(p);
      if (p.categories[0]) setCategory(p.categories[0]);
    }
  }, []);

  useEffect(() => {
    if (!me?.sessionToken) return;
    void readAccount({ data: { token: me.sessionToken } }).then((res) => {
      if (!res.ok) return;
      setMe(
        profileFromAccount(res.account, {
          school: me.school,
          schoolEmail: me.schoolEmail,
          schoolVerified: me.schoolVerified,
          campusToken: me.campusToken,
        }),
      );
    });
  }, [me?.sessionToken]);

  const q = useQuery({
    queryKey: ["listings", tab, me?.schoolVerified ? me.school : "none"],
    queryFn: () =>
      listOpen({
        data: {
          tab,
          peerId: me?.id,
          token: me?.campusToken ?? undefined,
        },
      }),
    refetchInterval: 2000,
    enabled: !!me,
  });

  useEffect(() => {
    if (!me) return;
    const t = setInterval(() => {
      void incomingFor({ data: { peerId: me.id } }).then((row) => {
        if (!row) return;
        const youAreCaller = row.callerId === me.id;
        void armRing();
        void nav({
          to: "/incoming/$id",
          params: { id: row.id },
          search: {
            dummy: false,
            name: youAreCaller ? row.calleeName : row.callerName,
            color: youAreCaller ? row.calleeColor : row.callerColor,
            task: row.task,
            lengthMin: row.lengthMin,
            room: row.room,
            allowCamera: row.allowCamera,
            bothRing: row.bothRing,
          },
        });
      });
    }, 2500);
    return () => clearInterval(t);
  }, [me, nav]);

  const scoped = useMemo(() => {
    let rows = q.data ?? [];
    if (tab === "school") {
      if (!me?.school) return [];
      const campus = me.school.toLowerCase();
      rows = rows.filter((l) => (l.school || "").toLowerCase() === campus);
    }
    if (feedCat) {
      rows = rows.filter((l) => l.category === feedCat || l.peerId === me?.id);
    }
    return rows;
  }, [q.data, tab, me?.school, me?.id, feedCat]);

  const live = useMemo(() => {
    return scoped
      .filter((l) => l.mode === "live")
      .sort((a, b) => {
        if (a.peerId === me?.id) return -1;
        if (b.peerId === me?.id) return 1;
        return Number(b.urgent) - Number(a.urgent);
      });
  }, [scoped, me]);

  const scheduled = useMemo(
    () => scoped.filter((l) => l.mode === "scheduled" && l.peerId === me?.id),
    [scoped, me],
  );

  const mine = (q.data ?? []).find((l) => l.peerId === me?.id && l.mode === "live");

  useEffect(() => {
    if (mine?.id) setLiveId(mine.id);
  }, [mine?.id]);

  const goOpen = useMutation({
    mutationFn: async () => {
      if (!me) return;
      if (!task.trim()) throw new Error("Write a one-line task first.");
      try {
        await getLocalStream(camera);
      } catch (e) {
        throw new Error(micHint(e));
      }
      void unlockOutput();
      const id = liveId ?? newId("live");
      setLiveId(id);
      return upsertLive({
        data: {
          id,
          peerId: me.id,
          name: me.name,
          color: me.color,
          photo: me.photo ?? undefined,
          task: task.trim(),
          urgent,
          lengthMin,
          camera,
          dueDate: dueDate || undefined,
          school: me.school ?? undefined,
          category: category || undefined,
        },
      }).then((res) => {
        if (res && "ok" in res && res.ok === false) throw new Error(res.error);
        return res;
      });
    },
    onSuccess: (res) => {
      if (res && "usedSession" in res && res.usedSession && me && !isPlus(me.plan)) {
        setMe(saveProfile({ ...me, sessionsUsed: me.sessionsUsed + 1 }));
      }
      setSheet("none");
      void q.refetch();
    },
    onError: (err) => {
      setNote(err instanceof Error ? err.message : "could not go live");
    },
  });

  const refreshLive = useMutation({
    mutationFn: async () => {
      if (!me || !mine) return;
      await upsertLive({
        data: {
          id: mine.id,
          peerId: me.id,
          name: me.name,
          color: me.color,
          photo: me.photo ?? undefined,
          task: mine.task,
          urgent: mine.urgent,
          lengthMin: mine.lengthMin,
          camera: mine.camera,
          dueDate: mine.dueDate ?? undefined,
          school: me.school ?? undefined,
          category: mine.category ?? undefined,
        },
      });
    },
    onSuccess: () => void q.refetch(),
  });

  const goBook = useMutation({
    mutationFn: async () => {
      if (!me || !task.trim()) return;
      const range = windowRange(windowDate, windowStart, windowEnd);
      const id = newId("book");
      await armRing();
      return bookWindow({
        data: {
          id,
          peerId: me.id,
          name: me.name,
          color: me.color,
          photo: me.photo ?? undefined,
          task: task.trim(),
          urgent,
          lengthMin,
          camera,
          similarPref: similar,
          windowLabel: formatWindow(windowDate, windowStart, windowEnd),
          windowStart: range.start,
          windowEnd: range.end,
          dueDate: dueDate || undefined,
          school: me.school ?? undefined,
          category: category || undefined,
        },
      }).then((res) => {
        if (res && "ok" in res && res.ok === false) throw new Error(res.error);
        return res;
      });
    },
    onSuccess: (res) => {
      const range = windowRange(windowDate, windowStart, windowEnd);
      const start = Date.parse(range.start);
      const mins = Math.max(0, Math.round((start - Date.now()) / 60000));
      const when =
        mins <= 0 ? "now" : mins < 60 ? `in ${mins} min` : `in ${Math.round(mins / 60)} hr`;
      setNote(
        res?.matched
          ? `matched with ${res.matched.name}. rings ${when}.`
          : `booked. waiting for a match. rings ${when} if someone overlaps.`,
      );
      if (me && !isPlus(me.plan)) setMe(saveProfile({ ...me, sessionsUsed: me.sessionsUsed + 1 }));
      setSheet("none");
      void q.refetch();
    },
    onError: (err) => {
      setNote(err instanceof Error ? err.message : "could not book");
    },
  });

  async function call(row: Listing) {
    if (!me) return;
    if (row.peerId === me.id) return;
    try {
      await getLocalStream(false);
    } catch (e) {
      setNote(micHint(e));
      return;
    }
    void unlockOutput();
    void armRing();
    const id = newId("call");
    const room = `r${id.replace(/-/g, "").slice(0, 20)}`;
    const started = await startCall({
      data: {
        id,
        room,
        callerId: me.id,
        calleeId: row.peerId,
        callerName: me.name,
        calleeName: row.name,
        callerColor: me.color,
        calleeColor: row.color,
        callerPhoto: me.photo ?? undefined,
        calleePhoto: row.photo ?? undefined,
        task: row.task,
        lengthMin: row.lengthMin,
        allowCamera: row.camera,
      },
    });
    if (started && "ok" in started && started.ok === false) {
      setNote("error" in started ? started.error : "Could not start the call.");
      return;
    }
    if (me && !isPlus(me.plan)) setMe(saveProfile({ ...me, sessionsUsed: me.sessionsUsed + 1 }));
    void nav({
      to: "/call/$id",
      params: { id },
      search: {
        dummy: false,
        name: row.name,
        color: row.color,
        task: row.task,
        camera: false,
        allowCamera: row.camera,
        room,
        lengthMin: row.lengthMin,
      },
    });
  }

  if (!me) return <JoinForm onJoined={setMe} />;

  const remain = minutesLeft(mine?.expiresAt ?? null);
  const cap = maxSessionMin(me.plan, me.limitsOn);
  const left = sessionsLeft(me.plan, me.sessionsUsed, me.limitsOn);
  const plus = isPlus(me.plan);
  const limits = me.limitsOn;

  function onCampusVerified(info: { school: string; email: string; token: string }) {
    if (!me) return;
    const next = saveProfile({
      ...me,
      schoolEmail: info.email,
      school: info.school,
      schoolVerified: true,
      campusToken: info.token,
    });
    setMe(next);
    setTab("school");
    void stampSchool({ data: { peerId: me.id } }).then(() => q.refetch());
  }

  function closeMe() {
    if (!me) return;
    void closeLive({ data: { peerId: me.id } }).then(() => q.refetch());
    setLiveId(null);
  }

  async function share() {
    const url = window.location.origin;
    const payload = { title: "Buddy System", text: "Need a body double. Open this and join.", url };
    try {
      if (navigator.share) {
        await navigator.share(payload);
        return;
      }
      await navigator.clipboard.writeText(url);
      setNote("link copied. open it on your other device as someone else.");
    } catch {
      setNote(url);
    }
  }

  const bookFields = (prefix: string) => (
    <div id={`book-${prefix}`} className="flex flex-col">
      <p className="font-display text-3xl tracking-tight">Book</p>
      <p className="mt-2 text-sm text-muted">Pick a day. We match you. The call rings.</p>
      <div className="mt-6 flex flex-col gap-6">
        <div>
          <p className="text-sm font-medium">Date</p>
          <p className="mt-1 text-xs text-muted">Tap a day. Past days are closed.</p>
          <div className="mt-3">
            <MonthCal value={windowDate} onChange={setWindowDate} />
          </div>
          <p className="mt-3 text-sm">{formatWindow(windowDate, windowStart, windowEnd)}</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-2 text-sm font-medium" htmlFor={`${prefix}-start`}>
            Start time
            <input
              id={`${prefix}-start`}
              type="time"
              className="h-11 rounded-xl border border-ink/10 bg-paper px-3 font-normal text-ink outline-none"
              value={windowStart}
              onChange={(e) => setWindowStart(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium" htmlFor={`${prefix}-end`}>
            End time
            <input
              id={`${prefix}-end`}
              type="time"
              className="h-11 rounded-xl border border-ink/10 bg-paper px-3 font-normal text-ink outline-none"
              value={windowEnd}
              onChange={(e) => setWindowEnd(e.target.value)}
            />
          </label>
        </div>
        <label className="flex flex-col gap-2 text-sm font-medium" htmlFor={`${prefix}-task`}>
          Task description
          <input
            id={`${prefix}-task`}
            placeholder="finish the email"
            className="h-11 rounded-xl border border-ink/10 bg-paper px-3 font-normal outline-none"
            value={task}
            onChange={(e) => setTask(e.target.value)}
          />
          <span className="text-xs font-normal text-muted">One line. Not an assignment.</span>
        </label>
        <fieldset>
          <legend className="text-sm font-medium">Category</legend>
          <p className="mt-1 text-xs text-muted">What kind of task this is. Matching uses this.</p>
          <CategoryPicker value={category ? [category] : []} onChange={(ids) => setCategory(ids[0] ?? "")} />
        </fieldset>
        <div className="grid grid-cols-2 gap-6">
          <fieldset>
            <legend className="text-sm font-medium">Camera</legend>
            <p className="mt-1 text-xs text-muted">On or off for this window.</p>
            <div className="mt-3 flex gap-2">
              <Btn type="button" kind={!camera ? "ink" : "line"} className="flex-1" onClick={() => setCamera(false)}>
                Off
              </Btn>
              <Btn type="button" kind={camera ? "ink" : "line"} className="flex-1" onClick={() => setCamera(true)}>
                On
              </Btn>
            </div>
          </fieldset>
          <label className="flex flex-col justify-end gap-2 text-sm font-medium">
            <span className="flex h-11 items-center gap-2">
              <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} />
              This is urgent
            </span>
          </label>
        </div>
        <label className="text-sm font-medium" htmlFor={`${prefix}-length`}>
          Call length
          <p className="mt-1 text-xs font-normal text-muted">{lengthMin} minutes</p>
          <input
            id={`${prefix}-length`}
            type="range"
            min={5}
            max={cap}
            value={lengthMin}
            className="mt-3 w-full"
            onChange={(e) => setLengthMin(Number(e.target.value))}
          />
        </label>
        <fieldset>
          <legend className="text-sm font-medium">Match with</legend>
          <p className="mt-1 text-xs text-muted">Someone in the same category, a different one, or either.</p>
          <div className="mt-3 flex gap-2 text-sm">
            {(["similar", "different", "either"] as const).map((v) => (
              <Btn
                key={v}
                type="button"
                kind={similar === v ? "ink" : "line"}
                className="flex-1"
                onClick={() => setSimilar(v)}
              >
                {v}
              </Btn>
            ))}
          </div>
        </fieldset>
        <Btn kind="fill" className="h-12 w-full" onClick={() => goBook.mutate()}>
          Book
        </Btn>
      </div>
    </div>
  );

  const liveOn = Boolean(mine);

  const compose = (
    <div className="rounded-3xl bg-night p-4 text-paper">
      <input
        placeholder="finish the email"
        className="h-12 w-full bg-transparent text-lg text-paper outline-none placeholder:text-paper/40"
        value={task}
        onChange={(e) => setTask(e.target.value)}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={urgent ? "rounded-full bg-rust px-3 py-1 text-sm text-on-rust" : "rounded-full bg-paper/10 px-3 py-1 text-sm"}
          onClick={() => setUrgent((v) => !v)}
        >
          urgent
        </button>
        <button
          type="button"
          className={camera ? "rounded-full bg-rust px-3 py-1 text-sm text-on-rust" : "rounded-full bg-paper/10 px-3 py-1 text-sm"}
          onClick={() => setCamera((v) => !v)}
        >
          camera
        </button>
        <span className="rounded-full bg-paper/10 px-3 py-1 text-sm">{lengthMin} min</span>
        <input
          type="range"
          min={5}
          max={cap}
          value={lengthMin}
          className="min-w-24 flex-1"
          onChange={(e) => setLengthMin(Number(e.target.value))}
        />
        {liveOn ? (
          <Btn kind="paper" className="ml-auto h-11" onClick={closeMe}>
            End live
          </Btn>
        ) : (
          <Btn kind="fill" className="ml-auto h-11" disabled={goOpen.isPending} onClick={() => goOpen.mutate()}>
            {goOpen.isPending ? "…" : "Go live"}
          </Btn>
        )}
      </div>
      {note ? <p className="mt-3 text-sm text-paper/70">{note}</p> : null}
    </div>
  );

  const liveBoard = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex gap-6 border-b border-ink/10">
        <button
          type="button"
          className={`border-b-2 pb-3 text-sm font-medium ${tab === "all" ? "border-rust text-ink" : "border-transparent text-muted"}`}
          onClick={() => setTab("all")}
        >
          Main
        </button>
        <button
          type="button"
          className={`border-b-2 pb-3 text-sm font-medium ${tab === "school" ? "border-rust text-ink" : "border-transparent text-muted"}`}
          onClick={() => setTab("school")}
        >
          University
        </button>
      </div>
      {tab === "school" && !me.schoolVerified ? (
        <div className="mt-8 max-w-md">
          <p className="font-display text-3xl tracking-tight">Your campus</p>
          <p className="mt-3 text-base text-muted">
            Add a school email in Settings. We send a 6-digit code. Then this only shows people from that campus.
          </p>
          <Btn kind="fill" className="mt-6" onClick={() => setSheet("settings")}>
            Open settings
          </Btn>
        </div>
      ) : (
        <>
          <div className="mt-5">
            <CategoryPicker allowAll value={feedCat ? [feedCat] : []} onChange={(ids) => setFeedCat(ids[0] ?? "")} />
          </div>
          <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {live.length === 0 ? (
              <li className="rounded-3xl bg-paper-2 p-8 text-base text-muted sm:col-span-2">
                {tab === "school"
                  ? `Nobody from ${me.school} is live${feedCat ? ` in ${categoryLabel(feedCat)}` : ""}.`
                  : `Nobody live${feedCat ? ` in ${categoryLabel(feedCat)}` : ""}. Write a one-liner and go live.`}
              </li>
            ) : null}
            {live.map((row) => {
              const isYou = row.peerId === me.id;
              return (
                <Card
                  key={row.id}
                  name={row.name}
                  color={row.color}
                  photo={isYou ? me.photo : row.photo}
                  task={row.task}
                  urgent={row.urgent}
                  dueDate={row.dueDate}
                  lengthMin={row.lengthMin}
                  category={row.category}
                  offerCamera={row.camera}
                  extra={
                    isYou
                      ? `you · live${remain !== null ? ` · ${remain}m left` : ""}`
                      : row.school && tab === "all"
                        ? row.school
                        : undefined
                  }
                  action={
                    isYou ? (
                      <Btn className="w-full" onClick={() => refreshLive.mutate()}>
                        still open
                      </Btn>
                    ) : (
                      <Btn kind="fill" className="w-full" onClick={() => void call(row)}>
                        Call
                      </Btn>
                    )
                  }
                />
              );
            })}
          </ul>
        </>
      )}
    </div>
  );

  return (
    <main className="flex min-h-dvh flex-col bg-paper text-ink">
      <header className="flex items-center justify-between gap-4 px-5 py-4 md:px-8">
        <div className="flex items-center gap-3">
          <Mark className="size-10" />
          <div>
            <h1 className="font-display text-2xl tracking-tight">Buddy System</h1>
            <p className="text-xs text-muted">
              {plus ? "Plus" : limits ? `${left} left this week` : "R&D"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-full bg-paper-2 p-1 md:hidden">
            <button
              type="button"
              className={`rounded-full px-3 py-1.5 text-sm ${pane === "live" ? "bg-rust text-on-rust" : "text-muted"}`}
              onClick={() => setPane("live")}
            >
              Live
            </button>
            <button
              type="button"
              className={`rounded-full px-3 py-1.5 text-sm ${pane === "book" ? "bg-rust text-on-rust" : "text-muted"}`}
              onClick={() => setPane("book")}
            >
              Book
            </button>
          </div>
          <Btn className="h-10 text-sm" onClick={() => void share()}>
            Share
          </Btn>
          <button type="button" onClick={() => setSheet("settings")} aria-label="Settings">
            <Face name={me.name} color={me.color} photo={me.photo} size="sm" />
          </button>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-0 md:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
        <section className={`flex min-h-0 flex-col px-5 pb-6 md:px-8 ${pane === "book" ? "hidden md:flex" : "flex"}`}>
          {liveBoard}
          <div className="mt-6">{compose}</div>
        </section>
        <aside
          className={`min-w-0 overflow-y-auto bg-paper-2 px-5 py-6 md:px-8 ${pane === "live" ? "hidden md:block" : "block"}`}
        >
          {bookFields("side")}
          <div className="mt-10">
            <p className="text-xs uppercase tracking-[0.18em] text-muted">Your windows</p>
            <ul className="mt-4 flex flex-col gap-3">
              {scheduled.length === 0 ? (
                <li className="text-sm text-muted">None yet.</li>
              ) : (
                scheduled.map((row) => (
                  <Card
                    key={row.id}
                    name={row.name}
                    color={row.color}
                    photo={row.photo}
                    task={row.task}
                    urgent={row.urgent}
                    dueDate={row.dueDate}
                    lengthMin={row.lengthMin}
                    category={row.category}
                    offerCamera={row.camera}
                    extra={[row.windowLabel, row.matchPeerName ? `matched · ${row.matchPeerName}` : "waiting"]
                      .filter(Boolean)
                      .join(" · ")}
                    action={<span className="text-sm text-muted">window</span>}
                  />
                ))
              )}
            </ul>
          </div>
        </aside>
      </div>

      {sheet === "settings" ? (
        <div className="fixed inset-0 z-30 flex items-end bg-night/50 md:items-center md:justify-center" onClick={() => setSheet("none")}>
          <div
            className="w-full max-h-dvh overflow-y-auto rounded-t-3xl bg-paper p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-ink md:max-w-lg md:rounded-3xl md:p-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between gap-3">
                <p className="font-display text-xl">Settings</p>
                <Btn onClick={() => setSheet("none")}>Close</Btn>
              </div>
              <LookFields
                name={me.name}
                color={me.color}
                photo={me.photo}
                onColor={(c) => {
                  const next = saveProfile({ ...me, color: c });
                  setMe(next);
                  void saveAccount({ data: { token: me.sessionToken, color: c } });
                  if (mine) {
                    void upsertLive({
                      data: {
                        id: mine.id,
                        peerId: me.id,
                        name: next.name,
                        color: next.color,
                        photo: next.photo ?? undefined,
                        task: mine.task,
                        urgent: mine.urgent,
                        lengthMin: mine.lengthMin,
                        camera: mine.camera,
                        dueDate: mine.dueDate ?? undefined,
                        school: next.school ?? undefined,
                        category: mine.category ?? undefined,
                      },
                    }).then(() => q.refetch());
                  }
                }}
                onPhoto={(p) => {
                  const next = saveProfile({ ...me, photo: p });
                  setMe(next);
                  void saveAccount({ data: { token: me.sessionToken, photo: p } });
                  if (mine) {
                    void upsertLive({
                      data: {
                        id: mine.id,
                        peerId: me.id,
                        name: next.name,
                        color: next.color,
                        photo: next.photo ?? undefined,
                        task: mine.task,
                        urgent: mine.urgent,
                        lengthMin: mine.lengthMin,
                        camera: mine.camera,
                        dueDate: mine.dueDate ?? undefined,
                        school: next.school ?? undefined,
                        category: mine.category ?? undefined,
                      },
                    }).then(() => q.refetch());
                  }
                }}
              />
              <p className="text-base text-muted">Account email: {me.email}</p>
              <fieldset>
                <legend className="text-base font-medium">Your categories</legend>
                <p className="mt-1 text-sm text-muted">What you use this for. Matching uses this.</p>
                <CategoryPicker
                  multiple
                  value={me.categories}
                  onChange={(ids) => {
                    const next = saveProfile({ ...me, categories: ids });
                    setMe(next);
                    if (ids[0] && !category) setCategory(ids[0]);
                    void saveAccount({ data: { token: me.sessionToken, categories: ids } });
                  }}
                />
              </fieldset>
              {me.schoolVerified && me.school ? (
                <p className="text-base text-muted">Verified campus: {me.school}</p>
              ) : (
                <CampusVerify peerId={me.id} onVerified={onCampusVerified} />
              )}
              <label className="text-sm font-medium" htmlFor="break-every">
                Break reminder
                <p className="mt-1 text-xs font-normal text-muted">Ping both of you every {me.breakEveryMin} minutes.</p>
                <input
                  id="break-every"
                  type="range"
                  min={1}
                  max={60}
                  value={me.breakEveryMin}
                  className="mt-2 w-full"
                  onChange={(e) => {
                    const next = saveProfile({ ...me, breakEveryMin: Number(e.target.value) });
                    setMe(next);
                    void saveAccount({
                      data: { token: me.sessionToken, breakEveryMin: Number(e.target.value) },
                    });
                  }}
                />
              </label>
              <p className="text-xs text-muted">Audio is the default. Camera is optional. In a car, keep camera off.</p>
              <div className="flex flex-col gap-3 border-t border-ink/10 pt-6">
                <p className="font-display text-xl">Plan</p>
                <label className="flex h-11 items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={limits}
                    onChange={(e) => {
                      const on = e.target.checked;
                      const next = saveProfile({ ...me, limitsOn: on });
                      setMe(next);
                      void saveAccount({ data: { token: me.sessionToken, limitsOn: on } });
                    }}
                  />
                  Session limits
                </label>
                <p className="text-sm text-muted">
                  Off for R&D. On = {FREE_SESSIONS} free {FREE_MAX_MIN}-minute sessions a week.
                </p>
                {plus ? (
                  <p className="text-base text-muted">Plus. Unlimited sessions. Calls up to 2 hours.</p>
                ) : limits ? (
                  <>
                    <p className="text-base text-muted">
                      {left} of {FREE_SESSIONS} free 45-minute sessions left this week. {PLUS_PRICE_LABEL} unlocks unlimited sessions and calls longer than 45 minutes.
                    </p>
                    <Btn
                      kind="fill"
                      onClick={() => {
                        void startPlusCheckout({ data: { token: me.sessionToken } }).then((res) => {
                          if (!res.ok) {
                            setNote(res.error);
                            return;
                          }
                          window.location.href = res.url;
                        });
                      }}
                    >
                      Get Plus · $5 a month
                    </Btn>
                  </>
                ) : (
                  <p className="text-sm text-muted">Plus stays off until limits are on.</p>
                )}
              </div>
              <Btn kind="fill" onClick={() => setSheet("none")}>
                Close settings
              </Btn>
              <Btn
                onClick={() => {
                  clearProfile();
                  void nav({ to: "/join" });
                }}
              >
                Sign out
              </Btn>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
