// Applies the colour theme by setting data-theme on the root element.
// The palettes themselves live in src/styles/theme.css.

export const THEME_MODES = ['system', 'light', 'dark'];

/**
 * @param {'system'|'light'|'dark'} mode  Unknown values fall back to 'system'.
 * @param {{ dataset: Record<string, string> }} [root]  Defaults to <html>.
 * @returns {'system'|'light'|'dark'} The mode actually applied.
 */
export function applyTheme(mode, root = globalThis.document?.documentElement) {
  const applied = THEME_MODES.includes(mode) ? mode : 'system';
  if (root) root.dataset.theme = applied;
  return applied;
}
