/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Driven by Telegram's themeParams at runtime, so the Mini App follows
        // the user's own light/dark client theme instead of hardcoding one.
        bg: 'var(--tg-bg)',
        surface: 'var(--tg-surface)',
        text: 'var(--tg-text)',
        hint: 'var(--tg-hint)',
        link: 'var(--tg-link)',
        accent: 'var(--tg-accent)',
        'accent-text': 'var(--tg-accent-text)',
        border: 'var(--tg-border)',
        danger: 'var(--tg-danger)',
      },
      borderRadius: { xl2: '1.125rem' },
    },
  },
  plugins: [],
};
