import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { applyColorTheme } from "@/lib/theme";
import appCss from "../styles.css?url";
import { useEffect, useState } from "react";

const APP_NAME = "Buddy System";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: APP_NAME },
      { name: "theme-color", content: "#f5f4f2" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: APP_NAME },
      { name: "application-name", content: APP_NAME },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      {
        name: "description",
        content: "18+ body-doubling calls. List a task description. The call rings. You work. You hang up.",
      },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&display=swap",
      },
    ],
  }),
  component: Root,
});

function Root() {
  const [client] = useState(() => new QueryClient());
  useEffect(() => {
    applyColorTheme();
    const reloadOnce = () => {
      try {
        if (sessionStorage.getItem("bs-chunk") === "1") return;
        sessionStorage.setItem("bs-chunk", "1");
      } catch {
        return;
      }
      window.location.reload();
    };
    const onPreload = (e: Event) => {
      e.preventDefault();
      reloadOnce();
    };
    const onError = (e: PromiseRejectionEvent) => {
      const msg = e.reason instanceof Error ? e.reason.message : String(e.reason ?? "");
      if (msg.includes("dynamically imported module") || msg.includes("Importing a module script failed")) {
        e.preventDefault();
        reloadOnce();
      }
    };
    window.addEventListener("vite:preloadError", onPreload);
    window.addEventListener("unhandledrejection", onError);
    return () => {
      window.removeEventListener("vite:preloadError", onPreload);
      window.removeEventListener("unhandledrejection", onError);
    };
  }, []);
  return (
    <html lang="en" data-theme="default" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="font-sans antialiased">
        <PreviewHostBridge />
        <AuthProvider>
          <QueryClientProvider client={client}>
            <Outlet />
          </QueryClientProvider>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
