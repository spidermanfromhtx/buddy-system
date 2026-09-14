export function PageWash({ dark = false }: { dark?: boolean }) {
  return (
    <div className={`pointer-events-none fixed inset-0 z-0 overflow-hidden ${dark ? "bg-night" : "bg-paper"}`} aria-hidden>
      <div className="absolute -right-32 top-28 size-[32rem] rounded-full bg-sage opacity-90 blur-2xl" />
      <div className="absolute -bottom-24 -right-10 size-[36rem] rounded-full bg-tri opacity-70 blur-2xl" />
      <div className="absolute -bottom-6 left-[-8%] size-80 rounded-full bg-rust/45 opacity-90 blur-2xl" />
    </div>
  );
}
