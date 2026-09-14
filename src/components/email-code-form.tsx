import { useId, useState } from "react";
import { Btn } from "@/components/btn";
import { isEmail } from "@/lib/school";
import { cn } from "@/lib/utils";

export function EmailCodeForm({
  label,
  hint,
  placeholder,
  sendLabel = "Email me a code",
  verifyLabel = "Verify",
  onDark = false,
  hero = false,
  validate,
  send,
  verify,
}: {
  label: string;
  hint: string;
  placeholder: string;
  sendLabel?: string;
  verifyLabel?: string;
  onDark?: boolean;
  hero?: boolean;
  validate?: (email: string) => string | null;
  send: (email: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  verify: (email: string, code: string) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const emailId = useId();
  const codeId = useId();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const field = hero
    ? "h-14 w-full rounded-full border border-ink/10 bg-cream px-6 text-base shadow-[0_1px_2px_rgba(28,25,51,0.04)] outline-none placeholder:text-muted"
    : onDark
      ? "mt-2 h-12 w-full rounded-xl border border-paper/15 bg-paper/5 px-3 text-paper outline-none"
      : "mt-2 h-12 w-full rounded-xl border border-ink/10 bg-paper px-3 font-normal outline-none";

  async function sendCode() {
    const extra = validate?.(email);
    if (extra) return setErr(extra);
    if (!isEmail(email)) return setErr("Enter a real email address.");
    setBusy(true);
    setErr("");
    try {
      const res = await send(email);
      if (!res.ok) setErr(res.error);
      else {
        setSent(true);
        setCode("");
      }
    } catch {
      setErr("Could not send the email. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function check() {
    if (!/^\d{6}$/.test(code)) return setErr("Enter the 6-digit code.");
    setBusy(true);
    setErr("");
    try {
      const res = await verify(email, code);
      if (!res.ok) setErr(res.error);
    } catch {
      setErr("Could not verify. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (hero) {
    return (
      <div className="flex max-w-md flex-col gap-4">
        <label className="sr-only" htmlFor={emailId}>
          {label}
        </label>
        <input
          id={emailId}
          type="email"
          inputMode="email"
          autoComplete="email"
          className={field}
          value={email}
          placeholder={placeholder}
          onChange={(e) => {
            setEmail(e.target.value);
            setErr("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void sendCode();
            }
          }}
        />
        <Btn type="button" kind="fill" className="h-12 self-start px-6" disabled={busy} onClick={() => void sendCode()}>
          {sent ? "Send new code" : sendLabel}
          <span className="ml-2" aria-hidden>
            →
          </span>
        </Btn>
        {sent ? (
          <>
            <p className="text-sm text-muted">Check that inbox. The code expires in 10 minutes.</p>
            <label className="text-sm font-medium" htmlFor={codeId}>
              6-digit code
              <input
                id={codeId}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                className={cn(field, "mt-2 tracking-[0.4em]")}
                value={code}
                placeholder="000000"
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
            </label>
            <Btn type="button" kind="fill" className="h-12 self-start px-6" disabled={busy} onClick={() => void check()}>
              {verifyLabel}
            </Btn>
          </>
        ) : null}
        {err ? <p className="text-sm text-rust">{err}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex max-w-md flex-col gap-4">
      <p className="text-base text-muted">{hint}</p>
      <label className="text-base font-medium" htmlFor={emailId}>
        {label}
        <input
          id={emailId}
          type="email"
          inputMode="email"
          autoComplete="email"
          className={field}
          value={email}
          placeholder={placeholder}
          onChange={(e) => {
            setEmail(e.target.value);
            setErr("");
          }}
        />
      </label>
      <Btn type="button" kind={onDark ? "paper" : "fill"} className="self-start" disabled={busy} onClick={() => void sendCode()}>
        {sent ? "Send new code" : sendLabel}
      </Btn>
      {sent ? (
        <>
          <p className="text-sm text-muted">Check that inbox. The code expires in 10 minutes.</p>
          <label className="text-base font-medium" htmlFor={codeId}>
            6-digit code
            <input
              id={codeId}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className={cn(field, "tracking-[0.4em]")}
              value={code}
              placeholder="000000"
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
          </label>
          <Btn type="button" kind={onDark ? "paper" : "fill"} className="self-start" disabled={busy} onClick={() => void check()}>
            {verifyLabel}
          </Btn>
        </>
      ) : null}
      {err ? <p className="text-sm text-rust">{err}</p> : null}
    </div>
  );
}
