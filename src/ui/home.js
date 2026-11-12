// Stub — replaced by its own issue.
export function render(rootEl, params = {}) {
  const h = document.createElement('h1');
  h.textContent = 'Home' + (params.section ? `: ${params.section}` : '');
  rootEl.appendChild(h);
}
