// Istikhara screen: the du'a straight away, with "هَذَا الْأَمْرَ" (where she
// names her matter) highlighted. The source opens in a bottom sheet.
import './istikhara.css';
import dua from '../data/adhkar/istikhara.json';
import { navigate } from '../router.js';
import { esc, icon, openSheet } from './kit.js';

export function render(viewEl) {
  const page = document.createElement('div');
  page.className = 'screen istikhara';
  page.innerHTML = `
    <div class="topbar">
      <button type="button" class="icon-btn istikhara-back" aria-label="Back">${icon('back')}</button>
      <button type="button" class="chip istikhara-source">Source</button>
    </div>
    <header class="istikhara-head">
      <h1 class="screen-title">Istikhara</h1>
      <p class="muted small">Asking Allah to choose what is best</p>
    </header>
    <article class="card">
      <p class="istikhara-text font-adhkar" dir="rtl" lang="ar"></p>
    </article>
    <p class="istikhara-hint">Name your matter at the highlighted words.</p>`;

  page.querySelector('.istikhara-text').append(...highlightNodes(dua.arabic, dua.highlight));
  page.querySelector('.istikhara-back').addEventListener('click', () => navigate('/adhkar'));
  page.querySelector('.istikhara-source').addEventListener('click', () => {
    openSheet({
      title: 'Source',
      bodyHtml: `<p class="sheet__arabic" lang="ar">${esc(dua.source)}</p>`,
    });
  });

  viewEl.appendChild(page);
}

// Split text into text nodes and <mark> elements around every occurrence of phrase.
export function highlightNodes(text, phrase) {
  if (!phrase) return [document.createTextNode(text)];
  const nodes = [];
  text.split(phrase).forEach((part, i) => {
    if (i > 0) {
      const mark = document.createElement('mark');
      mark.className = 'istikhara-mark';
      mark.textContent = phrase;
      nodes.push(mark);
    }
    if (part) nodes.push(document.createTextNode(part));
  });
  return nodes;
}
