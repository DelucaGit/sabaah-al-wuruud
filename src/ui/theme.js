// Applies the look chosen in Settings to the root element: the colour theme
// (data-theme) and the Arabic text size (--arabic-scale). The palettes themselves live in src/styles/theme.css.

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

/**
 * Applies theme and Arabic text size from the settings object.
 * @param {{ theme?: string, arabicScale?: number }} settings
 * @param {{ dataset: Record<string, string>, style?: { setProperty: Function } }} [root]
 */
export function applyAppearance(settings, root = globalThis.document?.documentElement) {
  applyTheme(settings?.theme, root);
  if (!root) return;
  const scale = Number(settings?.arabicScale);
  root.style?.setProperty('--arabic-scale', String(Number.isFinite(scale) && scale > 0 ? scale : 1));
}
