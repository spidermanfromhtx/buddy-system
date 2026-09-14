import { createFileRoute, Link } from "@tanstack/react-router";
import { Mark } from "@/components/mark";
import { PageWash } from "@/components/page-wash";

export const Route = createFileRoute("/terms")({ component: Terms });

function Terms() {
  return (
    <main className="relative z-10 min-h-dvh bg-transparent px-6 py-10 text-ink">
      <PageWash />
      <div className="relative z-10 mx-auto flex max-w-xl flex-col gap-5">
        <div className="flex items-center gap-3">
          <Mark />
          <h1 className="font-display text-3xl tracking-tight">Terms</h1>
        </div>
        <p className="text-sm text-muted">Buddy System. 18+ body-doubling calls. Last updated September 2026.</p>
        <p>You must be 18 or older. This is a work call, not therapy, dating, or tutoring.</p>
        <p>No DMs. Stay on the call. Hang up if it feels wrong.</p>
        <p>
          After a call you can rate the other person. Ratings are anonymous to them and public to other users, so people
          can see a poorly rated buddy before they join.
        </p>
        <p>
          You can report a call or a person. We read the language in the report. Serious harm language can close an
          account. Other reports can send a warning email. Repeat reports can close the account.
        </p>
        <p>We may email a warning or a close notice to the address on the account. We do not name who reported.</p>
        <p>Do not record people without their say-so. Do not use this to meet minors. Do not harass.</p>
        <Link to="/join" className="text-sm text-muted underline">
          Back
        </Link>
      </div>
    </main>
  );
}
