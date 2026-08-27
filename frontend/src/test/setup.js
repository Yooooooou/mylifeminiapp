import '@testing-library/jest-dom/vitest';

// The Telegram SDK script never loads in jsdom, so the app must work without
// it — leaving window.Telegram undefined is exactly the fallback path.
globalThis.matchMedia =
  globalThis.matchMedia ??
  ((query) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  }));
