// System notifications through the browser's Notification API only — no push
// server, no service worker, no network. Feature-detected: a plain iOS Safari
// tab has no `Notification`, and Android Chrome throws on `new Notification`
// without a service worker, so every call is guarded.

export function systemNotifySupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function systemPermission(): NotificationPermission | "unsupported" {
  return systemNotifySupported() ? Notification.permission : "unsupported";
}

export async function askSystemPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!systemNotifySupported()) return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/** Shows a notification only while the app is in the background. */
export function notifyInBackground(title: string, body: string, tag: string, onClick?: () => void): void {
  if (!systemNotifySupported() || Notification.permission !== "granted" || document.visibilityState !== "hidden") return;
  try {
    const n = new Notification(title, { body, tag, icon: "/icon-192.png" });
    n.onclick = () => {
      window.focus();
      onClick?.();
      n.close();
    };
  } catch {
    /* no service worker on this platform — the in-app banner still shows */
  }
}
