import { describe, it, expect } from 'vitest';
import { applyTheme } from './theme.js';

const fakeRoot = () => ({ dataset: {} });

describe('applyTheme', () => {
  it.each(['system', 'light', 'dark'])('sets data-theme to %s', (mode) => {
    const root = fakeRoot();
    expect(applyTheme(mode, root)).toBe(mode);
    expect(root.dataset.theme).toBe(mode);
  });

  it('falls back to system for unknown modes', () => {
    const root = fakeRoot();
    expect(applyTheme('purple', root)).toBe('system');
    expect(root.dataset.theme).toBe('system');
    expect(applyTheme(undefined, root)).toBe('system');
  });

  it('replaces a previously applied mode', () => {
    const root = fakeRoot();
    applyTheme('dark', root);
    applyTheme('light', root);
    expect(root.dataset.theme).toBe('light');
  });

  it('does not throw without a document', () => {
    expect(applyTheme('dark')).toBe('dark');
  });
});
