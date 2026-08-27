/**
 * Telegram WebApp SDK access.
 *
 * Everything here degrades gracefully: opened in a plain browser (for local
 * development) `tg` is undefined, the app falls back to a readable theme and
 * the native dialogs become their browser equivalents.
 */

export const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;

const STORAGE_KEY = 'tg-init-data';

/**
 * Resolve the signed payload once, from whichever source still has it.
 *
 * Reading `tg.initData` alone had two ways to come back empty, and both showed
 * up as "initData is empty" with every request rejected:
 *
 *   1. telegram-web-app.js is fetched from telegram.org. If that request fails,
 *      `window.Telegram` never exists — so the launch parameters are parsed
 *      here as well, straight out of the fragment Telegram put them in.
 *   2. The fragment is also where the route lives, so it gets rewritten at
 *      startup. Telegram hands the parameters over exactly once, on the opening
 *      URL; after a reload of the Mini App they are simply gone. Keeping a copy
 *      for the session survives that.
 *
 * sessionStorage, not localStorage: the payload is signed with a timestamp the
 * backend rejects once stale, and it should not outlive the Mini App session.
 */
function launchParam(name) {
  if (typeof window === 'undefined') return null;
  const entry = window.location.hash
    .replace(/^#/, '')
    .split('&')
    .find((part) => part.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : null;
}

function resolveInitData() {
  const fromSdk = tg?.initData;
  if (fromSdk) return fromSdk;

  if (typeof window === 'undefined') return '';

  const fromHash = launchParam('tgWebAppData');
  if (fromHash) return fromHash;

  try {
    return window.sessionStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    // Private mode and blocked site data both throw rather than return null.
    return '';
  }
}

const signature = resolveInitData();

/**
 * Why the signature is missing, in the words of what was actually checked.
 * "initData is empty" named the symptom and left three very different causes
 * indistinguishable from a screenshot.
 */
export function initDataDiagnosis() {
  if (signature) return null;
  if (typeof window === 'undefined') return 'нет окна браузера';

  const sdk = Boolean(window.Telegram?.WebApp);
  const fragment = window.location.hash.includes('tgWebApp');
  let stored = false;
  try {
    stored = Boolean(window.sessionStorage.getItem(STORAGE_KEY));
  } catch {
    stored = false;
  }

  if (!sdk && !fragment) {
    return 'Telegram не передал параметры запуска. Открой трекер кнопкой в боте, а не по ссылке.';
  }
  if (sdk && !fragment && !stored) {
    return 'SDK загрузился, но подпись пустая — приложение открыто вне чата с ботом.';
  }
  return `SDK: ${sdk ? 'есть' : 'нет'}, параметры в ссылке: ${fragment ? 'есть' : 'нет'}, копия: ${stored ? 'есть' : 'нет'}`;
}

if (signature && typeof window !== 'undefined') {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, signature);
  } catch {
    /* storing is an optimisation, not a requirement */
  }
}

/** themeParams arrive in the same fragment, so they survive a missing SDK too. */
const launchTheme = (() => {
  const raw = launchParam('tgWebAppThemeParams');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
})();

export const isTelegram = Boolean(signature);

/** The signed payload the backend verifies on every request. */
export function initData() {
  return signature;
}

const FALLBACK_LIGHT = {
  '--tg-bg': '#ffffff',
  '--tg-surface': '#f4f4f5',
  '--tg-text': '#0f0f10',
  '--tg-hint': '#8b8b90',
  '--tg-link': '#2a80d6',
  '--tg-accent': '#2a80d6',
  '--tg-accent-text': '#ffffff',
  '--tg-border': '#e4e4e7',
  '--tg-danger': '#e0483c',
};

const FALLBACK_DARK = {
  '--tg-bg': '#17212b',
  '--tg-surface': '#232e3c',
  '--tg-text': '#f5f5f5',
  '--tg-hint': '#8b9aa8',
  '--tg-link': '#6ab3f3',
  '--tg-accent': '#4c9ce2',
  '--tg-accent-text': '#ffffff',
  '--tg-border': '#2b3a4a',
  '--tg-danger': '#ec5f56',
};

/** Perceived lightness of a #rrggbb colour, enough to pick a theme side. */
function isDarkColor(hex) {
  const value = String(hex).replace('#', '');
  if (value.length !== 6) return false;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}

