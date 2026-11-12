// Local notifications. Uses Capacitor LocalNotifications on the phone; logs to the console in a browser.
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const native = () => Capacitor.isNativePlatform();

/** Ask for notification permission. Resolves to true if granted. */
export async function requestPermission() {
  if (!native()) return true;
  const { display } = await LocalNotifications.requestPermissions();
  return display === 'granted';
}

/** Cancel all pending notifications, then schedule `list` ({ id, at, title, body, section }). */
export async function replaceAll(list) {
  if (!native()) {
    console.info('[notifications] would schedule', list.map((n) => `${n.at.toISOString?.() ?? n.at} ${n.title}: ${n.body}`));
    return;
  }
  const { notifications: pending } = await LocalNotifications.getPending();
  if (pending.length) await LocalNotifications.cancel({ notifications: pending.map((n) => ({ id: n.id })) });
  if (!list.length) return;
  await LocalNotifications.schedule({
    notifications: list.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      schedule: { at: new Date(n.at), allowWhileIdle: true },
      extra: { section: n.section },
    })),
  });
}

/** Call handler(section) when the user taps a notification. Returns an unsubscribe function. */
export function onTap(handler) {
  if (!native()) return () => {};
  const p = LocalNotifications.addListener('localNotificationActionPerformed', (e) => {
    handler(e?.notification?.extra?.section ?? null);
  });
  return () => { p.then((h) => h.remove()); };
}
