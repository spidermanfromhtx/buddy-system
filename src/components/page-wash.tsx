import { useEffect, useState } from "react";

type Blob = { x: number; y: number; s: number; color: string; o: number };

function makeBlobs(): Blob[] {
  const colors = ["var(--rust)", "var(--sage)", "var(--tri)", "var(--rust)", "var(--sage)", "var(--tri)"];
  return colors.map((color) => ({
    x: Math.random() * 120 - 20,
    y: Math.random() * 120 - 20,
    s: 11 + Math.random() * 24,
    color,
    o: 0.35 + Math.random() * 0.5,
  }));
}

export function PageWash({ dark = false }: { dark?: boolean }) {
  const [blobs, setBlobs] = useState<Blob[]>([]);
  useEffect(() => {
    setBlobs(makeBlobs());
  }, []);

  return (
    <div className={`pointer-events-none fixed inset-0 z-0 overflow-hidden ${dark ? "bg-night" : "bg-paper"}`} aria-hidden>
      {blobs.map((b, i) => (
        <div
          key={i}
          className="absolute rounded-full blur-2xl"
          style={{
            left: `${b.x}%`,
            top: `${b.y}%`,
            width: `${b.s}rem`,
            height: `${b.s}rem`,
            background: b.color,
            opacity: b.o,
          }}
        />
      ))}
    </div>
  );
}
