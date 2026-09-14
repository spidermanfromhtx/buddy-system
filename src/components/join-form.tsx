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
  const [color, setColor] = useState<string>(COLORS[0]);
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
    <main className="min-h-dvh bg-night text-paper [color-scheme:dark] md:grid md:grid-cols-2">
      <section className="flex flex-col justify-between px-8 py-12 md:min-h-dvh md:px-12">
        <div className="flex items-center gap-3">
          <Mark onDark className="size-12" />
          <p className="font-display text-2xl tracking-tight">Buddy System</p>
        </div>
        <div className="mt-16 md:mt-0">
          <h1 className="font-display text-5xl tracking-tight md:text-7xl">
            The phone rings.
            <br />
            You work.
            <br />
            You hang up.
          </h1>
          <p className="mt-6 max-w-sm text-base text-paper/60">
            Find a live buddy. Schedule a buddy. Be a buddy. 18+.
          </p>
        </div>
      </section>
      <section className="bg-paper px-6 py-12 text-ink md:flex md:min-h-dvh md:items-center md:px-12">
        <div className="mx-auto w-full max-w-md">
        {!pending ? (
          <EmailCodeForm
            label="Email"
            hint="Log in or create an account. Gmail, Yahoo, school mail, whatever you use. We email a 6-digit code."
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
            <label className="text-base font-medium" htmlFor="join-name">
              Your name
              <input
                id="join-name"
                name="name"
                className="mt-2 h-11 w-full rounded-xl border border-ink/10 bg-paper px-3 font-normal outline-none"
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
                className="mt-2 h-11 w-full rounded-xl border border-ink/10 bg-paper px-3 font-normal outline-none"
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
              <CategoryPicker
                multiple
                value={categories}
                onChange={(ids) => {
                  setCategories(ids);
                  if (err === "categories") setErr("");
                }}
              />
              {err === "categories" ? (
                <span className="mt-2 block text-sm text-rust">Pick at least one.</span>
              ) : null}
            </fieldset>
            <LookFields name={name} color={color} photo={photo} onColor={setColor} onPhoto={setPhoto} />
            {err && err !== "18" && err !== "categories" ? (
              <p className="text-sm text-rust">{err === "name" ? "Name is required." : err}</p>
            ) : null}
            <Btn type="submit" kind="fill" className="h-12 w-full" disabled={busy}>
              continue
            </Btn>
          </form>
        )}
        </div>
      </section>
    </main>
  );
}
