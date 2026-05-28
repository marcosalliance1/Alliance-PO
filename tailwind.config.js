/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0f0f1a',
        surface: '#1a1a2e',
        'surface-2': '#16213e',
        primary: '#e94560',
        'text-main': '#f0f0f0',
        'text-muted': '#8892b0',
        success: '#00b894',
        warning: '#fdcb6e',
        danger: '#e17055',
        // Pre-Eventos color tokens
        accent:   '#e94560',
        muted:    '#8892a4',
        sidebar:  '#12122a',
        surface2: '#0f3460',
        bordercol:'#2a2a4a',
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '12px',
        inner: '8px',
        card: '12px',
      },
      boxShadow: {
        card: '0 4px 24px rgba(0,0,0,0.3)',
      },
    },
  },
  plugins: [],
}
