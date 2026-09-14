import { useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Btn } from "@/components/btn";
import { CategoryPicker } from "@/components/category-picker";
import { EmailCodeForm } from "@/components/email-code-form";
import { InstallApp } from "@/components/install-app";
import { LookFields } from "@/components/look-fields";
import { Mark } from "@/components/mark";
import { createAccount, requestAccountCode, verifyAccountCode } from "@/lib/account";
import { profileFromAccount, type Profile } from "@/lib/profile";
import { ageFromBirthdate } from "@/lib/utils";

function Sparkle() {
  return (
    <svg viewBox="0 0 48 48" className="absolute -right-8 top-1 size-10 text-rust md:-right-14 md:size-14" aria-hidden>
      <path
        fill="currentColor"
        d="M24 2l2.4 16.2L40 14l-10.2 9.2L38 36l-14-8.4L10 36l8.2-12.8L8 14l13.6 4.2z"
      />
    </svg>
  );
}

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
    <main className="relative min-h-dvh overflow-hidden bg-paper text-ink">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -right-24 top-10 size-[28rem] rounded-full bg-[#ddd6f5] opacity-80 blur-2xl" />
        <div className="absolute -bottom-28 -right-16 size-[32rem] rounded-full bg-[#d4ead8] opacity-90 blur-2xl" />
        <div className="absolute -bottom-10 left-[-8%] size-72 rounded-full bg-[#efe8dc] opacity-70 blur-2xl" />
      </div>
      <header className="relative z-10 flex items-center justify-between px-5 py-5 md:px-10">
        <div className="flex items-center gap-2.5">
          <Mark className="size-9" />
          <p className="text-lg font-semibold tracking-tight">Buddy System</p>
        </div>
        <InstallApp />
      </header>
      <section className="relative z-10 mx-auto flex w-full max-w-2xl flex-col px-6 pb-16 pt-6 md:pt-16">
        {!pending ? (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-rust">
              Real support. Real people.
            </p>
            <h1 className="relative mt-4 max-w-xl text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
              The phone rings.
              <br />
              You work. You hang up.
              <Sparkle />
            </h1>
            <p className="mt-5 max-w-md text-base text-muted md:text-lg">
              Find a live buddy. Schedule a buddy. Be a buddy. 18+.
            </p>
            <div className="mt-8">
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
            <ul className="mt-14 flex flex-wrap gap-x-8 gap-y-3 text-sm text-muted">
              <li className="flex items-center gap-2">
                <Bolt />
                Real people
              </li>
              <li className="flex items-center gap-2">
                <Cal />
                Easy scheduling
              </li>
              <li className="flex items-center gap-2">
                <Folk />
                A healthier you
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
                className="mt-2 h-11 w-full rounded-full border border-ink/10 bg-cream px-4 font-normal outline-none"
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
                className="mt-2 h-11 w-full rounded-full border border-ink/10 bg-cream px-4 font-normal outline-none"
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
              <p className="mt-1 text-sm text-muted">Pick every category that fits. Matching uses this when you want someone similar or different.</p>
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
                I am 18 or older. I agree to the{" "}
                <Link to="/terms" className="underline">
                  terms
                </Link>
                : ratings are anonymous to the other person and public to users. Reports can warn or close an account based on the language used.
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
      </section>
    </main>
  );
}

function Bolt() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 text-rust" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M13 2L4 14h7l-1 8 10-14h-7l0-6z" strokeLinejoin="round" />
    </svg>
  );
}

function Cal() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 text-rust" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M4 10h16" />
    </svg>
  );
}

function Folk() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 text-rust" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="9" cy="8" r="3" />
      <circle cx="16" cy="9" r="2.4" />
      <path d="M3.5 19c.6-3 3-5 5.5-5s4.9 2 5.5 5M14 14c2.2.2 4 1.8 4.7 5" />
    </svg>
  );
}
