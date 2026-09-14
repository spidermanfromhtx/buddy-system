import { useEffect, useState } from "react";
import { Btn } from "@/components/btn";

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice?: Promise<{ outcome: string }> };

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function InstallApp({ className }: { className?: string }) {
  const [deferred, setDeferred] = useState<PromptEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (isStandalone()) setDone(true);
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as PromptEvent);
    };
    const onInstalled = () => {
      setDone(true);
      setDeferred(null);
      setOpen(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (done) return null;

  async function onClick() {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice?.catch(() => null);
      if (choice?.outcome === "accepted") setDone(true);
      setDeferred(null);
      return;
    }
    setOpen(true);
  }

  return (
    <>
      <Btn className={className ?? "h-10 rounded-full border border-ink/15 bg-transparent px-4 text-sm text-ink hover:bg-paper-2"} kind="line" onClick={() => void onClick()}>
        Download app
      </Btn>
      {open ? (
        <div className="fixed inset-0 z-40 flex items-end bg-night/50 md:items-center md:justify-center" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-md rounded-t-3xl bg-paper p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-ink md:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-display text-2xl tracking-tight">Add Buddy System</p>
            {isIos() ? (
              <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm">
                <li>Tap Share (the square with the arrow).</li>
                <li>Tap Add to Home Screen.</li>
                <li>Tap Add. It shows up like an app.</li>
              </ol>
            ) : (
              <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm">
                <li>Chrome or Edge: menu → Save and share → Install Buddy System. Or the install icon in the address bar.</li>
                <li>Safari on a Mac: Share → Add to Dock.</li>
                <li>It opens in its own window, like an app.</li>
              </ol>
            )}
            <Btn kind="fill" className="mt-6 w-full" onClick={() => setOpen(false)}>
              Close
            </Btn>
          </div>
        </div>
      ) : null}
    </>
  );
}
