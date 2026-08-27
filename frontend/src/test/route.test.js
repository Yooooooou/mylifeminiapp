import { describe, expect, it } from 'vitest';

import { routeFromHash } from '../lib/route';

describe('routeFromHash', () => {
  it('reads the route the fragment carries', () => {
    expect(routeFromHash('#/money')).toBe('/money');
    expect(routeFromHash('')).toBe('/');
  });

  it('starts at home when the fragment is only launch parameters', () => {
    // This is what hid the tab bar: the router saw "/tgWebAppData=…", which
    // matched no section, so navigation stayed hidden until the first tap.
    expect(routeFromHash('#tgWebAppData=abc&tgWebAppVersion=7.0')).toBe('/');
  });

  it('keeps the deep link a reminder button carries', () => {
    expect(routeFromHash('#/habits&tgWebAppData=abc&tgWebAppVersion=7.0')).toBe('/habits');
  });

  it('ignores launch parameters in any order', () => {
    expect(routeFromHash('#tgWebAppThemeParams=%7B%7D&tgWebAppData=x')).toBe('/');
  });
});
