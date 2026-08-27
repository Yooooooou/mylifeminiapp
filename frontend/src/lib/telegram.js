/**
 * Telegram WebApp SDK access.
 *
 * Everything here degrades gracefully: opened in a plain browser (for local
 * development) `tg` is undefined, the app falls back to a readable theme and
 * the native dialogs become their browser equivalents.
 */

export const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;

export const isTelegram = Boolean(tg?.initData);

/** The signed payload the backend verifies on every request. */
export function initData() {
  return tg?.initData ?? '';
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

/**
 * Map Telegram's themeParams onto the CSS variables Tailwind reads.
 * Called once on mount and again whenever the user switches theme.
 */
export function applyTheme() {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const dark =
    tg?.colorScheme === 'dark' ||
    (!tg && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  const fallback = dark ? FALLBACK_DARK : FALLBACK_LIGHT;

  const params = tg?.themeParams ?? {};
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
