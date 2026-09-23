import { useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Btn } from "@/components/btn";
import { CategoryPicker } from "@/components/category-picker";
import { EmailCodeForm } from "@/components/email-code-form";
import { LookFields } from "@/components/look-fields";
import { PageWash } from "@/components/page-wash";
import { Mark } from "@/components/mark";
import { createAccount, getSignupStats, requestAccountCode, verifyAccountCode } from "@/lib/account";
import { profileFromAccount, type Profile } from "@/lib/profile";
import { ageFromBirthdate } from "@/lib/utils";

export function JoinForm({ onJoined }: { onJoined?: (p: Profile) => void }) {
  const nav = useNavigate();
  const [pending, setPending] = useState<{ email: string; token: string } | null>(null);
  const [name, setName] = useState("");
  const [birthdate, setBirthdate] = useState("2004-01-01");
  const [color, setColor] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [tos, setTos] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const signupStats = useQuery({
    queryKey: ["signup-stats"],
    queryFn: () => getSignupStats(),
    refetchInterval: 10000,
    staleTime: 5000,
  });

  function signedIn(p: Profile) {
    onJoined?.(p);
    void nav({ to: "/feed" });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pending) return;
    if (!name.trim()) return setErr("name");
    if (ageFromBirthdate(birthdate) < 18) return setErr("18");
    if (!categories.length) return setErr("categories");
    if (!tos) return setErr("tos");
    setBusy(true);
    setErr("");
    try {
      const res = await createAccount({
        data: {
          email: pending.email,
          token: pending.token,
          name: name.trim(),
          birthdate,
          color,
          photo,
          categories,
        },
      });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      signedIn(profileFromAccount(res.account));
    } catch {
      setErr("Could not create the account. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative isolate z-10 min-h-dvh bg-transparent text-ink">
      <PageWash />
      <header className="relative z-20 flex items-center justify-between gap-3 px-4 pb-3 pt-[max(1.15rem,env(safe-area-inset-top))] md:px-10 md:pt-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <Mark className="h-12 w-8 shrink-0" />
          <p className="min-w-0 text-xl font-semibold tracking-tight md:text-2xl">Buddy System</p>
        </div>
        <a href="/reviews" className="shrink-0 text-sm font-medium text-ink underline-offset-4 hover:underline md:text-base">
          Reviews
        </a>
      </header>
      <section className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-10 px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-5 md:grid-cols-2 md:px-10 md:pt-16">
        <div>
          {!pending ? (
            <>
              <h1 className="max-w-xl text-[2.5rem] font-semibold leading-[1.08] tracking-tight sm:text-5xl md:text-7xl">
                The call rings.
                <br />
                You work. You hang up.
              </h1>
              <p className="mt-4 max-w-md text-lg text-muted md:mt-5 md:text-xl">
                Find a live buddy. Schedule a buddy. Be a buddy. 18+.
              </p>
              <div className="mt-5">
                <Link to="/about">
                  <Btn kind="line" className="h-12 px-5 text-base">
                    What is the Buddy System
                  </Btn>
                </Link>
              </div>
              <div className="mt-6 max-w-md rounded-3xl bg-paper/70 px-4 py-3 ring-1 ring-ink/5 md:mt-8">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-semibold">
                    {signupStats.isLoading ? "People are joining" : `${signupStats.data?.total ?? 0} people have signed up`}
                  </p>
                  {signupStats.data?.offerFull ? (
                    <span className="text-xs font-medium text-muted">offer full</span>
                  ) : (
                    <span className="text-xs font-medium text-rust">
                      {signupStats.data?.remaining ?? 100} spots left
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted">
                  The first 100 launch signups get <span className="font-medium text-ink">Plus free for 1 month.</span>
                </p>
              </div>
              <div className="mt-6 max-w-md md:mt-5">
                <EmailCodeForm
                  hero
                  label="Email"
                  hint=""
                  placeholder="you@gmail.com"
                  verifyLabel="Verify email"
                  send={(email) => requestAccountCode({ data: { email } })}
                  verify={async (email, code) => {
                    const res = await verifyAccountCode({ data: { email, code } });
                    if (!res.ok) return res;
                    if (res.exists) {
                      signedIn(profileFromAccount(res.account));
                      return { ok: true };
                    }
                    setPending({ email: res.email, token: res.token });
                    return { ok: true };
                  }}
                />
              </div>
              <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-base text-muted md:mt-14 md:gap-x-8">
                <li className="flex items-center gap-2">
                  <Bolt />
                  Real people
                </li>
                <li className="flex items-center gap-2">
                  <Cal />
                  Flexible scheduling
                </li>
                <li className="flex items-center gap-2">
                  <Folk />
                  A more productive you
                </li>
              </ul>
            </>
          ) : (
            <form onSubmit={(e) => void submit(e)} className="flex max-w-md flex-col gap-6">
              <p className="text-base text-muted">Verified {pending.email}. Finish your profile.</p>
              <label className="text-base font-medium" htmlFor="join-name">
                Your name
                <input
                  id="join-name"
                  name="name"
                  className="mt-2 h-11 w-full rounded-md border border-ink/20 bg-cream px-4 font-normal outline-none"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="nickname"
                />
              </label>
              <label className="text-base font-medium" htmlFor="join-birthdate">
                Birthdate
                <input
                  id="join-birthdate"
                  type="date"
                  className="mt-2 h-11 w-full rounded-md border border-ink/20 bg-cream px-4 font-normal outline-none"
                  value={birthdate}
                  onChange={(e) => {
                    setBirthdate(e.target.value);
                    if (err === "18") setErr("");
                  }}
                />
                <span className="mt-2 block text-sm font-normal text-muted">You must be 18 or older.</span>
                {err === "18" ? (
                  <span className="mt-1 block text-sm font-normal text-rust">The birthday you entered is under 18.</span>
                ) : null}
              </label>
              <fieldset>
                <legend className="text-base font-medium">What do you use this for?</legend>
                <p className="mt-1 text-sm text-muted">
                  Pick every category that fits. Matching uses this when you want someone similar or different.
                </p>
                <div className="mt-2">
                  <CategoryPicker
                    value={categories}
                    onChange={(ids) => {
                      setCategories(ids);
                      if (err === "categories") setErr("");
                    }}
                  />
                </div>
                {err === "categories" ? (
                  <span className="mt-2 block text-sm text-rust">Pick at least one.</span>
                ) : null}
              </fieldset>
              <LookFields name={name} color={color} photo={photo} onColor={setColor} onPhoto={setPhoto} />
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={tos}
                  onChange={(e) => {
                    setTos(e.target.checked);
                    if (err === "tos") setErr("");
                  }}
                />
                <span>
                  I am 18 or older. I have read and agree to the{" "}
                  <Link to="/terms" className="underline">
                    terms of use
                  </Link>
                  .
                </span>
              </label>
              {err === "tos" ? <p className="text-sm text-rust">Agree to the terms to continue.</p> : null}
              {err && err !== "18" && err !== "categories" && err !== "tos" ? (
                <p className="text-sm text-rust">{err === "name" ? "Name is required." : err}</p>
              ) : null}
              <Btn type="submit" kind="fill" className="h-12 w-full" disabled={busy}>
                continue
              </Btn>
            </form>
          )}
        </div>
        <div className="relative hidden -translate-y-16 md:flex md:justify-end">
          <div className="flex w-80 flex-col items-center text-center">
            <Mark className="h-52 w-36" />
            <p className="mt-8 text-3xl font-semibold tracking-tight">Buddy System</p>
          </div>
        </div>
      </section>
    </main>
  );
}

function Bolt() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 text-rust" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M13 2L4 14h7l-1 8 10-14h-7l0-6z" strokeLinejoin="round" />
    </svg>
  );
}

function Cal() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 text-rust" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M4 10h16" />
    </svg>
  );
}

function Folk() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 text-rust" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="9" cy="8" r="3" />
      <path d="M4 19c.5-3 2.5-5 5-5s4.5 2 5 5" />
      <circle cx="17" cy="9" r="2.2" />
      <path d="M16 19c.3-2 1.4-3.4 3-4" />
    </svg>
  );
}
