const PENDING_KEY = "buddy-push-sub";

function urlBase64ToUint8Array(value: string) {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export function iosNeedsHomeScreen() {
  const ua = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return ios && !standalone;
}

async function subscribeThisDevice() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    throw new Error("This browser cannot send notifications.");
  }
  if (iosNeedsHomeScreen()) {
    throw new Error("On iPhone, add Buddy System to your home screen first. Then open it from the icon and turn this on.");
  }
  const ready = await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).then(() => navigator.serviceWorker.ready);
  const keyRes = await fetch("/api/push");
  const keyBody = (await keyRes.json().catch(() => null)) as { publicKey?: string } | null;
  if (!keyRes.ok || !keyBody?.publicKey) throw new Error("Reminders are not turned on yet.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notifications stayed off.");
  const sub = await ready.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(keyBody.publicKey),
  });
  const json = sub.toJSON();
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(json));
  return json;
}

export async function savePreparedReminders(token: string) {
  const raw = sessionStorage.getItem(PENDING_KEY);
  if (!raw || !token) return;
  const saved = await fetch("/api/push", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, subscription: JSON.parse(raw) as unknown }),
  });
  const body = (await saved.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (!saved.ok || !body?.ok) throw new Error(body?.error || "Could not save this device.");
  sessionStorage.removeItem(PENDING_KEY);
  localStorage.setItem("buddy-push", "1");
}

export function clearPreparedReminders() {
  sessionStorage.removeItem(PENDING_KEY);
}

export async function prepareBookingReminders() {
  await subscribeThisDevice();
}

export async function enableBookingReminders(token: string) {
  await subscribeThisDevice();
  await savePreparedReminders(token);
}
