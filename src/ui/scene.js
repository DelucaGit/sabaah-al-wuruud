// Time-of-day scene behind the prayer dial card on Today: sky, sun, moon,
// stars and lavender hills. One persistent layer element; changing its
// `data-scene` attribute blends to another scene in CSS (see scene.css).
//
// Usage (today.js):
//   const scene = createScene(host);       // host: an element that is never re-rendered
//   scene.hold();                          // just BEFORE the card is re-rendered
//   scene.sync(cardEl, settings, now);     // just AFTER; cardEl may be null
//   scene.destroy();
//
// The card is rebuilt every repaint, the layer is not: hold() parks the layer
// in `host` and sync() moves it into the new card, so blends, the figure
// (issue #117) and its animations survive repaints. Today repaints every 30 s
// and at the moment the prayer window changes; each repaint re-picks the scene.
//
// Mounting the figure (#117): append it to `scene.figureSpot`
// (`.scene__figure`), a 48 x 52 px box standing on the crest of the front hill
// in the card's bottom-left corner. Its bottom edge is the ground.
//
// Debug: open the app with "?scene=maghrib" (before the #) to force a scene.
import './scene.css';
import { SCENES, sceneFor, sceneTone, sceneOverride } from '../core/scene.js';
import { todayPrayerTimes } from './prayer-view.js';

const LAYER_HTML = `
  ${SCENES.map((name) => `<div class="scene__sky scene__sky--${name}"></div>`).join('')}
  <div class="scene__stars"></div>
  <div class="scene__moon"></div>
  <div class="scene__sun"></div>
  <div class="scene__scrim"></div>
  <svg class="scene__hills" viewBox="0 0 100 30" preserveAspectRatio="none" focusable="false">
    <path class="scene__hill scene__hill--back" d="M0 30V16C12 10 26 9 40 14S66 20 80 13S96 9 100 11V30Z"/>
    <path class="scene__hill scene__hill--front" d="M0 30V14C4 12.5 7 12 11 12C22 12 34 19 52 20S84 16 100 21V30Z"/>
  </svg>
  <div class="scene__figure"></div>`;

/** Moves `el` into `parent` (first child), keeping CSS animations and transitions running where the browser can. */
function moveInto(parent, el) {
  if (el.parentNode === parent) return;
  if (el.isConnected && typeof parent.moveBefore === 'function') {
    try {
      parent.moveBefore(el, parent.firstChild);
      return;
    } catch {
      // fall through to a plain insert
    }
  }
  parent.prepend(el);
}

/**
 * @param {HTMLElement} host  Stays in the document for as long as the scene lives.
 * @returns {{ el: HTMLElement, figureSpot: HTMLElement, hold: () => void,
 *   sync: (card: HTMLElement|null, settings: object, now?: Date) => void, destroy: () => void }}
 */
export function createScene(host) {
  const el = document.createElement('div');
  el.className = 'scene scene--instant';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = LAYER_HTML;
  const figureSpot = el.querySelector('.scene__figure');
  const forced = sceneOverride(globalThis.location?.search);
  let painted = false; // false until the first scene is on screen (no fade for that one)
  let card = null;
  let settings = null;

  function apply(now) {
    const name = forced ?? sceneFor(todayPrayerTimes(settings, now), now);
    if (!painted) {
      // First paint: no blend. Let the instant state render before blends are enabled.
      el.dataset.scene = name;
      void el.offsetWidth;
      el.classList.remove('scene--instant');
      painted = true;
    } else if (el.dataset.scene !== name) {
      void el.offsetWidth; // make sure the blend starts from the scene on screen
      el.dataset.scene = name;
    }
    card.dataset.scene = name;
    card.dataset.sceneTone = sceneTone(name);
    card.dataset.dialTone = sceneTone(name); // the ring's own switch, see prayer-dial.css
  }

  return {
    el,
    figureSpot,
    hold() {
      if (el.isConnected && typeof host.moveBefore === 'function') moveInto(host, el);
    },
    sync(cardEl, nextSettings, now = new Date()) {
      card = cardEl;
      settings = nextSettings;
      if (!card) {
        el.remove();
        return;
      }
      moveInto(card, el);
      apply(now);
    },
    destroy() {
      card = null;
      el.remove();
    },
  };
}
