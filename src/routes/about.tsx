import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Btn } from "@/components/btn";
import { Mark } from "@/components/mark";
import { PageWash } from "@/components/page-wash";
import { FREE_MAX_MIN, FREE_SESSIONS, PLUS_MAX_MIN, PLUS_PRICE_LABEL, PRO_PRICE_LABEL } from "@/lib/plan";
import { loadProfile } from "@/lib/profile";

export const Route = createFileRoute("/about")({ component: About });

function About() {
  const nav = useNavigate();
  const me = typeof window !== "undefined" ? loadProfile() : null;
  return (
    <main className="relative isolate z-10 min-h-dvh bg-transparent text-ink">
      <PageWash />
      <header className="relative z-20 flex items-center justify-between gap-3 px-4 pb-3 pt-[max(3.85rem,calc(env(safe-area-inset-top)+2.25rem))] md:px-10 md:pt-5">
        <div className="flex min-w-0 items-center gap-2">
          <Mark />
          <p className="truncate text-base font-semibold tracking-tight">Buddy System</p>
        </div>
        <Btn className="h-9 px-4 text-sm" onClick={() => void nav({ to: me ? "/feed" : "/" })}>
          {me ? "Feed" : "Home"}
        </Btn>
      </header>
      <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-col gap-8 px-5 pb-16 pt-7">
        <div>
          <p className="text-sm text-muted">18+</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight md:text-5xl">What is the Buddy System?</h1>
          <p className="mt-4 text-lg text-muted">
            Body doubling. You list a task. The call rings. You work. You hang up.
          </p>
        </div>

        <section className="panel p-6">
          <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
          <ul className="mt-4 flex flex-col gap-3 text-base text-ink/80">
            <li>
              <span className="font-medium text-ink">Go live.</span> Put a task on the feed. Someone calls you. You start.
            </li>
            <li>
              <span className="font-medium text-ink">Join live.</span> See people who are open. Call if you can match their time.
            </li>
            <li>
              <span className="font-medium text-ink">Book a window.</span> Add a time to the queue. Wait for a match, or be
              someone else’s buddy.
            </li>
            <li>
              <span className="font-medium text-ink">Campus.</span> Add a school email in settings. Then you can filter to
              people at that school.
            </li>
            <li>
              <span className="font-medium text-ink">On the call.</span> Audio is the point. Camera is optional. Mute when
              you need. Stretch pings both of you.
            </li>
          </ul>
        </section>

        <div className="grid gap-4 md:grid-cols-3">
          <section className="panel p-6">
            <p className="text-sm text-muted">Free</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">Start here</h2>
            <ul className="mt-4 flex flex-col gap-2 text-base text-ink/80">
              <li>{FREE_SESSIONS} sessions a week</li>
              <li>Up to {FREE_MAX_MIN} minutes each</li>
              <li>Go live, join, or book</li>
              <li>Camera on or off</li>
            </ul>
          </section>
          <section className="panel p-6">
            <p className="text-sm text-muted">Plus · {PLUS_PRICE_LABEL}</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">Keep going</h2>
            <ul className="mt-4 flex flex-col gap-2 text-base text-ink/80">
              <li>Unlimited sessions</li>
              <li>Calls up to {PLUS_MAX_MIN / 60} hours</li>
              <li>Same feed, same matching</li>
            </ul>
          </section>
          <section className="panel p-6">
            <p className="text-sm text-muted">Pro · {PRO_PRICE_LABEL}</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">Show the work</h2>
            <ul className="mt-4 flex flex-col gap-2 text-base text-ink/80">
              <li>Everything in Plus</li>
              <li>Share a window so your buddy can see the work</li>
            </ul>
          </section>
        </div>

        <p className="text-sm text-muted">
          Not a tutor. Not a companion app. Not social media. No DMs. You must be 18.{" "}
          <Link to="/terms" className="underline">
            Terms
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