/**
 * Map Telegram's themeParams onto the CSS variables Tailwind reads.
 * Called once on mount and again whenever the user switches theme.
 */
export function applyTheme() {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const params = tg?.themeParams ?? launchTheme ?? {};
  const dark =
    tg?.colorScheme === 'dark' ||
    // Without the SDK, the background Telegram sent still says which theme it is.
    (params.bg_color ? isDarkColor(params.bg_color) : null) ||
    (!tg && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  const fallback = dark ? FALLBACK_DARK : FALLBACK_LIGHT;
  const mapped = {
    '--tg-bg': params.bg_color,
    '--tg-surface': params.secondary_bg_color ?? params.section_bg_color,
    '--tg-text': params.text_color,
    '--tg-hint': params.hint_color,
    '--tg-link': params.link_color,
    '--tg-accent': params.button_color,
    '--tg-accent-text': params.button_text_color,
    '--tg-danger': params.destructive_text_color,
  };

  Object.entries(fallback).forEach(([key, value]) => {
    root.style.setProperty(key, mapped[key] || value);
  });

  // Telegram sends no border colour; derive one that reads on either theme.
  root.style.setProperty('--tg-border', dark ? FALLBACK_DARK['--tg-border'] : FALLBACK_LIGHT['--tg-border']);
  root.classList.toggle('dark', dark);
  document.body.style.backgroundColor = 'var(--tg-bg)';
}

/** Expand to full height, apply the theme and keep it in sync. */
export function initTelegram() {
  applyTheme();
  if (!tg) return () => {};

  tg.ready();
  tg.expand();
  tg.onEvent('themeChanged', applyTheme);
  return () => tg.offEvent('themeChanged', applyTheme);
}

/** Short haptic tick, where the client supports it. */
export function haptic(style = 'light') {
  try {
    tg?.HapticFeedback?.impactOccurred(style);
  } catch {
    /* older clients simply have no haptics */
  }
}

export function notifySuccess() {
  try {
    tg?.HapticFeedback?.notificationOccurred('success');
  } catch {
    /* ignore */
  }
}

/** Native confirmation dialog, falling back to the browser's. */
export function confirmAction(message) {
  return new Promise((resolve) => {
    if (tg?.showConfirm) {
      tg.showConfirm(message, (ok) => resolve(Boolean(ok)));
    } else {
      resolve(window.confirm(message));
    }
  });
}

/**
 * Show the client's own Back button and route it through `onBack`, so
 * navigation feels native. Returns a cleanup function.
 */
export function bindBackButton(onBack) {
  if (!tg?.BackButton) return () => {};
  tg.BackButton.show();
  tg.BackButton.onClick(onBack);
  return () => {
    tg.BackButton.offClick(onBack);
    tg.BackButton.hide();
  };
}


/* ------------------------------------------------------------ home screen */

/**
 * Telegram can install a Mini App as a home-screen icon (Bot API 8.0), which
 * launches it through Telegram and therefore still arrives signed — unlike a
 * browser bookmark, which would open the page with no initData at all.
 *
 * Support is decided by the client, not by us: the methods are absent on older
 * versions, and a client that cannot do it answers "unsupported". So the offer
 * is only ever shown when the client says it is possible and not already done.
 */
export function homeScreenSupported() {
  return typeof tg?.addToHomeScreen === 'function';
}

/** Resolves to 'added' | 'missing' | 'unsupported' | 'unknown'. */
export function homeScreenStatus() {
  return new Promise((resolve) => {
    if (typeof tg?.checkHomeScreenStatus !== 'function') {
      resolve(homeScreenSupported() ? 'unknown' : 'unsupported');
      return;
    }
    try {
      // A client that never answers must not leave the caller hanging.
      const timer = setTimeout(() => resolve('unknown'), 3000);
      tg.checkHomeScreenStatus((status) => {
        clearTimeout(timer);
        resolve(status ?? 'unknown');
      });
    } catch {
      resolve('unsupported');
    }
  });
}

export function addToHomeScreen() {
  try {
    tg?.addToHomeScreen?.();
  } catch {
    /* the client declines by doing nothing */
  }
}

/** Fires once the icon really exists; returns an unsubscribe. */
export function onHomeScreenAdded(handler) {
  if (typeof tg?.onEvent !== 'function') return () => {};
  tg.onEvent('homeScreenAdded', handler);
  return () => tg.offEvent?.('homeScreenAdded', handler);
}
