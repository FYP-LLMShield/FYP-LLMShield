/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          primary: '#0a0a0a',
          secondary: '#111827',
        },
        light: {
          primary: '#ffffff',
          secondary: '#f8f9fa',
        },
        accent: {
          blue: '#00d4ff',
          purple: '#8b5cf6',
          teal: '#14b8a6',
          darkBlue: '#1e40af',
          lightBlue: '#3b82f6',
          darkTeal: '#0d9488',
        },
      },
      animation: {
        'float': 'float 3s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'rotate-y': 'rotate-y 10s linear infinite',
        'float-4': 'float-4 4s ease-in-out infinite',
        'float-6': 'float-6 6s ease-in-out infinite',
        'float-8': 'float-8 8s ease-in-out infinite',
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'caret-blink': 'caret-blink 1.25s ease-out infinite',
      },
      keyframes: {
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.7 },
        },
        'rotate-y': {
          '0%': { transform: 'rotateY(0deg)' },
          '100%': { transform: 'rotateY(360deg)' },
        },
        'float-4': {
          '0%, 100%': {
            transform: 'translate3d(0, 0, 0) rotate(0deg)',
            opacity: '0.3'
          },
          '25%': {
            transform: 'translate3d(10px, -15px, 0) rotate(90deg)',
            opacity: '0.8'
          },
          '50%': {
            transform: 'translate3d(-5px, -25px, 0) rotate(180deg)',
            opacity: '0.5'
          },
          '75%': {
            transform: 'translate3d(-15px, -10px, 0) rotate(270deg)',
            opacity: '0.9'
          }
        },
        'float-6': {
          '0%, 100%': {
            transform: 'translate3d(0, 0, 0) rotate(0deg)',
            opacity: '0.4'
          },
          '33%': {
            transform: 'translate3d(-20px, -30px, 0) rotate(120deg)',
            opacity: '0.7'
          },
          '66%': {
            transform: 'translate3d(15px, -20px, 0) rotate(240deg)',
            opacity: '0.6'
          }
        },
        'float-8': {
          '0%, 100%': {
            transform: 'translate3d(0, 0, 0) rotate(0deg)',
            opacity: '0.2'
          },
          '20%': {
            transform: 'translate3d(25px, -10px, 0) rotate(72deg)',
            opacity: '0.8'
          },
          '40%': {
            transform: 'translate3d(10px, -35px, 0) rotate(144deg)',
            opacity: '0.4'
          },
          '60%': {
            transform: 'translate3d(-15px, -25px, 0) rotate(216deg)',
            opacity: '0.9'
          },
          '80%': {
            transform: 'translate3d(-25px, -5px, 0) rotate(288deg)',
            opacity: '0.3'
          }
        },
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'caret-blink': {
          '0%, 70%, 100%': { opacity: '1' },
          '20%, 50%': { opacity: '0' },
        },
      },
      transitionDuration: {
        '300': '300ms',
      },
    },
  },
  plugins: [],
}