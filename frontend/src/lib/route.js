/**
 * Telegram appends its own parameters to the URL fragment — the very place
 * HashRouter keeps the route — so the app opens at "/tgWebAppData=…" rather
 * than "/".
 *
 * telegram-web-app.js runs in <head> and has already read those parameters
 * before any of this loads, so the fragment can be reduced to the route it was
 * meant to carry.
 */
export function routeFromHash(hash) {
  const raw = String(hash ?? '').replace(/^#/, '');
  if (!raw.includes('tgWebApp')) return null;

  const route = raw
    .split('&')
    .filter((part) => part && !part.startsWith('tgWebApp'))
    .join('&');

  return route.startsWith('/') ? route : '/';
}

export function normalizeHash(location = window.location, history = window.history) {
  const route = routeFromHash(location.hash);
  if (route === null) return;
  history.replaceState(null, '', `${location.pathname}${location.search}#${route}`);
}
