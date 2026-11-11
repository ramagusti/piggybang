import { api } from "@/lib/api";

/** Web Push for this device. iPhone/iPad only expose it once the app is installed to the home screen. */
export const pushSupported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

const registration = () => navigator.serviceWorker.register("/sw.js");

export async function pushEnabled() {
  if (!pushSupported() || Notification.permission !== "granted") return false;
  return !!(await (await navigator.serviceWorker.getRegistration("/sw.js"))?.pushManager.getSubscription());
}

/** Must run from a click: asks the browser's permission, then registers the device with the API. */
export async function enablePush() {
  if ((await Notification.requestPermission()) !== "granted") return false;
  const { key } = await api<{ key: string | null }>("/push/key");
  if (!key) throw new Error("Push is not configured on the server");
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  await api("/push/subscriptions", { method: "POST", body: sub.toJSON() });
  return true;
}

export async function disablePush() {
  if (!pushSupported()) return;
  const sub = await (await navigator.serviceWorker.getRegistration("/sw.js"))?.pushManager.getSubscription();
  if (!sub) return;
  await api("/push/subscriptions", { method: "DELETE", body: { endpoint: sub.endpoint } }).catch(() => {});
  await sub.unsubscribe();
}
