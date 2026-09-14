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
    <main className="min-h-dvh bg-paper text-ink md:grid md:grid-cols-2">
      <section className="px-6 py-6 md:flex md:min-h-dvh md:flex-col md:justify-center md:px-12 md:py-12">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Mark className="size-10" />
            <p className="font-display text-xl tracking-tight">Buddy System</p>
          </div>
          <InstallApp />
        </div>
        <h1 className="mt-4 font-display text-3xl tracking-tight md:mt-10 md:text-6xl">
          The phone rings. You work. You hang up.
        </h1>
        <p className="mt-3 max-w-sm text-sm text-muted md:mt-5 md:text-base">
          Find a live buddy. Schedule a buddy. Be a buddy. 18+.
        </p>
      </section>
      <section className="border-t border-ink/10 px-6 py-8 md:flex md:min-h-dvh md:items-start md:border-l md:border-t-0 md:px-12 md:py-16">
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
        </div>
      </section>
    </main>
  );
}
