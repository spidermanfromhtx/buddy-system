import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Btn } from "@/components/btn";
import { CategoryPicker } from "@/components/category-picker";
import { Face } from "@/components/face";
import { LookFields } from "@/components/look-fields";
import { Mark } from "@/components/mark";
import { MonthCal } from "@/components/month-cal";
import { PageWash } from "@/components/page-wash";
import { CampusVerify } from "@/components/campus-verify";
import { InstallApp } from "@/components/install-app";
import { JoinForm } from "@/components/join-form";
import { inviteAdmin, listAdmins, readAccount, readFlags, saveAccount, setRndMode, startPlusCheckout } from "@/lib/account";
import { CATEGORIES, categoryLabel, parseCategories, serializeCategories } from "@/lib/categories";
import { FREE_MAX_MIN, FREE_SESSIONS, PLUS_PRICE_LABEL, PRO_PRICE_LABEL, isPlus, maxSessionMin, planLabel, sessionsLeft } from "@/lib/plan";
import {
  bookWindow,
  claimBooking,
  closeLive,
  dropBooking,
  incomingFor,
  listOpen,
  stampSchool,
  startCall,
  unmatchBooking,
  upsertLive,
  type Listing,
} from "@/lib/listings";
import { fileReport } from "@/lib/trust";
import { clearProfile, loadProfile, profileFromAccount, saveProfile, type Profile } from "@/lib/profile";
import { getLocalStream, micHint, stopLocalStream, unlockOutput } from "@/lib/media";
import { formatDue, formatWindow, newId, todayIso, windowRange } from "@/lib/utils";
import { armRing, startRing } from "@/lib/ring";

export const Route = createFileRoute("/feed")({ component: Feed });

function minutesLeft(iso: string | null) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.ceil(ms / 60_000));
}

function Chip({ children, hot = false }: { children: ReactNode; hot?: boolean }) {
  return <span className={`chip ${hot ? "chip-hot" : ""}`}>{children}</span>;
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
  ratingAvg?: number | null;
  ratingCount?: number;
  yours?: boolean;
  action: ReactNode;
}) {
  const due = formatDue(dueDate);
  const chips = [
    urgent ? "urgent" : "not urgent",
    `${lengthMin} min`,
    offerCamera ? "camera on" : "camera off",
    ...parseCategories(category).map((id) => CATEGORIES.find((c) => c.id === id)?.label ?? id),
    due,
    ...(extra ?? "").split("·").map((s) => s.trim()).filter(Boolean),
  ].filter(Boolean);
  return (
    <li className="panel p-5">
      <div className="flex items-start gap-4">
        <Face name={name} color={color} photo={photo} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[1.2rem] font-semibold leading-tight tracking-tight">{name}</p>
              <p className="mt-1 text-[15px] font-normal leading-snug text-muted">{task}</p>
            </div>
            <div className="shrink-0">{action}</div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {chips.map((c, i) => (
              <Chip key={`${c}-${i}`} hot={c === "urgent" || c === "matched"}>
                {c}
              </Chip>
            ))}
          </div>
        </div>
      </div>
    </li>
  );
}

