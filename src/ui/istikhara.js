// Istikhara screen: the du'a straight away, with "هَذَا الْأَمْرَ" (where she
// names her matter) highlighted. Built with DOM nodes/textContent only.
import './istikhara.css';
import dua from '../data/adhkar/istikhara.json';
import { navigate } from '../router.js';

export function render(rootEl) {
  const page = el('div', 'istikhara');

  const header = el('header', 'istikhara__header');
  const back = el('button', 'istikhara__back', '‹ Back');
  back.type = 'button';
  back.addEventListener('click', () => navigate('/'));
  header.append(back, el('h1', 'istikhara__title', 'Istikhara'));

  const card = el('article', 'istikhara__card');
  const text = el('p', 'istikhara__text font-adhkar');
  text.dir = 'rtl';
  text.lang = 'ar';
  text.append(...highlightNodes(dua.arabic, dua.highlight));

  const source = el('details', 'istikhara__source');
  source.append(el('summary', '', 'Source'));
  const src = el('p', 'istikhara__source-text', dua.source);
  src.dir = 'rtl';
  src.lang = 'ar';
  source.append(src);

  card.append(text, source);
  page.append(header, card);
  rootEl.appendChild(page);
}

// Split text into text nodes and <mark> elements around every occurrence of phrase.
export function highlightNodes(text, phrase) {
  if (!phrase) return [document.createTextNode(text)];
  const nodes = [];
  text.split(phrase).forEach((part, i) => {
    if (i > 0) nodes.push(el('mark', 'istikhara__mark', phrase));
    if (part) nodes.push(document.createTextNode(part));
  });
  return nodes;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}
