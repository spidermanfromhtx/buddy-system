export function PageWash({ dark = false }: { dark?: boolean }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${dark ? "bg-night" : "bg-paper"}`} aria-hidden>
      <div className="absolute -right-24 top-10 size-[28rem] rounded-full bg-sage opacity-80 blur-2xl" />
      <div className="absolute -bottom-28 -right-16 size-[32rem] rounded-full bg-tri opacity-50 blur-2xl" />
      <div className="absolute -bottom-8 left-[-6%] size-72 rounded-full bg-rust/25 opacity-80 blur-2xl" />
    </div>
  );
}