function Feed() {
  const nav = useNavigate();
  const [me, setMe] = useState<Profile | null>(null);
  const [sheet, setSheet] = useState<"none" | "open" | "book" | "settings">("none");
  const [task, setTask] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [lengthMin, setLengthMin] = useState(20);
  const [camera, setCamera] = useState(false);
  const [windowDate, setWindowDate] = useState(todayIso);
  const [windowStart, setWindowStart] = useState("20:00");
  const [windowEnd, setWindowEnd] = useState("22:00");
  const [similar, setSimilar] = useState<"similar" | "different" | "either">("either");
  const [dueDate, setDueDate] = useState("");
  const [category, setCategory] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [liveId, setLiveId] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | "school">("all");
  const [feedCat, setFeedCat] = useState<string[]>([]);
  const [pane, setPane] = useState<"live" | "book">("live");
  const [reportFor, setReportFor] = useState<Listing | null>(null);
  const [reportBody, setReportBody] = useState("");
  const [adminInvite, setAdminInvite] = useState("");
  const [admins, setAdmins] = useState<string[]>([]);
  const limitLock = useRef(0);

  useEffect(() => {
    const p = loadProfile();
    if (p) {
      setMe(p);
      if (p.categories.length) setCategory(p.categories);
    }
  }, []);

  useEffect(() => {
    if (!me?.sessionToken) return;
    void readAccount({ data: { token: me.sessionToken } }).then((res) => {
      if (!res.ok) return;
      setMe((cur) => {
        const next = profileFromAccount(res.account, {
          school: cur?.school,
          schoolEmail: cur?.schoolEmail,
          schoolVerified: cur?.schoolVerified,
          campusToken: cur?.campusToken,
        });
        if (cur && Date.now() < limitLock.current) {
          return saveProfile({ ...next, limitsOn: cur.limitsOn });
        }
        return next;
      });
    });
  }, [me?.sessionToken]);

  useEffect(() => {
    if (!me) return;
    let stop = false;
    const tick = () => {
      void readFlags({ data: {} }).then((res) => {
        if (stop || !res) return;
        setMe((cur) => {
          if (!cur || cur.admin) return cur;
          if (cur.limitsOn === res.limitsOn) return cur;
          return saveProfile({ ...cur, limitsOn: res.limitsOn });
        });
      });
    };
    tick();
    const id = window.setInterval(tick, 4000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [me?.id]);

  useEffect(() => {
    if (sheet !== "settings" || !me?.admin || !me.sessionToken) return;
    void listAdmins({ data: { token: me.sessionToken } }).then((res) => {
      if (res.ok) setAdmins(res.admins);
    });
  }, [sheet, me?.admin, me?.sessionToken]);

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
        if (!youAreCaller || row.bothRing) startRing();
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
    }, 800);
    return () => clearInterval(t);
  }, [me, nav]);

  const scoped = useMemo(() => {
    let rows = q.data ?? [];
    if (tab === "school") {
      if (!me?.school) return [];
      const campus = me.school.toLowerCase();
      rows = rows.filter((l) => (l.school || "").toLowerCase() === campus);
    }
    if (feedCat.length) {
      rows = rows.filter((l) => parseCategories(l.category).some((id) => feedCat.includes(id)) || l.peerId === me?.id);
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
  const hosted = useMemo(
    () => scheduled.filter((l) => (l.hostPeerId || l.peerId) === me?.id),
    [scheduled, me],
  );
  const joined = useMemo(
    () => scheduled.filter((l) => (l.hostPeerId || l.peerId) !== me?.id),
    [scheduled, me],
  );
  const queue = useMemo(
    () => scoped.filter((l) => l.mode === "scheduled" && l.peerId !== me?.id && !l.matchId),
    [scoped, me],
  );

  const mine = (q.data ?? []).find((l) => l.peerId === me?.id && l.mode === "live");

  useEffect(() => {
    if (mine?.id) setLiveId(mine.id);
  }, [mine?.id]);

  const goOpen = useMutation({
    mutationFn: async () => {
      if (!me) return;
      if (!task.trim()) throw new Error("Write a task description first.");
      if (!category.length) throw new Error("Pick at least one category.");
      void unlockOutput();
      void armRing();
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
          lengthMin: Math.min(lengthMin, capStep),
          camera,
          dueDate: dueDate || undefined,
          school: me.school ?? undefined,
          category: serializeCategories(category) || undefined,
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
      if (!category.length) throw new Error("Pick at least one category.");
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
          lengthMin: Math.min(lengthMin, capStep),
          camera,
          similarPref: similar,
          windowLabel: formatWindow(windowDate, windowStart, windowEnd),
          windowStart: range.start,
          windowEnd: range.end,
          dueDate: dueDate || undefined,
          school: me.school ?? undefined,
          category: serializeCategories(category) || undefined,
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
          : `in the queue. match pending. rings ${when} if someone takes the window.`,
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
      await getLocalStream(row.camera);
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
        camera: row.camera,
        allowCamera: row.camera,
        room,
        lengthMin: row.lengthMin,
      },
    });
  }

  const takeWindow = useMutation({
    mutationFn: async (row: Listing) => {
      if (!me) return;
      const res = await claimBooking({
        data: {
          listingId: row.id,
          peerId: me.id,
          name: me.name,
          color: me.color,
          photo: me.photo ?? undefined,
        },
      });
      if (res && "ok" in res && res.ok === false) throw new Error("error" in res ? String(res.error) : "could not join");
      return res;
    },
    onSuccess: (res) => {
      setNote(res && "matched" in res && res.matched ? `you’re their buddy · ${res.matched.name}` : "matched.");
      if (me && !isPlus(me.plan)) setMe(saveProfile({ ...me, sessionsUsed: me.sessionsUsed + 1 }));
      void q.refetch();
    },
    onError: (err) => setNote(err instanceof Error ? err.message : "could not join"),
  });

  const dropWin = useMutation({
    mutationFn: async (row: Listing) => {
      if (!me) return;
      const res = await dropBooking({ data: { listingId: row.id, peerId: me.id } });
      if (res && "ok" in res && res.ok === false) throw new Error("error" in res ? String(res.error) : "could not remove");
    },
    onSuccess: () => {
      setNote("window removed.");
      void q.refetch();
    },
    onError: (err) => setNote(err instanceof Error ? err.message : "could not remove"),
  });

  const unmatchWin = useMutation({
    mutationFn: async (row: Listing) => {
      if (!me) return;
      const res = await unmatchBooking({ data: { listingId: row.id, peerId: me.id } });
      if (res && "ok" in res && res.ok === false) throw new Error("error" in res ? String(res.error) : "could not unmatch");
    },
    onSuccess: () => {
      setNote("unmatched. you’re back in the queue.");
      void q.refetch();
    },
    onError: (err) => setNote(err instanceof Error ? err.message : "could not unmatch"),
  });

  const cap = maxSessionMin(me?.plan, me?.limitsOn);
  const capStep = Math.floor(cap / 10) * 10;
  useEffect(() => {
    setLengthMin((n) => {
      const snapped = Math.round(n / 10) * 10;
      return Math.min(capStep, Math.max(0, snapped));
    });
  }, [capStep]);

  if (!me) return <JoinForm onJoined={setMe} />;

  const remain = minutesLeft(mine?.expiresAt ?? null);
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
    stopLocalStream();
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
      <p className="font-display text-xl tracking-tight">Book</p>
      <p className="mt-0.5 text-sm text-muted">Pick a day. We match you. The call rings.</p>
      <div className="mt-3 flex flex-col gap-3">
        <div>
          <p className="text-sm font-medium">Date</p>
          <p className="mt-1 text-xs text-muted">Tap a day. Past days are closed.</p>
          <div className="mt-3">
            <MonthCal value={windowDate} onChange={setWindowDate} />
          </div>
          <p className="mt-3 text-sm">{formatWindow(windowDate, windowStart, windowEnd)}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-2 text-sm font-medium" htmlFor={`${prefix}-start`}>
            Start time
            <input
              id={`${prefix}-start`}
              type="time"
              className="h-11 rounded-2xl border-0 bg-paper/70 px-3 font-normal text-ink outline-none"
              value={windowStart}
              onChange={(e) => setWindowStart(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium" htmlFor={`${prefix}-end`}>
            End time
            <input
              id={`${prefix}-end`}
              type="time"
              className="h-11 rounded-2xl border-0 bg-paper/70 px-3 font-normal text-ink outline-none"
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
            className="h-11 rounded-2xl border-0 bg-paper/70 px-3 font-normal outline-none"
            value={task}
            onChange={(e) => setTask(e.target.value)}
          />
          <span className="text-xs font-normal text-muted">A task description, big or small.</span>
        </label>
        <fieldset>
          <legend className="text-sm font-medium">Categories</legend>
          <p className="mt-1 text-xs text-muted">Pick every one that fits.</p>
          <div className="mt-2">
            <CategoryPicker value={category} onChange={setCategory} />
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
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
            min={0}
            max={capStep}
            step={10}
            value={Math.min(lengthMin, capStep)}
            className="mt-3 w-full accent-[var(--rust)]"
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
        <Btn
          kind={goBook.isPending || scheduled.some((r) => !r.matchPeerName) ? "paper" : "fill"}
          className={`h-12 w-full ${
            goBook.isPending || scheduled.some((r) => !r.matchPeerName)
              ? "border border-ink/10 shadow-inner"
              : "shadow-sm"
          }`}
          disabled={goBook.isPending || lengthMin < 10}
          onClick={() => goBook.mutate()}
        >
          {goBook.isPending ? "…" : "Add to queue"}
        </Btn>
      </div>
    </div>
  );

  const liveOn = Boolean(mine);

  const compose = (
    <div className="rounded-[1.35rem] bg-night/90 p-4 text-paper">
      <input
        placeholder="Task description"
        className="h-10 w-full bg-transparent text-base text-paper outline-none placeholder:text-paper/40"
        value={task}
        onChange={(e) => setTask(e.target.value)}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={`chip ${
            urgent ? "chip-hot" : "bg-paper/10 text-paper"
          }`}
          onClick={() => setUrgent((v) => !v)}
        >
          {urgent ? "Urgent" : "Not urgent"}
        </button>
        <button
          type="button"
          className={`chip ${
            camera ? "chip-hot" : "bg-paper/10 text-paper"
          }`}
          onClick={() => setCamera((v) => !v)}
        >
          {camera ? "Camera on" : "Camera off"}
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="w-12 shrink-0 whitespace-nowrap text-sm text-paper/70">{Math.min(lengthMin, capStep)} min</span>
        <input
          type="range"
          min={0}
          max={capStep}
          step={10}
          value={Math.min(lengthMin, capStep)}
          className="min-w-0 flex-1 accent-[var(--rust)]"
          onChange={(e) => setLengthMin(Number(e.target.value))}
        />
        {liveOn ? (
          <Btn kind="paper" className="h-9 shrink-0 px-4 text-sm" onClick={closeMe}>
            End live
          </Btn>
        ) : (
          <Btn kind="fill" className="h-9 shrink-0 px-4 text-sm" disabled={goOpen.isPending || lengthMin < 10} onClick={() => goOpen.mutate()}>
            {goOpen.isPending ? "…" : "Go live"}
          </Btn>
        )}
      </div>
      <div className="mt-2">
        <CategoryPicker onDark value={category} onChange={setCategory} />
      </div>
      {note ? <p className="mt-2 text-sm text-paper/70">{note}</p> : null}
    </div>
  );

  const yourWindows = (
    <div className="mt-4 flex flex-col gap-5">
      <div>
        <p className="font-display text-lg">Your bookings</p>
        <p className="mt-1 text-sm text-muted">Windows you posted. Someone can match to you.</p>
        <ul className="mt-2 flex flex-col gap-3">
          {hosted.length === 0 ? (
            <li className="panel px-4 py-4 text-sm text-muted">You have not posted a window.</li>
          ) : (
            hosted.map((row) => {
              const face = row.matchPeerName
                ? {
                    name: row.otherName || row.matchPeerName,
                    color: row.otherColor || row.matchPeerColor || "",
                    photo: row.otherPhoto || row.matchPeerPhoto,
                  }
                : {
                    name: row.hostName || row.name,
                    color: row.hostColor || row.color,
                    photo: row.hostPhoto || row.photo,
                  };
              return (
              <Card
                key={row.id}
                name={face.name}
                color={face.color}
                photo={face.photo}
                task={row.task}
                urgent={row.urgent}
                dueDate={row.dueDate}
                lengthMin={row.lengthMin}
                category={row.category}
                offerCamera={row.camera}
                extra={[row.windowLabel, row.matchPeerName ? `matched · ${row.matchPeerName}` : "waiting for a buddy"]
                  .filter(Boolean)
                  .join(" · ")}
                action={
                  <div className="flex flex-col items-end gap-2">
                    {row.matchPeerName ? (
                      <Btn className="h-11 px-4 text-sm" disabled={unmatchWin.isPending} onClick={() => unmatchWin.mutate(row)}>
                        Unmatch
                      </Btn>
                    ) : null}
                    <button type="button" className="text-sm text-muted underline" onClick={() => dropWin.mutate(row)}>
                      Remove
                    </button>
                  </div>
                }
              />
              );
            })
          )}
        </ul>
      </div>
      <div>
        <p className="font-display text-lg">You matched</p>
        <p className="mt-1 text-sm text-muted">Bookings you joined from the queue.</p>
        <ul className="mt-2 flex flex-col gap-3">
          {joined.length === 0 ? (
            <li className="panel px-4 py-4 text-sm text-muted">You have not joined a window.</li>
          ) : (
            joined.map((row) => (
              <Card
                key={row.id}
                name={row.otherName || row.matchPeerName || row.hostName || row.name}
                color={row.otherColor || row.matchPeerColor || row.hostColor || ""}
                photo={row.otherPhoto || row.matchPeerPhoto || row.hostPhoto}
                task={row.task}
                urgent={row.urgent}
                dueDate={row.dueDate}
                lengthMin={row.lengthMin}
                category={row.category}
                offerCamera={row.camera}
                extra={[row.windowLabel, "you matched"].filter(Boolean).join(" · ")}
                action={
                  <div className="flex flex-col items-end gap-2">
                    <Btn className="h-11 px-4 text-sm" disabled={unmatchWin.isPending} onClick={() => unmatchWin.mutate(row)}>
                      Unmatch
                    </Btn>
                    <button type="button" className="text-sm text-muted underline" onClick={() => dropWin.mutate(row)}>
                      Remove
                    </button>
                  </div>
                }
              />
            ))
          )}
        </ul>
      </div>
    </div>
  );

  const liveBoard = (
    <div className="flex flex-col">
      <div className="flex gap-5 border-b border-ink/10">
        <button
          type="button"
          className={`border-b-2 pb-2 text-sm font-medium ${tab === "all" ? "border-rust text-ink" : "border-transparent text-muted"}`}
          onClick={() => setTab("all")}
        >
          Main
        </button>
        <button
          type="button"
          className={`border-b-2 pb-2 text-sm font-medium ${tab === "school" ? "border-rust text-ink" : "border-transparent text-muted"}`}
          onClick={() => setTab("school")}
        >
          University
        </button>
      </div>
      {tab === "school" && !me.schoolVerified ? (
        <div className="mt-5 max-w-md">
          <p className="font-display text-2xl tracking-tight">Your campus</p>
          <p className="mt-2 text-sm text-muted">
            Add a school email in Settings. We send a 6-digit code. Then this only shows people from that campus.
          </p>
          <Btn kind="fill" className="mt-4 h-10" onClick={() => setSheet("settings")}>
            Open settings
          </Btn>
        </div>
      ) : (
        <>
          <div className="mt-3">
            <CategoryPicker allowAll multiple value={feedCat} onChange={setFeedCat} />
          </div>
          <ul className="mt-3 flex flex-col gap-3">
            {live.length === 0 ? (
              <li className="panel px-4 py-5 text-sm text-muted">
                {tab === "school"
                  ? `Nobody from ${me.school} is live${feedCat.length ? ` in ${categoryLabel(feedCat.join(","))}` : ""}.`
                  : `Nobody live${feedCat.length ? ` in ${categoryLabel(feedCat.join(","))}` : ""}. Write a task description below.`}
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
                  yours={isYou}
                  extra={
                    isYou
                      ? `live${remain !== null ? ` · ${remain}m left` : ""}`
                      : row.school && tab === "all"
                        ? row.school
                        : undefined
                  }
                  ratingAvg={row.ratingAvg}
                  ratingCount={row.ratingCount}
                  action={
                    isYou ? (
                      <Btn className="h-10 px-4 text-sm" onClick={() => refreshLive.mutate()}>
                        still open
                      </Btn>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <Btn kind="fill" className="h-10 px-4 text-sm" onClick={() => void call(row)}>
                          Call
                        </Btn>
                        <button
                          type="button"
                          className="text-[11px] text-muted underline"
                          onClick={() => {
                            setReportFor(row);
                            setReportBody("");
                          }}
                        >
                          Report
                        </button>
                      </div>
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
    <main className="relative isolate z-10 flex min-h-dvh flex-col bg-transparent text-ink">
      <PageWash />
      <header className="relative z-20 flex items-center justify-between gap-2 px-3 pb-3 pt-[max(0.65rem,env(safe-area-inset-top))] md:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <Mark />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold leading-none tracking-tight md:text-xl">Buddy System</h1>
            <p className="mt-1.5 text-[11px] text-muted">
              {plus ? planLabel(me.plan) : limits ? `${left} left this week` : "R&D"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
          <div className="flex rounded-full bg-paper/50 p-0.5 md:hidden">
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
          <Btn className="h-9 px-3 text-sm" onClick={() => void nav({ to: "/reviews" })}>
            Reviews
          </Btn>
          <Btn className="hidden h-10 text-sm md:inline-flex" onClick={() => void share()}>
            Share
          </Btn>
          <InstallApp className="h-9 px-3 text-sm" />
          <button type="button" className="shrink-0" onClick={() => setSheet("settings")} aria-label="Settings">
            <Face name={me.name} color={me.color} photo={me.photo} size="sm" />
          </button>
        </div>
      </header>

      <div className="relative z-10 mx-auto grid w-full max-w-6xl grid-cols-1 gap-3 px-4 pb-8 pt-3 md:grid-cols-2 md:gap-5 md:px-6 md:pt-4">
        <section className={pane === "book" ? "hidden md:block" : "block"}>
          {liveBoard}
          <div className="pt-3">{compose}</div>
          {yourWindows}
        </section>
        <aside className={`min-w-0 ${pane === "live" ? "hidden md:block" : "block"}`}>
          <p className="font-display text-lg">Booking feed</p>
          <p className="mt-1 text-sm text-muted">Open windows. Be someone’s buddy, or wait in the queue.</p>
          <ul className="mt-2 flex flex-col gap-2">
            {queue.length === 0 ? (
              <li className="panel px-4 py-4 text-sm text-muted">Nobody in the queue yet.</li>
            ) : (
              queue.map((row) => (
                <Card
                  key={row.id}
                  name={row.hostName || row.name}
                  color={row.hostColor || row.color}
                  photo={row.hostPhoto ?? row.photo}
                  task={row.task}
                  urgent={row.urgent}
                  dueDate={row.dueDate}
                  lengthMin={row.lengthMin}
                  category={row.category}
                  offerCamera={row.camera}
                  extra={row.windowLabel ?? "window"}
                  ratingAvg={row.ratingAvg}
                  ratingCount={row.ratingCount}
                  action={
                    <Btn kind="fill" className="h-10 px-4 text-sm" onClick={() => takeWindow.mutate(row)}>
                      Be a buddy
                    </Btn>
                  }
                />
              ))
            )}
          </ul>
          <div className="mt-4">{bookFields("side")}</div>
        </aside>
      </div>

      {sheet === "settings" ? (
        <div className="fixed inset-0 z-30 flex items-end bg-night/50 md:items-center md:justify-center" onClick={() => setSheet("none")}>
          <div
            className="panel w-full max-h-dvh overflow-y-auto rounded-t-[1.6rem] bg-paper p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-ink md:max-w-lg md:rounded-[1.6rem] md:p-10"
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
                    if (ids.length && !category.length) setCategory(ids);
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
              <div className="flex flex-col gap-3 border-t border-ink/10 pt-6 md:hidden">
                <InstallApp className="h-11 w-full" />
                <Btn className="h-11 w-full" onClick={() => void share()}>
                  Share
                </Btn>
                <Btn className="h-11 w-full" onClick={() => void nav({ to: "/reviews" })}>
                  Reviews
                </Btn>
              </div>
              <div className="flex flex-col gap-3 border-t border-ink/10 pt-6">
                <p className="font-display text-xl">Home screen</p>
                <p className="text-sm text-muted">
                  On iPhone: open this site in Safari, tap the Share button, then Add to Home Screen. It sits next to your other apps. No App Store.
                </p>
              </div>
              <div className="flex flex-col gap-3 border-t border-ink/10 pt-6">
                <p className="font-display text-xl">Plan</p>
                {me.admin ? (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">Limits for everyone</p>
                        <p className="text-sm text-muted">{limits ? "On" : "Off"}</p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={limits}
                        aria-label="Limits for everyone"
                        className={`relative h-12 w-[4.5rem] shrink-0 rounded-full border transition ${
                          limits ? "border-transparent bg-ink" : "border-ink/15 bg-paper"
                        }`}
                        onClick={() => {
                          const on = !limits;
                          limitLock.current = Date.now() + 60000;
                          setMe(saveProfile({ ...me, limitsOn: on }));
                          void setRndMode({ data: { token: me.sessionToken, mode: on ? "on" : "off" } }).then((res) => {
                            if (!res.ok) {
                              limitLock.current = 0;
                              setMe(saveProfile({ ...me, limitsOn: !on }));
                              setNote(res.error);
                              return;
                            }
                            setMe(saveProfile({ ...me, limitsOn: res.limitsOn }));
                          });
                        }}
                      >
                        <span
                          className={`absolute top-1 size-10 rounded-full shadow transition-all ${
                            limits ? "left-7 bg-paper" : "left-1 bg-ink"
                          }`}
                        />
                      </button>
                    </div>
                    <p className="text-sm text-muted">
                      Off = R&D, no paywall. On = free accounts get {FREE_SESSIONS} sessions of {FREE_MAX_MIN}{" "}
                      minutes a week.
                    </p>
                    <p className="text-sm font-medium">Admins</p>
                    <ul className="text-sm text-muted">
                      {admins.map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                    <div className="flex gap-2">
                      <input
                        className="h-11 min-w-0 flex-1 rounded-2xl border-0 bg-paper/70 px-3 text-sm"
                        placeholder="invite admin email"
                        value={adminInvite}
                        onChange={(e) => setAdminInvite(e.target.value)}
                      />
                      <Btn
                        type="button"
                        kind="ink"
                        className="h-11"
                        onClick={() => {
                          const email = adminInvite.trim();
                          if (!email) return;
                          void inviteAdmin({ data: { token: me.sessionToken, email } }).then((res) => {
                            if (res.ok) {
                              setAdmins(res.admins);
                              setAdminInvite("");
                            } else setNote(res.error);
                          });
                        }}
                      >
                        Invite
                      </Btn>
                    </div>
                  </>
                ) : null}
                {plus ? (
                  <div className="flex flex-col gap-3">
                    <p className="text-base text-muted">
                      {planLabel(me.plan)}. Unlimited sessions. Calls up to 2 hours.
                    </p>
                    {me.plan !== "pro" ? (
                      <>
                        <Btn
                          kind="line"
                          onClick={() => {
                            void startPlusCheckout({ data: { token: me.sessionToken, plan: "pro" } }).then((res) => {
                              if (!res.ok) {
                                setNote(res.error);
                                return;
                              }
                              window.location.href = res.url;
                            });
                          }}
                        >
                          Get Pro · {PRO_PRICE_LABEL}
                        </Btn>
                        <p className="text-sm text-muted">Pro will add window share. Not on yet.</p>
                      </>
                    ) : (
                      <p className="text-sm text-muted">Window share for Pro is not on yet.</p>
                    )}
                  </div>
                ) : limits ? (
                  <>
                    <p className="text-base text-muted">
                      {left} of {FREE_SESSIONS} free 45-minute sessions left this week.
                    </p>
                    <Btn
                      kind="fill"
                      onClick={() => {
                        void startPlusCheckout({ data: { token: me.sessionToken, plan: "plus" } }).then((res) => {
                          if (!res.ok) {
                            setNote(res.error);
                            return;
                          }
                          window.location.href = res.url;
                        });
                      }}
                    >
                      Get Plus · {PLUS_PRICE_LABEL}
                    </Btn>
                    <Btn
                      kind="line"
                      onClick={() => {
                        void startPlusCheckout({ data: { token: me.sessionToken, plan: "pro" } }).then((res) => {
                          if (!res.ok) {
                            setNote(res.error);
                            return;
                          }
                          window.location.href = res.url;
                        });
                      }}
                    >
                      Get Pro · {PRO_PRICE_LABEL}
                    </Btn>
                    <p className="text-sm text-muted">Plus is unlimited time. Pro will add window share.</p>
                  </>
                ) : (
                  <p className="text-sm text-muted">R&D. Session limits are off.</p>
                )}
              </div>
              <Btn
                onClick={() => {
                  setSheet("none");
                  void nav({ to: "/terms" });
                }}
              >
                Terms
              </Btn>
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

      {reportFor ? (
        <div
          className="fixed inset-0 z-30 flex items-end bg-night/50 md:items-center md:justify-center"
          onClick={() => setReportFor(null)}
        >
          <div
            className="panel w-full max-w-md rounded-t-[1.6rem] bg-paper p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:rounded-[1.6rem]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-display text-xl">Report {reportFor.name}</p>
            <p className="mt-2 text-sm text-muted">
              They will not see it was you. We read the language. Harm can close an account. Other reports can send a warning.
            </p>
            <textarea
              className="mt-4 min-h-28 w-full rounded-2xl border-0 bg-paper/70 px-3 py-2 outline-none"
              value={reportBody}
              onChange={(e) => setReportBody(e.target.value)}
              placeholder="What happened."
              maxLength={800}
            />
            <div className="mt-4 flex flex-col gap-2">
              <Btn
                kind="fill"
                onClick={() => {
                  void fileReport({
                    data: { token: me.sessionToken, subjectId: reportFor.peerId, body: reportBody },
                  }).then((res) => {
                    if (!res.ok) {
                      setNote(res.error);
                      return;
                    }
                    setNote(res.action === "closed" ? "Report in. That account was closed." : "Report in.");
                    setReportFor(null);
                    setReportBody("");
                  });
                }}
              >
                Send report
              </Btn>
              <Btn onClick={() => setReportFor(null)}>Close</Btn>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
