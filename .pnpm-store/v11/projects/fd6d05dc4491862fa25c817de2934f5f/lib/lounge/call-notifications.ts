const NOTIF_ICON = "/icon.png";

type HubNotificationOptions = NotificationOptions & {
  renotify?: boolean;
};

export async function requestCallNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    const result = await Notification.requestPermission();
    return result === "granted";
  } catch {
    return false;
  }
}

export function showCallNotification(callerName: string, callType: string): void {
  if (typeof window === "undefined") return;
  if (Notification.permission !== "granted") return;
  const notification = new Notification(`Incoming ${callType} call`, {
    body: `${callerName} is calling you`,
    icon: NOTIF_ICON,
    tag: "incoming-call",
    renotify: true,
    requireInteraction: true,
  } as HubNotificationOptions);
  notification.onclick = () => {
    window.focus();
    notification.close();
  };
}
