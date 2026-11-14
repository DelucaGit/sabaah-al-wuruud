// Persisted app state: schema, defaults and migration. Pure — no globals.

export const STATE_VERSION = 1;
export const MAX_PAGE = 604;
export const SECTIONS = ['morning', 'evening', 'sleep'];
export const THEMES = ['system', 'light', 'dark'];
// Arabic text size multiplier chosen in Settings.
export const ARABIC_SCALE = { min: 0.85, max: 1.45, default: 1 };
const MAX_NAME_LENGTH = 20;
export const PRAYERS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
// Names of adhan's CalculationMethod factories.
export const METHODS = [
  'MuslimWorldLeague', 'Egyptian', 'Karachi', 'UmmAlQura', 'Dubai',
  'MoonsightingCommittee', 'NorthAmerica', 'Kuwait', 'Qatar', 'Singapore',
  'Tehran', 'Turkey', 'Other',
];
const MAX_OFFSET_MIN = 12 * 60;

export const DEFAULT_STATE = deepFreeze({
  version: STATE_VERSION,
  settings: {
    name: 'Aisha',
    theme: 'system',
    arabicScale: ARABIC_SCALE.default,
    location: { name: 'Cairo', lat: 30.0444, lng: 31.2357 },
    method: 'Egyptian',
    reminders: {
      morning: { enabled: true, prayer: 'fajr', offsetMin: 60 },
      evening: { enabled: true, prayer: 'asr', offsetMin: 60 },
      sleep: { enabled: true, time: '22:00' },
    },
  },
  progress: { memorizedUpTo: 0 },
  pins: { morning: [], evening: [], sleep: [] },
  daily: { dayKey: null, done: {}, counters: {} },
});

/** A fresh, mutable copy of the defaults. */
export function defaultState() {
  return structuredClone(DEFAULT_STATE);
}

/**
 * Turn anything (null, garbage, an older or partial state) into a valid
 * current-version state. Known values are kept when valid, unknown keys are
 * dropped and invalid values fall back to the defaults. Never throws.
 */
export function migrate(raw) {
  const src = isObject(raw) ? raw : {};
  const d = DEFAULT_STATE;
  const settings = obj(src.settings);
  const location = obj(settings.location);
  const reminders = obj(settings.reminders);
  const daily = obj(src.daily);

  return {
    version: STATE_VERSION,
    settings: {
      name: nonEmptyString(settings.name, d.settings.name).trim().slice(0, MAX_NAME_LENGTH),
      theme: oneOf(settings.theme, THEMES, d.settings.theme),
      arabicScale: numberIn(settings.arabicScale, ARABIC_SCALE.min, ARABIC_SCALE.max, d.settings.arabicScale),
      location: {
        name: nonEmptyString(location.name, d.settings.location.name),
        lat: numberIn(location.lat, -90, 90, d.settings.location.lat),
        lng: numberIn(location.lng, -180, 180, d.settings.location.lng),
      },
      method: oneOf(settings.method, METHODS, d.settings.method),
      reminders: {
        morning: prayerReminder(reminders.morning, d.settings.reminders.morning),
        evening: prayerReminder(reminders.evening, d.settings.reminders.evening),
        sleep: timeReminder(reminders.sleep, d.settings.reminders.sleep),
      },
    },
    progress: {
      memorizedUpTo: page(obj(src.progress).memorizedUpTo),
    },
    pins: Object.fromEntries(
      SECTIONS.map((s) => [s, idList(obj(src.pins)[s])]),
    ),
    daily: {
      dayKey: typeof daily.dayKey === 'string' && daily.dayKey ? daily.dayKey : null,
      done: filterValues(daily.done, (v) => typeof v === 'boolean'),
      counters: filterValues(daily.counters, (v) => Number.isInteger(v) && v >= 0),
    },
  };
}

/**
 * Immutable update. `patchFn` receives a deep copy it may mutate, or it may
 * return a new state. The result is passed through `migrate`, so it is always
 * valid; the input state is never modified.
 */
export function update(state, patchFn) {
  const draft = structuredClone(migrate(state));
  const result = patchFn(draft);
  return migrate(result === undefined ? draft : result);
}

// --- helpers ---------------------------------------------------------------

function isObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function obj(v) {
  return isObject(v) ? v : {};
}

function oneOf(v, allowed, fallback) {
  return allowed.includes(v) ? v : fallback;
}

function nonEmptyString(v, fallback) {
  return typeof v === 'string' && v.trim() ? v : fallback;
}

function numberIn(v, min, max, fallback) {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : fallback;
}

function page(v) {
  if (typeof v !== 'number' || Number.isNaN(v)) return DEFAULT_STATE.progress.memorizedUpTo;
  return Math.min(MAX_PAGE, Math.max(0, Math.floor(v)));
}

function prayerReminder(v, def) {
  const r = obj(v);
  return {
    enabled: typeof r.enabled === 'boolean' ? r.enabled : def.enabled,
    prayer: oneOf(r.prayer, PRAYERS, def.prayer),
    offsetMin:
      Number.isInteger(r.offsetMin) && Math.abs(r.offsetMin) <= MAX_OFFSET_MIN
        ? r.offsetMin
        : def.offsetMin,
  };
}

function timeReminder(v, def) {
  const r = obj(v);
  return {
    enabled: typeof r.enabled === 'boolean' ? r.enabled : def.enabled,
    time: typeof r.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(r.time) ? r.time : def.time,
  };
}

function idList(v) {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((id) => typeof id === 'string' && id))];
}

function filterValues(v, keep) {
  return Object.fromEntries(Object.entries(obj(v)).filter(([, val]) => keep(val)));
}

function deepFreeze(o) {
  Object.values(o).forEach((v) => {
    if (v && typeof v === 'object') deepFreeze(v);
  });
  return Object.freeze(o);
}
