import { describe, expect, it } from 'vitest';

import { routeFromHash } from '../lib/route';

describe('routeFromHash', () => {
  it('leaves a plain route alone', () => {
    // No Telegram parameters, nothing to rewrite.
    expect(routeFromHash('#/money')).toBeNull();
    expect(routeFromHash('')).toBeNull();
  });

  it('turns the launch fragment into the home route', () => {
    // This is what broke the tab bar: the app opened on a path that matched no
    // section, so navigation stayed hidden until the first tap.
    expect(routeFromHash('#tgWebAppData=abc&tgWebAppVersion=7.0')).toBe('/');
  });

  it('keeps the deep link a reminder button carries', () => {
    expect(routeFromHash('#/habits&tgWebAppData=abc&tgWebAppVersion=7.0')).toBe('/habits');
  });

  it('survives a fragment that is only Telegram parameters in another order', () => {
    expect(routeFromHash('#tgWebAppThemeParams=%7B%7D&tgWebAppData=x')).toBe('/');
  });
});
