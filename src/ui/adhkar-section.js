// Adhkar section screen (#/adhkar/:section): starred adhkar first, then the
// rest in book order, 100× counters, and a Done button. Everything is saved
// through the store; daily state (counters, done) starts fresh each day.
import './adhkar.css';
import { store } from '../adapters/storage.js';
import { ensureToday, markDone, isDone, setCounter, getCounter } from '../core/daily.js';
import { orderAdhkar, togglePin, increment, reset, COUNTER_REPEAT } from '../core/adhkar.js';
import * as haptics from '../adapters/haptics.js';
import { navigate } from '../router.js';
import morning from '../data/adhkar/morning.json';
import evening from '../data/adhkar/evening.json';
import sleep from '../data/adhkar/sleep.json';
import { createDhikrCard } from './dhikr-card.js';

const DATA = { morning, evening, sleep };
const TITLES = { morning: 'Morning Adhkar', evening: 'Evening Adhkar', sleep: 'Before Sleep' };

export function render(rootEl, { section } = {}) {
  const list = DATA[section];
  if (!list) {
    navigate('/');
    return;
  }

  const page = el('div', 'adhkar font-ui');
  const header = el('header', 'adhkar__header');
  const back = el('button', 'adhkar__back', '‹ Back');
  back.type = 'button';
  back.addEventListener('click', () => navigate('/'));
  header.append(back, el('h1', 'adhkar__title', TITLES[section]));

  const listEl = el('div', 'adhkar__list');
  const footer = el('div', 'adhkar__footer');
  page.append(header, listEl, footer);
  rootEl.appendChild(page);

  ensureDaily();
  drawList();
  drawFooter();

  function drawList() {
    const { pins, daily } = store.get();
    const now = new Date();
    const { pinned, rest } = orderAdhkar(list, pins[section]);
    listEl.replaceChildren();

    const add = (dhikr, isPinned) => {
      const card = createDhikrCard(dhikr, {
        pinned: isPinned,
        count: getCounter(daily, dhikr.id, now),
        onTogglePin: () => {
          store.set((s) => { s.pins[section] = togglePin(s.pins[section], dhikr.id); });
          drawList();
        },
        onTap: () => {
          const current = getCounter(ensureDaily(), dhikr.id, new Date());
          const { value, reachedTarget } = increment(current, COUNTER_REPEAT);
          if (value === current) return; // already at 100
          card.setCount(value); // update the screen before anything else
          if (reachedTarget) haptics.success();
          else haptics.tap();
          saveCounter(dhikr.id, value);
        },
        onReset: () => {
          card.setCount(reset());
          saveCounter(dhikr.id, reset());
        },
      });
      listEl.append(card.el);
    };

    pinned.forEach((d) => add(d, true));
    if (pinned.length && rest.length) {
      const divider = el('hr', 'adhkar__divider');
      divider.setAttribute('aria-hidden', 'true');
      listEl.append(divider);
    }
    rest.forEach((d) => add(d, false));
  }

  function drawFooter() {
    footer.replaceChildren();
    const done = isDone(ensureDaily(), section, new Date());
    const btn = el('button', 'adhkar__done' + (done ? ' adhkar__done--done' : ''),
      done ? 'Done today ✔' : '✔ Done');
    btn.type = 'button';
    btn.addEventListener('click', () => {
      if (!done) {
        store.set((s) => { s.daily = markDone(s.daily, section, new Date()); });
      }
      navigate('/');
    });
    footer.append(btn);
  }
}

/** Rolls `daily` over to today if needed and returns it. */
function ensureDaily() {
  const { daily } = store.get();
  const today = ensureToday(daily, new Date());
  if (today === daily) return daily;
  return store.set((s) => { s.daily = today; }).daily;
}

function saveCounter(id, value) {
  store.set((s) => { s.daily = setCounter(s.daily, id, value, new Date()); });
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}
