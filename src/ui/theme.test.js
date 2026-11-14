import { describe, it, expect } from 'vitest';
import { applyTheme, applyAppearance } from './theme.js';

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

describe('applyAppearance', () => {
  const styledRoot = () => {
    const props = {};
    return { dataset: {}, props, style: { setProperty: (k, v) => { props[k] = v; } } };
  };

  it('sets theme and Arabic scale', () => {
    const root = styledRoot();
    applyAppearance({ theme: 'dark', arabicScale: 1.2 }, root);
    expect(root.dataset.theme).toBe('dark');
    expect(root.props['--arabic-scale']).toBe('1.2');
  });

  it('falls back to system and scale 1 for bad values', () => {
    const root = styledRoot();
    applyAppearance({ theme: 'x', arabicScale: 'big' }, root);
    expect(root.dataset.theme).toBe('system');
    expect(root.props['--arabic-scale']).toBe('1');
    applyAppearance(undefined, root);
  });

  it('does not throw without a document', () => {
    expect(() => applyAppearance({ theme: 'dark' })).not.toThrow();
  });
});
