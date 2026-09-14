import type { ErrorComponentProps } from "@tanstack/react-router";
import { useEffect } from "react";
import { Btn } from "@/components/btn";

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return "Try reloading.";
}

function isChunkError(error: unknown) {
  const msg = errorMessage(error);
  return msg.includes("dynamically imported module") || msg.includes("Importing a module script failed") || msg.includes("Failed to fetch");
}

export function AppErrorComponent({ error }: ErrorComponentProps) {
  useEffect(() => {
    if (!isChunkError(error)) return;
    try {
      if (sessionStorage.getItem("bs-chunk") === "1") return;
      sessionStorage.setItem("bs-chunk", "1");
    } catch {
      return;
    }
    window.location.reload();
  }, [error]);

  return (
    <main className="relative z-10 flex min-h-dvh flex-col items-center justify-center gap-4 bg-transparent px-6 text-center text-ink">
      <h1 className="font-display text-3xl tracking-tight">Need a refresh</h1>
      <p className="max-w-md text-sm text-muted">{errorMessage(error)}</p>
      <Btn kind="fill" className="h-12 px-6" onClick={() => window.location.reload()}>
        Reload
      </Btn>
    </main>
  );
}
