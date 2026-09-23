import { createFileRoute, Link } from "@tanstack/react-router";
import { Mark } from "@/components/mark";
import { PageWash } from "@/components/page-wash";

export const Route = createFileRoute("/terms")({ component: Terms });

function Terms() {
  return (
    <main className="relative z-10 min-h-dvh bg-transparent px-6 py-10 text-ink">
      <PageWash />
      <article className="relative z-10 mx-auto flex max-w-xl flex-col gap-8">
        <div className="flex items-center gap-3">
          <Mark />
          <div>
            <h1 className="font-display text-3xl tracking-tight">Terms of use</h1>
            <p className="mt-1 text-sm text-muted">Buddy System · effective September 2026</p>
          </div>
        </div>

        <p>
          These terms are the agreement between you and Buddy System when you create an account, open the app, or join
          a call. If you do not agree, do not use the service.
        </p>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl tracking-tight">1. Who can use it</h2>
          <p>
            You must be at least 18 years old. You confirm that the birthday you enter is yours and is true. We may
            close an account if we believe the person is under 18.
          </p>
          <p>You are responsible for the email on the account and for anything done while you are signed in.</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl tracking-tight">2. The service</h2>
          <p>
            Buddy System matches people for live body-doubling sessions: a video or audio call while you work on a
            task you listed. Sessions may be live, booked, or joined from the feed.
          </p>
          <p>
            This is a productivity tool. It is not medical care, therapy, counseling, tutoring, legal advice, or a
            dating service. We do not supervise what you work on during a call.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl tracking-tight">3. Plans and payment</h2>
          <p>
            New accounts start on Free: a limited number of sessions each week, with a maximum session length. Plus and
            Pro are paid monthly subscriptions billed through Stripe. Plus removes the weekly cap and raises the session
            length. Pro includes window share. Prices are shown in the app before you pay.
          </p>
          <p>
            Subscriptions renew until you cancel. Cancel in Stripe or through the payment email Stripe sends you.
            Charges already made are not refunded unless the law requires it. If a payment fails, we may move the
            account back to Free.
          </p>
          <p>
            During R&D we may turn session limits off for everyone. That does not change these terms or your plan
            once limits are on.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl tracking-tight">4. How you use it</h2>
          <p>You agree to:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Stay on the call for the session you started or joined, unless you need to leave.</li>
            <li>Use the call for work, study, or a task you listed — not to socialize, sell, recruit, or date.</li>
            <li>Not send private messages. Buddy System has no DMs on purpose.</li>
            <li>Not record, screenshot, or stream another person without their clear okay.</li>
            <li>Not harass, threaten, sexualize, or comment on someone’s body or appearance.</li>
            <li>Not use the service to contact or meet anyone under 18, or to share sexual content.</li>
            <li>Not share another person’s name, photo, or what they said outside the app in a way that identifies them, unless they ask you to.</li>
          </ul>
          <p>If a call feels wrong, hang up. You do not have to stay. Report it if you can.</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl tracking-tight">5. Ratings and reports</h2>
          <p>
            After a call you may rate the other person. That rating is anonymous to them. Other users can see a
            person’s overall rating before they join. Do not use ratings to punish someone for a normal, quiet session.
          </p>
          <p>
            You may report a call or a person. We read the report. We do not tell them who reported. We may email a
            warning to the address on the account, or we may close the account. Reports that describe harm, threats, or
            anyone under 18 can close an account on the first report. Repeated reports can also close an account.
          </p>
          <p>We decide, in good faith, how to handle a report. We are not a court.</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl tracking-tight">6. Your content and our app</h2>
          <p>
            You keep whatever you type (name, task descriptions, reviews, reports). You give us a license to store it
            and show it in the app so the product works — feed cards, ratings, matching, and safety.
          </p>
          <p>
            The Buddy System name, layout, and code are ours. You may not copy the product or scrape other people’s
            listings.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl tracking-tight">7. Privacy, in short</h2>
          <p>
            We store the email you verify, the profile you create, your school email if you add one, session history
            needed for limits and matching, ratings, reports, and payment status from Stripe. We use that to run the
            app, send login codes, and handle safety. We do not sell your list of users.
          </p>
          <p>Calls themselves go device to device. We do not keep a recording of the call audio or video.</p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl tracking-tight">8. If we have to close an account</h2>
          <p>
            We can suspend or close an account that breaks these terms, that we cannot verify as 18+, or that we
            believe puts other people at risk. We may email the address on the account. Paid time already used is not
            refunded. You can stop using the service at any time by not signing in; email us if you want the account
            deleted.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl tracking-tight">9. The fine print we still need</h2>
          <p>
            The service is provided as-is. Calls depend on your internet, your browser, and the other person showing
            up. We do not promise that you will match, that a call will stay connected, or that the other person will
            behave. Other users are not our employees or agents.
          </p>
          <p>
            To the fullest extent the law allows, Buddy System is not liable for lost work, missed deadlines, or
            anything that happens on a call between you and another user. If a court says we owe you money, it will not
            be more than what you paid us in the three months before the claim, or $50 if you are on Free.
          </p>
          <p>
            These terms are governed by the laws of the State of Michigan, United States, without regard to conflict of
            law rules. If a part of these terms cannot be enforced, the rest still applies.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl tracking-tight">10. Changes</h2>
          <p>
            We may update these terms. The date at the top will change. If a change is material, we will say so in the
            app or by email. Using Buddy System after that date means you accept the new terms.
          </p>
        </section>

        <p className="text-sm text-muted">
          Creating an account and checking the box on sign-up is your agreement to these terms. This page is the
          contract. It is not a substitute for advice from a lawyer of your own.
        </p>

        <Link to="/join" className="text-sm text-muted underline">
          Back
        </Link>
      </article>
    </main>
  );
}
