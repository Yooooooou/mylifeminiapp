/**
 * Telegram passes the launch parameters in the URL fragment — the same place a
 * hash router keeps the route. Rewriting that fragment to clean up the route
 * destroyed the parameters, and Telegram hands them over exactly once, so a
 * reload of the Mini App then had nothing to read.
 *
 * So the fragment is now left untouched for the whole session, and the route it
 * was meant to carry is read out of it once, at startup, to seed an in-memory
 * router. The address bar is invisible inside Telegram, so keeping the URL in
 * sync with navigation bought nothing and cost the signature.
 */
export function routeFromHash(hash) {
  const raw = String(hash ?? '').replace(/^#/, '');
  if (!raw) return '/';

  const route = raw
    .split('&')
    .filter((part) => part && !part.startsWith('tgWebApp'))
    .join('&');

  return route.startsWith('/') ? route : '/';
}

export function initialRoute(location = typeof window === 'undefined' ? null : window.location) {
  return routeFromHash(location?.hash);
}
