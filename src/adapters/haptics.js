// Haptic feedback. Uses Capacitor Haptics on the phone, navigator.vibrate in a browser, else no-op.
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

const native = () => Capacitor.isNativePlatform();
const vibrate = (pattern) => {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(pattern);
};

/** Light tick for each counter tap. */
export async function tap() {
  try {
    if (native()) await Haptics.impact({ style: ImpactStyle.Light });
    else vibrate(10);
  } catch { /* haptics are best-effort */ }
}

/** Strong feedback when a counter reaches its target. */
export async function success() {
  try {
    if (native()) await Haptics.notification({ type: NotificationType.Success });
    else vibrate([60, 40, 120]);
  } catch { /* haptics are best-effort */ }
}
