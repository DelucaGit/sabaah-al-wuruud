// Persisted app state: schema, defaults and migration. Pure — no globals.

export const STATE_VERSION = 1;
export const MAX_PAGE = 604;
export const SECTIONS = ['morning', 'evening', 'sleep'];

/** Sections with starred adhkar: the reminder sections plus Home and Travel. */
export const PIN_SECTIONS = [...SECTIONS, 'home', 'travel'];
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
/** Quran goal reminders (settings.reminders keys) and how each one is timed. */
export const GOAL_REMINDERS = ['hifdh', 'murajaa', 'checklist'];
export const GOAL_REMINDER_MODES = ['prayer', 'time'];
/** Allowed daytime encouragement messages per day. */
export const ENCOURAGEMENT_PER_DAY = { min: 1, max: 5, default: 3 };

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
      lastThird: { enabled: false },
      // Quran goal reminders: `mode` 'prayer' uses prayer + offsetMin, 'time'
      // uses the fixed device-local 'HH:MM' `time`. Skipped once done today.
      hifdh: { enabled: true, mode: 'prayer', prayer: 'fajr', offsetMin: 30, time: '06:30' },
      murajaa: { enabled: true, mode: 'prayer', prayer: 'asr', offsetMin: 30, time: '16:00' },
      checklist: { enabled: true, mode: 'prayer', prayer: 'isha', offsetMin: 30, time: '21:00' },
      // Daytime encouragement: `perDay` (1-5) messages between 09:00 and 20:30.
      encouragement: { enabled: true, perDay: 3 },
    },
  },
  progress: { memorizedUpTo: 0 },
  pins: { morning: [], evening: [], sleep: [], home: [], travel: [] },
  daily: { dayKey: null, done: {}, counters: {} },
  goals: {
    hifdhTarget: 1,
    murajaaTarget: 5,
    items: [],
    lastRevised: {},
    daily: { dayKey: null, done: {}, murajaaPages: [] },
  },
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
        lastThird: {
          enabled: typeof obj(reminders.lastThird).enabled === 'boolean'
            ? reminders.lastThird.enabled
            : d.settings.reminders.lastThird.enabled,
        },
        ...Object.fromEntries(GOAL_REMINDERS.map((k) => [k, goalReminder(reminders[k], d.settings.reminders[k])])),
        encouragement: {
          enabled: typeof obj(reminders.encouragement).enabled === 'boolean'
            ? reminders.encouragement.enabled
            : d.settings.reminders.encouragement.enabled,
          perDay: intIn(obj(reminders.encouragement).perDay, ENCOURAGEMENT_PER_DAY.min, ENCOURAGEMENT_PER_DAY.max,
            d.settings.reminders.encouragement.perDay),
        },
      },
    },
    progress: {
      memorizedUpTo: page(obj(src.progress).memorizedUpTo),
    },
    pins: Object.fromEntries(
      PIN_SECTIONS.map((s) => [s, idList(obj(src.pins)[s])]),
    ),
    daily: {
      dayKey: typeof daily.dayKey === 'string' && daily.dayKey ? daily.dayKey : null,
      done: filterValues(daily.done, (v) => typeof v === 'boolean'),
      counters: filterValues(daily.counters, (v) => Number.isInteger(v) && v >= 0),
    },
    goals: migrateGoals(src.goals, page(obj(src.progress).memorizedUpTo)),
  };
}

const MAX_TARGET = 50;
const MAX_ITEM_TEXT = 100;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function migrateGoals(raw, memorizedUpTo) {
  const g = obj(raw);
  const d = DEFAULT_STATE.goals;
  const daily = obj(g.daily);
  const seen = new Set();
  const items = (Array.isArray(g.items) ? g.items : []).flatMap((it) => {
    const text = isObject(it) && typeof it.text === 'string' ? it.text.trim().slice(0, MAX_ITEM_TEXT) : '';
    if (!text || typeof it.id !== 'string' || !it.id || seen.has(it.id)) return [];
    seen.add(it.id);
    return [{ id: it.id, text }];
  });
  const lastRevised = {};
  for (const [k, v] of Object.entries(obj(g.lastRevised))) {
    const n = Number(k);
    if (Number.isInteger(n) && n >= 1 && n <= memorizedUpTo && typeof v === 'string' && DATE_RE.test(v)) {
      lastRevised[n] = v;
    }
  }
  const pages = Array.isArray(daily.murajaaPages)
    ? [...new Set(daily.murajaaPages.filter((n) => Number.isInteger(n) && n >= 1 && n <= MAX_PAGE))]
    : [];
  return {
    hifdhTarget: intIn(g.hifdhTarget, 0, MAX_TARGET, d.hifdhTarget),
    murajaaTarget: intIn(g.murajaaTarget, 0, MAX_TARGET, d.murajaaTarget),
    items,
    lastRevised,
    daily: {
      dayKey: typeof daily.dayKey === 'string' && daily.dayKey ? daily.dayKey : null,
      done: filterValues(daily.done, (v) => typeof v === 'boolean'),
      murajaaPages: pages,
    },
  };
}

function intIn(v, min, max, fallback) {
  return Number.isInteger(v) && v >= min && v <= max ? v : fallback;
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

function goalReminder(v, def) {
  const r = obj(v);
  const { enabled, prayer, offsetMin } = prayerReminder(r, def);
  return { enabled, mode: oneOf(r.mode, GOAL_REMINDER_MODES, def.mode), prayer, offsetMin, time: timeReminder(r, def).time };
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
