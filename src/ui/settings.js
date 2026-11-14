// Me tab (settings): name, look, reminders, memorization, location and About.
// Every control saves on change (no save button). Invalid input is rejected
// (the field reverts to the stored value) or clamped, so the state stays valid.
// The template is rendered once; fill() then updates the controls in place so
// inputs never lose focus. Appearance is applied by main.js on store changes.
import './settings.css';
import { store } from '../adapters/storage.js';
import { ARABIC_SCALE, DEFAULT_STATE, THEMES } from '../core/state.js';
import { setMemorizedUpTo, TOTAL_PAGES } from '../core/memorization.js';
import { esc, icon } from './kit.js';
import { version } from '../../package.json';

const THEME_LABELS = { system: 'System', light: 'Light', dark: 'Dark' };
const MAX_NAME_LENGTH = 20;
const MAX_OFFSET_MIN = 720;
const OFFSET_STEP_MIN = 15;
const SCALE_STEP = 0.05;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const PRAYER_REMINDERS = [['morning', 'Morning', 'Fajr'], ['evening', 'Evening', 'Asr']];

export function render(rootEl) {
  const page = document.createElement('div');
  page.className = 'screen settings';
  page.innerHTML = template();
  rootEl.appendChild(page);

  const $ = (sel) => page.querySelector(sel);
  const $$ = (sel) => page.querySelectorAll(sel);
  const status = $('.settings-status');
  let statusTimer = null;

  const flash = (msg, isError = false) => {
    status.textContent = msg;
    status.classList.toggle('settings-status--error', isError);
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => { status.textContent = ''; }, 2500);
  };
  const save = (patchFn, msg = 'Saved') => {
    store.set(patchFn);
    fill(true);
    flash(msg);
  };
  const reject = (msg) => {
    fill(true);
    flash(msg, true);
  };

  // --- fill all controls from the store ------------------------------------
  // Without `force` the field being typed in is left alone.
  function fill(force = false) {
    const { settings, progress } = store.get();
    const setValue = (sel, value) => {
      const input = $(sel);
      if (!force && input === document.activeElement) return;
      if (input.value !== String(value)) input.value = String(value);
    };

    setValue('#set-name', settings.name);
    $$('[data-theme-mode]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.themeMode === settings.theme));
    });
    setValue('#set-scale', settings.arabicScale);
    $('#set-scale-value').textContent = `${Math.round(settings.arabicScale * 100)}%`;

    for (const key of ['morning', 'evening', 'sleep']) {
      const r = settings.reminders[key];
      $(`#rem-${key}-on`).setAttribute('aria-checked', String(r.enabled));
      const row = $(`#rem-${key}`);
      row.classList.toggle('settings-row--off', !r.enabled);
      row.querySelectorAll('input, .settings-stepper button').forEach((c) => { c.disabled = !r.enabled; });
      if (key === 'sleep') setValue('#rem-sleep-time', r.time);
      else setValue(`#rem-${key}-offset`, r.offsetMin);
    }

    $('#rem-lastThird-on').setAttribute('aria-checked', String(settings.reminders.lastThird.enabled === true));

    setValue('#mem-page', progress.memorizedUpTo);
    setValue('#loc-name', settings.location.name);
    setValue('#loc-lat', settings.location.lat);
    setValue('#loc-lng', settings.location.lng);
  }

  // --- you -----------------------------------------------------------------
  // Saved while typing so Today shows it at once; the field itself is only
  // rewritten on blur, where an empty name falls back to the default.
  $('#set-name').addEventListener('input', (e) => {
    const name = cleanName(e.target.value);
    if (name) store.set((s) => { s.settings.name = name; });
  });
  $('#set-name').addEventListener('change', (e) => {
    const name = cleanName(e.target.value) || DEFAULT_STATE.settings.name;
    save((s) => { s.settings.name = name; });
  });
  $('#set-name').addEventListener('blur', () => fill(true));

  // --- look ----------------------------------------------------------------
  $$('[data-theme-mode]').forEach((b) => {
    b.addEventListener('click', () => {
      const mode = b.dataset.themeMode;
      if (THEMES.includes(mode)) save((s) => { s.settings.theme = mode; });
    });
  });
  $('#set-scale').addEventListener('input', (e) => {
    const n = parseNumber(e.target.value);
    if (n === null) return;
    const scale = clamp(Math.round(n * 100) / 100, ARABIC_SCALE.min, ARABIC_SCALE.max);
    store.set((s) => { s.settings.arabicScale = scale; });
  });
  $('#set-scale').addEventListener('change', () => flash('Saved'));

  // --- reminders -----------------------------------------------------------
  for (const key of ['morning', 'evening', 'sleep']) {
    $(`#rem-${key}-on`).addEventListener('click', () => {
      save((s) => { s.settings.reminders[key].enabled = !s.settings.reminders[key].enabled; });
    });
  }
  $('#rem-lastThird-on').addEventListener('click', () => {
    save((s) => { s.settings.reminders.lastThird.enabled = !s.settings.reminders.lastThird.enabled; });
  });
  for (const [key] of PRAYER_REMINDERS) {
    const setOffset = (n) => {
      const minutes = clamp(Math.round(n), 0, MAX_OFFSET_MIN);
      save((s) => { s.settings.reminders[key].offsetMin = minutes; });
    };
    $(`#rem-${key}-offset`).addEventListener('change', (e) => {
      const n = parseNumber(e.target.value);
      if (n === null) return reject('Enter a number of minutes');
      setOffset(n);
    });
    $$(`#rem-${key} [data-step]`).forEach((b) => {
      b.addEventListener('click', () => {
        setOffset(store.get().settings.reminders[key].offsetMin + Number(b.dataset.step));
      });
    });
  }
  $('#rem-sleep-time').addEventListener('change', (e) => {
    const time = e.target.value;
    if (!TIME_RE.test(time)) return reject('Enter a valid time');
    save((s) => { s.settings.reminders.sleep.time = time; });
  });

  // --- memorization --------------------------------------------------------
  const setPage = (n) => save((s) => { s.progress.memorizedUpTo = setMemorizedUpTo(s.progress, n); });
  $('#mem-page').addEventListener('change', (e) => {
    const n = parseNumber(e.target.value);
    if (n === null) return reject(`Enter a page from 0 to ${TOTAL_PAGES}`);
    setPage(n);
  });
  $$('#mem-row [data-step]').forEach((b) => {
    b.addEventListener('click', () => {
      setPage(clamp(store.get().progress.memorizedUpTo + Number(b.dataset.step), 0, TOTAL_PAGES));
    });
  });

  // --- location ------------------------------------------------------------
  $('#loc-name').addEventListener('change', (e) => {
    const name = e.target.value.trim();
    if (!name) return reject('City name cannot be empty');
    save((s) => { s.settings.location.name = name; });
  });
  for (const [id, key, limit] of [['#loc-lat', 'lat', 90], ['#loc-lng', 'lng', 180]]) {
    $(id).addEventListener('change', (e) => {
      const n = parseNumber(e.target.value);
      if (n === null || Math.abs(n) > limit) {
        return reject(`${key === 'lat' ? 'Latitude' : 'Longitude'} must be between -${limit} and ${limit}`);
      }
      save((s) => { s.settings.location[key] = n; });
    });
  }
  $('#loc-reset').addEventListener('click', () => {
    save((s) => { s.settings.location = { ...DEFAULT_STATE.settings.location }; }, 'Location reset to Cairo');
  });

  fill(true);
  // Keep the form in sync if the state changes elsewhere while it is open.
  const unsubscribe = store.subscribe(() => fill());
  return () => {
    unsubscribe();
    clearTimeout(statusTimer);
  };
}

