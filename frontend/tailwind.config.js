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
        elevated: 'var(--elevated)',
        text: 'var(--tg-text)',
        hint: 'var(--tg-hint)',
        link: 'var(--tg-link)',
        accent: 'var(--tg-accent)',
        'accent-text': 'var(--tg-accent-text)',
        border: 'var(--tg-border)',
        // Meaning, not decoration: success/warning/danger/stage are the only
        // colours allowed to carry state, and nothing else is coloured.
        danger: 'var(--sem-danger)',
        success: 'var(--sem-success)',
        warning: 'var(--sem-warning)',
        info: 'var(--sem-info)',
        stage: 'var(--sem-stage)',
      },
      fontSize: {
        hero: ['2rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        title: ['1.75rem', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
        section: ['1.25rem', { lineHeight: '1.25', letterSpacing: '-0.01em' }],
        card: ['1rem', { lineHeight: '1.35' }],
        body: ['0.9375rem', { lineHeight: '1.45' }],
        secondary: ['0.875rem', { lineHeight: '1.4' }],
        micro: ['0.75rem', { lineHeight: '1.35' }],
      },
      borderRadius: { xl2: '1rem' },
      spacing: { card: '1.0625rem', section: '1.875rem' },
    },
  },
  plugins: [],
};
