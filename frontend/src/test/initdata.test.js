/**
 * "initData is empty" has now broken the app twice, so each way the signature
 * can be recovered gets a test. The module resolves it once at import time, so
 * every case re-imports with a fresh module registry.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const SIGNED = 'auth_date=1&user=%7B%22id%22%3A42%7D&hash=abc';

function setHash(hash) {
  window.location.hash = hash;
}

beforeEach(() => {
  vi.resetModules();
  setHash('');
  window.sessionStorage.clear();
  delete window.Telegram;
});

afterEach(() => {
  delete window.Telegram;
});

describe('initData', () => {
  it('uses the SDK when telegram-web-app.js loaded', async () => {
    window.Telegram = { WebApp: { initData: SIGNED } };
    const { initData } = await import('../lib/telegram');
    expect(initData()).toBe(SIGNED);
  });

  it('parses the fragment when the SDK failed to load', async () => {
    // telegram.org is a third-party host; a blocked or slow fetch left
    // window.Telegram undefined and every request unsigned.
    setHash(`#tgWebAppData=${encodeURIComponent(SIGNED)}&tgWebAppVersion=7.0`);
    const { initData } = await import('../lib/telegram');
    expect(initData()).toBe(SIGNED);
  });

  it('remembers the payload for the rest of the session', async () => {
    setHash(`#tgWebAppData=${encodeURIComponent(SIGNED)}`);
    const first = await import('../lib/telegram');
    expect(first.initData()).toBe(SIGNED);

    // Telegram hands the parameters over once, on the opening URL. After the
    // route replaces the fragment and the Mini App reloads, they are gone.
    vi.resetModules();
    setHash('#/career');
    const second = await import('../lib/telegram');
    expect(second.initData()).toBe(SIGNED);
  });

  it('reports plainly when there is nothing to send', async () => {
    const { initData, isTelegram } = await import('../lib/telegram');
    expect(initData()).toBe('');
    expect(isTelegram).toBe(false);
  });

  it('survives storage that throws instead of returning null', async () => {
    const getItem = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('site data blocked');
      });

    const { initData } = await import('../lib/telegram');
    expect(initData()).toBe('');
    getItem.mockRestore();
  });
});
