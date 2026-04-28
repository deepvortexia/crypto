/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        neon: {
          cyan:  '#f59e0b',
          green: '#10b981',
          red:   '#ef4444',
          blue:  '#3d5afe',
          gold:  '#f59e0b',
        },
        surface: {
          DEFAULT: '#111111',
          card:    '#141414',
          border:  '#2a1f00',
          muted:   '#1a1400',
        },
      },
      fontFamily: {
        display: ['"Orbitron"', 'sans-serif'],
        mono:    ['"Share Tech Mono"', 'monospace'],
      },
      boxShadow: {
        'glow-cyan':  '0 0 8px #f59e0b, 0 0 24px rgba(245,158,11,0.35)',
        'glow-green': '0 0 8px #10b981, 0 0 24px rgba(16,185,129,0.35)',
        'glow-red':   '0 0 8px #ef4444, 0 0 24px rgba(239,68,68,0.35)',
        'glow-gold':  '0 0 8px #f59e0b, 0 0 24px rgba(245,158,11,0.35)',
        'card':       '0 0 0 1px #2a1f00, 0 4px 32px rgba(0,0,0,0.6)',
        'card-hover': '0 0 0 1px #f59e0b44, 0 4px 32px rgba(245,158,11,0.12)',
      },
      animation: {
        'pulse-slow':  'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'flicker':     'flicker 4s linear infinite',
        'scan':        'scan 6s linear infinite',
        'float':       'float 6s ease-in-out infinite',
        'grid-drift':  'grid-drift 12s linear infinite',
        'border-glow': 'border-glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        flicker: {
          '0%, 95%, 100%': { opacity: '1' },
          '96%':            { opacity: '0.6' },
          '97%':            { opacity: '1' },
          '98%':            { opacity: '0.4' },
          '99%':            { opacity: '1' },
        },
        scan: {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-8px)' },
        },
        'grid-drift': {
          '0%':   { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '60px 60px' },
        },
        'border-glow': {
          from: { boxShadow: '0 0 4px #f59e0b, 0 0 12px rgba(245,158,11,0.2)' },
          to:   { boxShadow: '0 0 12px #f59e0b, 0 0 32px rgba(245,158,11,0.5)' },
        },
      },
    },
  },
  plugins: [],
}
