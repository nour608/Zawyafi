import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Essential design system colors mapping to CSS variables
        "bg-base": "var(--bg-base)",
        "bg-warm": "var(--bg-warm)",
        "bg-surface": "var(--bg-surface)",
        "text-primary": "var(--text-primary)",
        "text-muted": "var(--text-muted)",
        "border-subtle": "var(--border-subtle)",
        "border-medium": "var(--border-medium)",
        "gold": "var(--gold)",
        "gold-light": "var(--gold-light)",
        "gold-bright": "var(--gold-bright)",
        "teal": "var(--teal)",
        "teal-bright": "var(--teal-bright)",

        // Unified semantic aliases used across app routes/features
        "panel": "var(--bg-surface)",
        "panelMuted": "var(--panel-muted)",
        "line": "var(--border-subtle)",
        "text": "var(--text-primary)",
        "textMuted": "var(--text-muted)",
        "signal": "var(--teal)",
        "success": "#0f9f74",
        "warning": "#bb7a0d",
        "danger": "#be3b4b",
        "canvas": "var(--bg-base)",

        // Existing dark-mode palette (used by internal app pages)
        "primary": "var(--teal)",
        "primary-dark": "var(--teal-bright)",
        "background-light": "var(--bg-base)",
        "background-dark": "var(--bg-base)",
        "surface-light": "var(--bg-surface)",
        "surface-dark": "var(--bg-surface)",
        "border-light": "var(--border-subtle)",
        "border-dark": "var(--border-subtle)",
        "text-main-light": "var(--text-primary)",
        "text-main-dark": "var(--text-primary)",
        "text-sec-light": "var(--text-muted)",
        "text-sec-dark": "var(--text-muted)",
        // ChilliwackConnect-inspired legacy mappings mapped to new Design System
        "cc-bg": "transparent",
        "cc-bg-alt": "transparent",
        "cc-text": "var(--text-primary)",
        "cc-text-sec": "var(--text-muted)",
        "cc-border": "var(--border-subtle)",
        "cc-accent": "var(--teal)",
        "cc-yellow": "var(--gold)",
      },
      fontFamily: {
        "display": ["var(--font-dm-serif)", "Georgia", "serif"],
        "heading": ["var(--font-dm-serif)", "Georgia", "serif"],
        "body": ["var(--font-dm-mono)", "Courier New", "monospace"],
        "mono": ["var(--font-dm-mono)", "monospace"],
        "arabic": ["var(--font-arabic)", "serif"],
      },
      maxWidth: {
        "1344": "84rem",  // 1344px ChilliwackConnect container
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
        'card': '0 0 0 1px rgba(0,0,0,0.03), 0 2px 8px rgba(0,0,0,0.04)',
        'card-hover': '0 0 0 1px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.08)',
        'cc-card': '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
        'cc-card-hover': '0 4px 20px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)',
        'glow': '0 0 60px -12px rgba(37, 99, 235, 0.25)',
      },
      borderRadius: {
        'cc': '1rem',
        'cc-lg': '1.25rem',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        'underline-slide': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'arrow-shift': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(4px)' },
        },
        'breathe': {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.65' },
          '50%': { transform: 'scale(1.13)', opacity: '1' },
        },
        'float-token': {
          '10%': { opacity: '0' },
          '12%, 85%': { opacity: '1' },
          '100%': { transform: 'translateY(-133px)', opacity: '0' }, // from +28px to -105px = -133px total offset logic, or better handled exactly by specifying the translation base
        },
        'ticker-move': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'blink': {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.35' },
          '50%': { transform: 'scale(1.6)', opacity: '1' },
        },
        'fadeUp': {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        }
      },
      animation: {
        'fade-up': 'fade-up 0.7s ease-out forwards',
        'fade-in': 'fade-in 0.5s ease-out forwards',
        'pulse-soft': 'pulse-soft 3s ease-in-out infinite',
        'underline-slide': 'underline-slide 0.3s ease forwards',
        'arrow-shift': 'arrow-shift 0.3s ease forwards',
        'breathe': 'breathe 7s ease-in-out infinite',
        'floatToken': 'float-token linear infinite',
        'tickerMove': 'ticker-move 34s linear infinite',
        'blink': 'blink 2.3s ease-in-out infinite',
        'fadeUp': 'fadeUp 0.9s ease forwards',
      }
    },
  },
  plugins: [],
}

export default config