/** A finite number from a text field, or null for empty/garbage input. */
function parseNumber(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function cleanName(raw) {
  return String(raw ?? '').trim().slice(0, MAX_NAME_LENGTH).trim();
}

function switchHtml(key, label) {
  return `<button type="button" class="switch" role="switch" aria-checked="false" id="rem-${key}-on" aria-label="${esc(label)} reminder"></button>`;
}

function stepperHtml({ inputId, label, step, max, less, more }) {
  return `
        <span class="settings-stepper">
          <button type="button" data-step="-${step}" aria-label="${esc(less)}">${icon('minus')}</button>
          <input type="text" id="${inputId}" inputmode="numeric" autocomplete="off" maxlength="${String(max).length + 1}" aria-label="${esc(label)}">
          <button type="button" data-step="${step}" aria-label="${esc(more)}">${icon('plus')}</button>
        </span>`;
}

function offsetRow([key, label, prayer]) {
  return `
      <div class="settings-row" id="rem-${key}">
        <span class="settings-grow">${label}<small>Minutes after ${prayer}</small></span>
        ${stepperHtml({
          inputId: `rem-${key}-offset`,
          label: `${label} reminder, minutes after ${prayer}`,
          step: OFFSET_STEP_MIN,
          max: MAX_OFFSET_MIN,
          less: `${OFFSET_STEP_MIN} minutes earlier`,
          more: `${OFFSET_STEP_MIN} minutes later`,
        })}
        ${switchHtml(key, label)}
      </div>`;
}

function template() {
  const themes = THEMES.map((mode) => `
          <button type="button" data-theme-mode="${mode}" aria-pressed="false">${THEME_LABELS[mode]}</button>`).join('');

  return `
    <h1 class="screen-title">Made for you</h1>

    <p class="section-label" id="set-you">You</p>
    <section class="card settings-group" aria-labelledby="set-you">
      <label class="settings-row">
        <span class="settings-grow">Your name</span>
        <input class="settings-field" type="text" id="set-name" maxlength="${MAX_NAME_LENGTH}" autocomplete="off">
      </label>
    </section>

    <p class="section-label" id="set-look">Look</p>
    <section class="card settings-group" aria-labelledby="set-look">
      <div class="settings-row settings-row--col">
        <span>Appearance</span>
        <div class="segmented" role="group" aria-label="Theme">${themes}
        </div>
      </div>
      <div class="settings-row settings-row--col">
        <label class="settings-split" for="set-scale"><span>Arabic text size</span><small id="set-scale-value"></small></label>
        <p class="settings-sample" lang="ar" dir="rtl">سُبْحَانَ اللهِ وَبِحَمْدِهِ</p>
        <input type="range" class="settings-range" id="set-scale" min="${ARABIC_SCALE.min}" max="${ARABIC_SCALE.max}" step="${SCALE_STEP}">
      </div>
    </section>

    <p class="section-label" id="set-reminders">Reminders</p>
    <section class="card settings-group" aria-labelledby="set-reminders">
      ${PRAYER_REMINDERS.map(offsetRow).join('')}
      <div class="settings-row" id="rem-sleep">
        <span class="settings-grow">Before Sleep<small>Every night</small></span>
        <input class="settings-field settings-field--time" type="time" id="rem-sleep-time" aria-label="Sleep reminder time">
        ${switchHtml('sleep', 'Before Sleep')}
      </div>
      <div class="settings-row" id="rem-lastThird">
        <span class="settings-grow">Last third of the night<small>A gentle nudge for tahajjud and dua &middot; off by default</small></span>
        ${switchHtml('lastThird', 'Last third of the night')}
      </div>
    </section>

    <p class="section-label" id="set-quran">Qur'an</p>
    <section class="card settings-group" aria-labelledby="set-quran">
      <div class="settings-row" id="mem-row">
        <span class="settings-grow">Memorized up to page<small>0 = not started &middot; ${TOTAL_PAGES} = the whole mushaf</small></span>
        ${stepperHtml({
          inputId: 'mem-page',
          label: 'Memorized up to page',
          step: 1,
          max: TOTAL_PAGES,
          less: 'One page less',
          more: 'One page more',
        })}
      </div>
    </section>

    <p class="section-label" id="set-location">Location</p>
    <section class="card settings-group" aria-labelledby="set-location">
      <label class="settings-row">
        <span class="settings-grow">City</span>
        <input class="settings-field" type="text" id="loc-name" autocomplete="off">
      </label>
      <label class="settings-row">
        <span class="settings-grow">Latitude</span>
        <input class="settings-field" type="text" id="loc-lat" inputmode="decimal" autocomplete="off">
      </label>
      <label class="settings-row">
        <span class="settings-grow">Longitude</span>
        <input class="settings-field" type="text" id="loc-lng" inputmode="decimal" autocomplete="off">
      </label>
      <div class="settings-row">
        <span class="settings-grow">Method<small>Egyptian General Authority of Survey</small></span>
        <button type="button" class="settings-link" id="loc-reset">Reset to Cairo</button>
      </div>
    </section>

    <p class="settings-status" role="status" aria-live="polite"></p>

    <p class="section-label" id="set-about">About</p>
    <footer class="settings-about" aria-labelledby="set-about">
      <p><strong>Sabaah al-Wuruud</strong> &middot; version ${esc(version)}</p>
      <p>Adhkar from Hisn al-Muslim. Quran text and page layout from Tanzil; At-Tafsir al-Muyassar via QUL / quran.com.</p>
      <p>Prayer times calculated offline with the adhan library.</p>
      <p>Fonts: Carlito and Amiri (SIL Open Font License), KFGQPC Uthmanic Hafs (King Fahd Glorious Quran Printing Complex).</p>
    </footer>
  `;
}
