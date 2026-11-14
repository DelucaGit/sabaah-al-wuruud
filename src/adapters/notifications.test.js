import { beforeEach, describe, expect, it, vi } from 'vitest';

const pending = [];
const cancel = vi.fn(async () => {});
const schedule = vi.fn(async () => {});
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    getPending: async () => ({ notifications: pending.map((id) => ({ id })) }),
    cancel,
    schedule,
  },
}));

const { replaceAll } = await import('./notifications.js');

describe('replaceAll', () => {
  beforeEach(() => { cancel.mockClear(); schedule.mockClear(); pending.length = 0; });

  it('cancels stale encouragement ids when the count shrinks or it is switched off', async () => {
    pending.push(2026111480, 2026111481, 2026111482, 2026111580);
    const at = new Date(Date.now() + 3600e3);
    await replaceAll([{ id: 2026111480, at, title: 't', body: 'b', section: 'encouragement' }]);
    expect(cancel).toHaveBeenCalledWith({ notifications: pending.map((id) => ({ id })) });
    expect(schedule.mock.calls[0][0].notifications.map((n) => n.id)).toEqual([2026111480]);
    expect(schedule.mock.calls[0][0].notifications[0].extra.section).toBe('encouragement');

    await replaceAll([]);
    expect(cancel).toHaveBeenCalledTimes(2);
    expect(schedule).toHaveBeenCalledTimes(1);
  });
});
