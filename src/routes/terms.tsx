import { createFileRoute, Link } from "@tanstack/react-router";
import { Mark } from "@/components/mark";
import { PageWash } from "@/components/page-wash";

export const Route = createFileRoute("/terms")({ component: Terms });

function Terms() {
  return (
    <main className="relative z-10 min-h-dvh bg-transparent px-6 py-10 text-ink">
      <PageWash />
      <div className="relative z-10 mx-auto flex max-w-xl flex-col gap-8">
        <div className="flex items-center gap-3">
          <Mark />
          <div>
            <h1 className="font-display text-3xl tracking-tight">How we show up</h1>
            <p className="mt-1 text-sm text-muted">Buddy System · last updated September 2026</p>
          </div>
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl tracking-tight">What this is</h2>
          <p>
            Buddy System is a quiet work call. You list a task, someone sits with you, you both get going. It is not
            therapy, not dating, and not tutoring. Most of the time you barely talk. That is the point.
          </p>
          <p>You need to be 18 or older to use it. We check a birthday when you join.</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl tracking-tight">On a call</h2>
          <p>
            Stay on the call for the session you signed up for. There are no DMs — if you need to say something, say it
            out loud, then get back to work.
          </p>
          <p>
            If a call feels off, hang up. You do not owe anyone an explanation. Leave, report if you want, and we will
            take it from there.
          </p>
          <p>
            Do not record someone unless they clearly say it is okay. Do not comment on bodies, hit on people, or use
            this to meet anyone under 18. Be the kind of person you would want on the other end of the line.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl tracking-tight">Ratings</h2>
          <p>
            After a call you can leave a rating. The other person will not see that it came from you. Other people on
            the app can see a buddy’s overall rating, so they can skip someone who has not been a good sit.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl tracking-tight">If something goes wrong</h2>
          <p>
            You can report a call or a person. We read what you write. We do not tell them who reported. We may email
            the address on their account with a warning, or we may close the account.
          </p>
          <p>
            Language about real harm, threats, or kids is treated as serious and can close an account on the first
            report. Smaller stuff usually starts with a warning. Repeated reports can close an account too.
          </p>
          <p>We would rather a few people get a second chance than anyone feel unsafe on a call.</p>
        </section>

        <p className="text-sm text-muted">Using Buddy System means you are okay with this. Questions? Email the address you signed up with and we will write back.</p>

        <Link to="/join" className="text-sm text-muted underline">
          Back
        </Link>
      </div>
    </main>
  );
}
