/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        neon: {
          cyan:  '#FFD700',
          green: '#FFC200',
          red:   '#ff3355',
          blue:  '#3d5afe',
          gold:  '#FFD700',
        },
        surface: {
          DEFAULT: '#0a0a0f',
          card:    '#0d0d1a',
          border:  '#1a1a2e',
          muted:   '#111122',
        },
      },
      fontFamily: {
        display: ['"Orbitron"', 'sans-serif'],
        mono:    ['"Share Tech Mono"', 'monospace'],
      },
      boxShadow: {
        'glow-cyan':  '0 0 8px #FFD700, 0 0 24px rgba(255,215,0,0.35)',
        'glow-green': '0 0 8px #FFC200, 0 0 24px rgba(255,194,0,0.35)',
        'glow-red':   '0 0 8px #ff3355, 0 0 24px rgba(255,51,85,0.35)',
        'glow-gold':  '0 0 8px #FFD700, 0 0 24px rgba(255,215,0,0.35)',
        'card':       '0 0 0 1px #1a1a2e, 0 4px 32px rgba(0,0,0,0.6)',
        'card-hover': '0 0 0 1px #FFD70044, 0 4px 32px rgba(255,215,0,0.12)',
      },
      animation: {
        'pulse-slow':   'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'flicker':      'flicker 4s linear infinite',
        'scan':         'scan 6s linear infinite',
        'float':        'float 6s ease-in-out infinite',
        'grid-drift':   'grid-drift 12s linear infinite',
        'border-glow':  'border-glow 2s ease-in-out infinite alternate',
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
          from: { boxShadow: '0 0 4px #FFD700, 0 0 12px rgba(255,215,0,0.2)' },
          to:   { boxShadow: '0 0 12px #FFD700, 0 0 32px rgba(255,215,0,0.5)' },
        },
      },
    },
  },
  plugins: [],
}
