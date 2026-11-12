// Keeps Android's pending notifications equal to the reminder schedule, and
// opens the matching section when a notification is tapped. Thin glue: the
// decisions live in ./reminder-plan.js and ../core/reminders.js.
import { store } from '../adapters/storage.js';
import * as notifications from '../adapters/notifications.js';
import { navigate } from '../router.js';
import { planReminders, scheduleKey, tapPath } from './reminder-plan.js';

const DEBOUNCE_MS = 500;

let started = false;
let granted = false;
let lastKey = null;
let timer = null;
// Serialises replaceAll calls so cancel/schedule pairs never interleave.
let queue = Promise.resolve();

async function askPermission() {
  try {
    granted = (await notifications.requestPermission()) === true;
  } catch (err) {
    granted = false;
    console.warn('[reminders] permission request failed', err);
  }
  return granted;
}

/** Recompute the schedule and hand it to the notifications adapter. */
function sync() {
  queue = queue.then(async () => {
    try {
      if (!granted && !(await askPermission())) return;
      const now = new Date();
      const state = store.get();
      const list = planReminders(state, now);
      await notifications.replaceAll(list);
      lastKey = scheduleKey(state, now);
      console.info(`[reminders] scheduled ${list.length}`, list.map((n) => `${n.section} ${n.at.toString()}`));
    } catch (err) {
      lastKey = null; // try again on the next change or resume
      console.warn('[reminders] sync failed', err);
    }
  });
  return queue;
}

function scheduleSync() {
  clearTimeout(timer);
  timer = setTimeout(sync, DEBOUNCE_MS);
}

/** Call once at app start. Safe in a browser (the adapter only logs there). */
export function startReminderSync() {
  if (started) return;
  started = true;

  notifications.onTap((section) => {
    const path = tapPath(section);
    if (path) navigate(path);
  });

  // Only changes that can alter the schedule (not every counter tap).
  store.subscribe((state) => {
    if (scheduleKey(state, new Date()) !== lastKey) scheduleSync();
  });

  // No @capacitor/app: returning to the foreground shows up as visibilitychange.
  // Always resync then: the day may have changed or alarms may have been lost.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleSync();
  });

  sync();
}
