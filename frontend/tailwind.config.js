/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // All colors are driven by CSS variables so themes can swap live.
      colors: {
        base: 'rgb(var(--c-base) / <alpha-value>)',
        mantle: 'rgb(var(--c-mantle) / <alpha-value>)',
        crust: 'rgb(var(--c-crust) / <alpha-value>)',
        surface0: 'rgb(var(--c-surface0) / <alpha-value>)',
        surface1: 'rgb(var(--c-surface1) / <alpha-value>)',
        surface2: 'rgb(var(--c-surface2) / <alpha-value>)',
        overlay: 'rgb(var(--c-overlay) / <alpha-value>)',
        text: 'rgb(var(--c-text) / <alpha-value>)',
        subtext: 'rgb(var(--c-subtext) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        accent: 'rgb(var(--c-accent) / <alpha-value>)',
        accent2: 'rgb(var(--c-accent2) / <alpha-value>)',
        bubbleMine: 'rgb(var(--c-bubble-mine) / <alpha-value>)',
        bubbleTheirs: 'rgb(var(--c-bubble-theirs) / <alpha-value>)',
        bubbleMineText: 'rgb(var(--c-bubble-mine-text) / <alpha-value>)',
        bubbleTheirsText: 'rgb(var(--c-bubble-theirs-text) / <alpha-value>)',
        success: 'rgb(var(--c-success) / <alpha-value>)',
        danger: 'rgb(var(--c-danger) / <alpha-value>)',
        warning: 'rgb(var(--c-warning) / <alpha-value>)',
      },
      borderRadius: {
        bubble: '18px',
      },
      fontFamily: {
        sans: ['Nunito', 'system-ui', 'Segoe UI', 'sans-serif'],
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        'dot-pulse': {
          '0%, 60%, 100%': { opacity: '0.3', transform: 'translateY(0)' },
          '30%': { opacity: '1', transform: 'translateY(-3px)' },
        },
      },
      animation: {
        'dot-pulse': 'dot-pulse 1.2s infinite ease-in-out',
      },
    },
  },
  plugins: [],
}
