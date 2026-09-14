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
import { getLocalStream, unlockOutput } from "@/lib/media";
import { formatDue, formatWindow, newId, todayIso, windowRange } from "@/lib/utils";
import { armRing } from "@/lib/ring";

export const Route = createFileRoute("/feed")({ component: Feed });

function minutesLeft(iso: string | null) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.ceil(ms / 60_000));
}

function Row({
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
  return (
    <li className="flex items-center gap-4 border-b border-ink/10 py-6">
      <Face name={name} color={color} photo={photo} />
      <div className="min-w-0 flex-1">
        <p className="text-lg leading-snug">{task}</p>
        <p className="mt-1 text-sm text-muted">
          {name} · {urgent ? "urgent" : "not urgent"} · {lengthMin} min
          {category ? ` · ${categoryLabel(category)}` : ""}
          {offerCamera ? " · camera on" : ""}
          {due ? ` · ${due}` : ""}
          {extra ? ` · ${extra}` : ""}
        </p>
      </div>
      {action}
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
    const rows = q.data ?? [];
    if (tab !== "school") return rows;
    if (!me?.school) return [];
    const campus = me.school.toLowerCase();
    return rows.filter((l) => (l.school || "").toLowerCase() === campus);
  }, [q.data, tab, me?.school]);

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
      if (!me || !task.trim()) return;
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
      await unlockOutput();
      await armRing();
      await getLocalStream(false);
    } catch {
      // Call screen shows Join the line if the mic is still blocked.
    }
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
  const cap = maxSessionMin(me.plan);
  const left = sessionsLeft(me.plan, me.sessionsUsed);
  const plus = isPlus(me.plan);

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
      <div className="mb-12">
        <p className="font-display text-4xl tracking-tight md:text-5xl">Book a window</p>
        <p className="mt-3 text-base text-muted">Pick a day. We match you. The call rings.</p>
      </div>
      <div className="flex flex-col gap-8">
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
  const actions = (
    <>
      <Btn kind={liveOn ? "fill" : "line"} onClick={() => setSheet("open")}>
        Go live
      </Btn>
      <Btn className="md:hidden" onClick={() => setSheet("book")}>
        Book
      </Btn>
      <Btn kind={liveOn ? "line" : "fill"} onClick={closeMe}>
        End live
      </Btn>
    </>
  );

  return (
    <main className="flex min-h-dvh flex-col px-6 pb-28 pt-10 text-left md:px-10 md:pb-16">
      <div className="mx-auto grid w-full max-w-7xl items-start gap-12 md:grid-cols-2 md:gap-12 lg:gap-16 xl:gap-24">
        <section className="min-w-0">
      <header className="mb-12 flex flex-col items-start">
        <div className="flex items-center gap-3">
          <Mark />
          <h1 className="font-display text-4xl tracking-tight md:text-5xl">Buddy System</h1>
        </div>
        <p className="mt-3 max-w-md text-base text-muted">
          Find a live buddy. Schedule a buddy. Be a buddy.
        </p>
        <p className="mt-3 text-sm text-muted">
          {plus
            ? "Plus. Unlimited sessions. Calls up to 2 hours."
            : `${left} of ${FREE_SESSIONS} free sessions left this week. Free calls are ${FREE_MAX_MIN} minutes.`}
        </p>
        <div className="mt-8 hidden flex-wrap gap-2 md:flex">{actions}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Btn className="text-sm" onClick={() => void share()}>
            Share
          </Btn>
          <Btn className="text-sm" onClick={() => setSheet("settings")}>
            Settings
          </Btn>
        </div>
        <div className="mt-8 flex flex-wrap gap-2">
          <Btn type="button" kind={tab === "all" ? "fill" : "line"} onClick={() => setTab("all")}>
            Everyone
          </Btn>
          <Btn type="button" kind={tab === "school" ? "fill" : "line"} onClick={() => setTab("school")}>
            {me.schoolVerified && me.school ? me.school : "Campus"}
          </Btn>
        </div>
      </header>

      {tab === "school" && !me.schoolVerified ? (
        <div className="mb-8 flex max-w-md flex-col gap-4">
          <p className="font-display text-3xl tracking-tight">Campus</p>
          <p className="text-base text-muted">
            Add a school email in Settings. We send a 6-digit code. Then this tab only shows people from that campus.
          </p>
          <Btn kind="fill" className="self-start" onClick={() => setSheet("settings")}>
            Open settings
          </Btn>
        </div>
      ) : (
        <>
      <ul className="flex flex-col border-t border-ink/10">
        {live.length === 0 ? (
          <li className="py-10 text-base text-muted">
            {tab === "school"
              ? `Nobody from ${me.school} is live. Go live or book a window.`
              : "Nobody live. Go live or book a window."}
          </li>
        ) : null}
        {live.map((row) => {
          const isYou = row.peerId === me.id;
          return (
            <Row
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
                  <Btn className="whitespace-nowrap" onClick={() => refreshLive.mutate()}>
                    still open
                  </Btn>
                ) : (
                  <Btn kind="fill" className="min-w-16" onClick={() => void call(row)}>
                    Call
                  </Btn>
                )
              }
            />
          );
        })}
      </ul>

      <div className="mt-14">
        <p className="mb-3 text-sm uppercase tracking-[0.18em] text-muted">scheduled</p>
        <ul className="flex flex-col border-t border-ink/10">
          {scheduled.length === 0 ? (
            <li className="py-8 text-base text-muted">No windows booked yet. Use Book a window.</li>
          ) : null}
          {scheduled.map((row) => (
            <Row
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
              extra={
                [
                  row.windowLabel,
                  row.matchPeerName ? `matched · ${row.matchPeerName}` : "waiting for a match",
                ]
                  .filter(Boolean)
                  .join(" · ")
              }
              action={<span className="text-sm text-muted">window</span>}
            />
          ))}
        </ul>
        {note && tab !== "school" ? <p className="mt-3 text-sm text-muted">{note}</p> : null}
        {note && tab === "school" && me.school ? <p className="mt-3 text-sm text-muted">{note}</p> : null}
      </div>
        </>
      )}
        </section>
        <aside className="hidden min-w-0 md:block md:border-l md:border-ink/10 md:pl-8 lg:pl-12 xl:pl-16">
          {bookFields("side")}
        </aside>
      </div>

      <nav className="fixed inset-x-0 bottom-0 flex justify-between gap-2 border-t border-ink/10 bg-paper/90 px-6 py-4 backdrop-blur md:hidden">
        {actions}
      </nav>

      {sheet !== "none" ? (
        <div
          className={
            sheet === "book"
              ? "fixed inset-0 z-20 flex items-end bg-night/50 md:hidden"
              : "fixed inset-0 z-20 flex items-end bg-night/50 md:items-center md:justify-center"
          }
          onClick={() => setSheet("none")}
        >
          <div
            className="w-full max-h-dvh overflow-y-auto rounded-t-3xl bg-paper p-6 text-ink shadow-xl shadow-night/20 md:max-w-lg md:rounded-3xl md:p-10"
            onClick={(e) => e.stopPropagation()}
          >
            {sheet === "settings" ? (
              <div className="flex flex-col gap-6">
                <p className="font-display text-xl">Settings</p>
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
                  {plus ? (
                    <p className="text-base text-muted">Plus. Unlimited sessions. Calls up to 2 hours.</p>
                  ) : (
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
                  )}
                </div>
                <Btn
                  onClick={() => {
                    clearProfile();
                    void nav({ to: "/join" });
                  }}
                >
                  Sign out
                </Btn>
              </div>
            ) : sheet === "book" ? (
              bookFields("sheet")
            ) : (
              <div className="flex flex-col gap-6">
                <p className="font-display text-xl">Go live</p>
                <label className="flex flex-col gap-1 text-sm font-medium" htmlFor="task-input">
                  Task description
                  <input
                    id="task-input"
                    placeholder="finish the email"
                    className="h-11 rounded-xl border border-ink/10 bg-paper px-3 font-normal outline-none"
                    value={task}
                    onChange={(e) => setTask(e.target.value)}
                  />
                  <span className="text-xs font-normal text-muted">One line. Not an assignment.</span>
                </label>
                <fieldset>
                  <legend className="text-sm font-medium">Category</legend>
                  <p className="mt-1 text-xs text-muted">What kind of task this is.</p>
                  <CategoryPicker value={category ? [category] : []} onChange={(ids) => setCategory(ids[0] ?? "")} />
                </fieldset>
                <label className="flex h-11 items-center gap-2 text-sm font-medium">
                  <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} />
                  This is urgent
                </label>
                <label className="text-sm font-medium" htmlFor="open-length">
                  Call length
                  <p className="text-xs font-normal text-muted">{lengthMin} minutes</p>
                  <input
                    id="open-length"
                    type="range"
                    min={5}
                    max={cap}
                    value={lengthMin}
                    className="w-full"
                    onChange={(e) => setLengthMin(Number(e.target.value))}
                  />
                </label>
                <div>
                  <p className="text-sm font-medium">Due date</p>
                  <p className="mt-1 text-xs text-muted">Optional. Only if this task has one. Tap a day, or leave it blank.</p>
                  <div className="mt-2">
                    <MonthCal value={dueDate} onChange={setDueDate} />
                  </div>
                  {dueDate ? (
                    <Btn type="button" className="mt-2" onClick={() => setDueDate("")}>
                      Clear due date
                    </Btn>
                  ) : null}
                </div>
                <fieldset>
                  <legend className="text-sm font-medium">Camera</legend>
                  <p className="mt-1 text-xs text-muted">On or off for this call.</p>
                  <div className="mt-2 flex gap-2">
                    <Btn
                      type="button"
                      kind={!camera ? "ink" : "line"}
                      className="flex-1"
                      onClick={() => setCamera(false)}
                    >
                      Off
                    </Btn>
                    <Btn
                      type="button"
                      kind={camera ? "ink" : "line"}
                      className="flex-1"
                      onClick={() => setCamera(true)}
                    >
                      On
                    </Btn>
                  </div>
                </fieldset>
                <Btn kind="fill" className="h-12 w-full" onClick={() => goOpen.mutate()}>
                  Go live
                </Btn>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}
