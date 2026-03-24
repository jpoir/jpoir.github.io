/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,js}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        vapor: {
          pink:   '#ff44cc',
          purple: '#b44fff',
          blue:   '#44ccff',
          indigo: '#6655ff',
        },
        dark: {
          950: '#07071a',
          900: '#0d0d24',
          800: '#14142e',
          700: '#1e1e40',
          600: '#2a2a52',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'gradient-x':  'gradient-x 8s ease infinite',
        'fade-in-up':  'fade-in-up 0.6s ease forwards',
        'pulse-slow':  'pulse 4s cubic-bezier(0.4,0,0.6,1) infinite',
        'ticker':      'ticker 35s linear infinite',
      },
      keyframes: {
        'gradient-x': {
          '0%,100%': { backgroundPosition: '0% 50%' },
          '50%':     { backgroundPosition: '100% 50%' },
        },
        'fade-in-up': {
          '0%':   { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'ticker': {
          '0%':   { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
    },
  },
  plugins: [],
}

