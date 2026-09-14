import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Btn } from "@/components/btn";
import { CategoryPicker } from "@/components/category-picker";
import { EmailCodeForm } from "@/components/email-code-form";
import { LookFields } from "@/components/look-fields";
import { Mark } from "@/components/mark";
import { createAccount, requestAccountCode, verifyAccountCode } from "@/lib/account";
import { COLORS, profileFromAccount, type Profile } from "@/lib/profile";
import { ageFromBirthdate } from "@/lib/utils";

export function JoinForm({ onJoined }: { onJoined?: (p: Profile) => void }) {
  const nav = useNavigate();
  const [pending, setPending] = useState<{ email: string; token: string } | null>(null);
  const [name, setName] = useState("");
  const [birthdate, setBirthdate] = useState("2004-01-01");
  const [color, setColor] = useState(COLORS[0]);
  const [photo, setPhoto] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
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
    <main className="min-h-dvh bg-night text-paper [color-scheme:dark]">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-10 px-6 py-16">
        <div className="flex items-center justify-center gap-3">
          <Mark onDark />
          <h1 className="font-display text-5xl tracking-tight text-paper md:text-6xl">Buddy System</h1>
        </div>
        {!pending ? (
          <EmailCodeForm
            onDark
            label="Email"
            hint="Log in or create an account. Gmail, Yahoo, school mail, whatever you use. We email a 6-digit code. New accounts get 8 free 45-minute sessions."
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
        ) : (
          <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-6">
            <p className="text-base text-muted">Verified {pending.email}. Finish your profile.</p>
            <label className="text-base text-muted" htmlFor="join-name">
              Your name
              <input
                id="join-name"
                name="name"
                className="mt-2 h-11 w-full rounded-xl border border-paper/15 bg-paper/5 px-3 text-paper outline-none"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="nickname"
              />
            </label>
            <label className="text-base text-muted" htmlFor="join-birthdate">
              Birthdate
              <input
                id="join-birthdate"
                type="date"
                className="mt-2 h-11 w-full rounded-xl border border-paper/15 bg-paper/5 px-3 text-paper outline-none"
                value={birthdate}
                onChange={(e) => {
                  setBirthdate(e.target.value);
                  if (err === "18") setErr("");
                }}
              />
              <span className="mt-2 block text-sm text-muted">You must be 18 or older.</span>
              {err === "18" ? (
                <span className="mt-1 block text-sm text-rust">The birthday you entered is under 18.</span>
              ) : null}
            </label>
            <fieldset>
              <legend className="text-base font-medium">What do you use this for?</legend>
              <p className="mt-1 text-sm text-muted">Pick every category that fits. Matching uses this when you want someone similar or different.</p>
              <CategoryPicker multiple value={categories} onChange={setCategories} onDark />
              {err === "categories" ? (
                <span className="mt-2 block text-sm text-rust">Pick at least one.</span>
              ) : null}
            </fieldset>
            <LookFields name={name} color={color} photo={photo} onColor={setColor} onPhoto={setPhoto} onDark />
            <div className="flex flex-col gap-2 border-t border-paper/10 pt-6 text-base text-muted">
              <p>Find a live buddy. Call someone who is open.</p>
              <p>Schedule a buddy. Book a window. The call rings.</p>
              <p>Be a buddy. Tap Go live with a task description.</p>
            </div>
            {err && err !== "18" && err !== "categories" ? (
              <p className="text-sm text-rust">{err === "name" ? "Name is required." : err}</p>
            ) : null}
            <Btn type="submit" kind="paper" className="h-12 w-full" disabled={busy}>
              continue
            </Btn>
          </form>
        )}
      </div>
    </main>
  );
}
