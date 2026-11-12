// Settings screen: appearance, location, reminders, memorization and About.
// Every control saves on change (no save button). Invalid input is rejected
// (the field reverts to the stored value) or clamped, so the state stays valid.
import './settings.css';
import { store } from '../adapters/storage.js';
import { DEFAULT_STATE } from '../core/state.js';
import { setMemorizedUpTo, TOTAL_PAGES } from '../core/memorization.js';
import { applyTheme, THEME_MODES } from './theme.js';
import { navigate } from '../router.js';
import { version } from '../../package.json';

const THEME_LABELS = { system: 'System', light: 'Light', dark: 'Dark' };
const MAX_OFFSET_MIN = 720;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function render(rootEl) {
  const page = el('div', 'settings');
  page.innerHTML = template();
  rootEl.appendChild(page);

  const $ = (sel) => page.querySelector(sel);
  const status = $('.settings__status');
  let statusTimer = null;

  const flash = (msg, isError = false) => {
    status.textContent = msg;
    status.classList.toggle('settings__status--error', isError);
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => { status.textContent = ''; }, 2500);
  };
  const save = (patchFn, msg = 'Saved') => {
    store.set(patchFn);
    fill();
    flash(msg);
  };
  const reject = (msg) => {
    fill();
    flash(msg, true);
  };

  // --- fill all controls from the store ------------------------------------
  function fill() {
    const { settings, progress } = store.get();
    page.querySelectorAll('input[name="theme"]').forEach((r) => {
      r.checked = r.value === settings.theme;
    });
    $('#loc-name').value = settings.location.name;
    $('#loc-lat').value = String(settings.location.lat);
    $('#loc-lng').value = String(settings.location.lng);
    for (const key of ['morning', 'evening']) {
      const r = settings.reminders[key];
      $(`#rem-${key}-on`).checked = r.enabled;
      $(`#rem-${key}-offset`).value = String(r.offsetMin);
      $(`#rem-${key}-offset`).disabled = !r.enabled;
    }
    const sleep = settings.reminders.sleep;
    $('#rem-sleep-on').checked = sleep.enabled;
    $('#rem-sleep-time').value = sleep.time;
    $('#rem-sleep-time').disabled = !sleep.enabled;
    $('#mem-page').value = String(progress.memorizedUpTo);
  }

  // --- navigation ----------------------------------------------------------
  $('.settings__back').addEventListener('click', () => navigate('/'));

  // --- appearance ----------------------------------------------------------
  page.querySelectorAll('input[name="theme"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      const mode = applyTheme(radio.value);
      save((s) => { s.settings.theme = mode; });
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

  // --- reminders -----------------------------------------------------------
  for (const key of ['morning', 'evening', 'sleep']) {
    $(`#rem-${key}-on`).addEventListener('change', (e) => {
      const on = e.target.checked;
      save((s) => { s.settings.reminders[key].enabled = on; });
    });
  }
  for (const key of ['morning', 'evening']) {
    $(`#rem-${key}-offset`).addEventListener('change', (e) => {
      const n = parseNumber(e.target.value);
      if (n === null) return reject('Enter a number of minutes');
      const minutes = Math.min(MAX_OFFSET_MIN, Math.max(0, Math.round(n)));
      save((s) => { s.settings.reminders[key].offsetMin = minutes; });
    });
  }
  $('#rem-sleep-time').addEventListener('change', (e) => {
    const time = e.target.value;
    if (!TIME_RE.test(time)) return reject('Enter a valid time');
    save((s) => { s.settings.reminders.sleep.time = time; });
  });

  // --- memorization --------------------------------------------------------
  $('#mem-page').addEventListener('change', (e) => {
    const n = parseNumber(e.target.value);
    if (n === null) return reject(`Enter a page from 0 to ${TOTAL_PAGES}`);
    save((s) => { s.progress.memorizedUpTo = setMemorizedUpTo(s.progress, n); });
  });

  fill();
  // Make the page match the selected segment even if boot applied another mode.
  applyTheme(store.get().settings.theme);
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

function el(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function reminderRow(key, label, controlHtml) {
  return `
    <div class="settings__reminder">
      <label class="settings__switch">
        <span class="settings__switch-label">${label}</span>
        <input type="checkbox" id="rem-${key}-on" role="switch">
        <span class="settings__switch-track" aria-hidden="true"></span>
      </label>
      ${controlHtml}
    </div>`;
}

function offsetField(key, prayer) {
  return `
    <label class="settings__field settings__field--inline" for="rem-${key}-offset">
      <span>Minutes after ${prayer}</span>
      <input type="number" id="rem-${key}-offset" inputmode="numeric" min="0" max="${MAX_OFFSET_MIN}" step="1">
    </label>`;
}

function template() {
  const themeOptions = THEME_MODES.map((mode) => `
        <label class="settings__segment">
          <input type="radio" name="theme" value="${mode}">
          <span>${THEME_LABELS[mode]}</span>
        </label>`).join('');

  return `
    <header class="settings__header">
      <button type="button" class="settings__back" aria-label="Back to home">&#8592; Home</button>
      <h1 class="settings__title">Settings</h1>
    </header>

    <section class="settings__card" aria-labelledby="set-appearance">
      <h2 id="set-appearance">Appearance</h2>
      <div class="settings__segmented" role="radiogroup" aria-label="Theme">${themeOptions}
      </div>
    </section>

    <section class="settings__card" aria-labelledby="set-location">
      <h2 id="set-location">Location</h2>
      <label class="settings__field" for="loc-name">
        <span>City</span>
        <input type="text" id="loc-name" autocomplete="off">
      </label>
      <div class="settings__row">
        <label class="settings__field" for="loc-lat">
          <span>Latitude</span>
          <input type="text" id="loc-lat" inputmode="decimal" autocomplete="off">
        </label>
        <label class="settings__field" for="loc-lng">
          <span>Longitude</span>
          <input type="text" id="loc-lng" inputmode="decimal" autocomplete="off">
        </label>
      </div>
      <button type="button" class="settings__button" id="loc-reset">Reset to Cairo</button>
      <p class="settings__note">Prayer times: Egyptian General Authority of Survey</p>
    </section>

    <section class="settings__card" aria-labelledby="set-reminders">
      <h2 id="set-reminders">Reminders</h2>
      ${reminderRow('morning', 'Morning', offsetField('morning', 'Fajr'))}
      ${reminderRow('evening', 'Evening', offsetField('evening', 'Asr'))}
      ${reminderRow('sleep', 'Before Sleep', `
        <label class="settings__field settings__field--inline" for="rem-sleep-time">
          <span>Time</span>
          <input type="time" id="rem-sleep-time">
        </label>`)}
    </section>

    <section class="settings__card" aria-labelledby="set-memorization">
      <h2 id="set-memorization">Memorization</h2>
      <label class="settings__field settings__field--inline" for="mem-page">
        <span>Memorized up to page</span>
        <input type="number" id="mem-page" inputmode="numeric" min="0" max="${TOTAL_PAGES}" step="1">
      </label>
      <p class="settings__note">0 means not started; ${TOTAL_PAGES} is the whole mushaf.</p>
    </section>

    <p class="settings__status" role="status" aria-live="polite"></p>

    <footer class="settings__about">
      <p><strong>Sabaah al-Wuruud</strong> &middot; version ${version}</p>
      <p>Adhkar from Hisn al-Muslim. Quran text and page layout from Tanzil; At-Tafsir al-Muyassar via QUL / quran.com.</p>
      <p>Prayer times calculated offline with the adhan library.</p>
      <p>Fonts: Carlito and Amiri (SIL Open Font License), KFGQPC Uthmanic Hafs (King Fahd Glorious Quran Printing Complex).</p>
    </footer>
  `;
}
