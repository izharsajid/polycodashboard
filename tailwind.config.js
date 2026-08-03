/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink:    { DEFAULT: '#14201B', muted: '#5C6B64', faint: '#8A968F' },
        rule:   { DEFAULT: '#DDE3DF', strong: '#B8C2BC' },
        paper:  { DEFAULT: '#FBFCFB', panel: '#F3F6F4' },
        leaf:   { DEFAULT: '#4C8A3F', deep: '#2F5C27', wash: '#EAF2E7' },
        ember:  { DEFAULT: '#C4762A', wash: '#F8EEE2' },
        alert:  { DEFAULT: '#A32E2E', wash: '#F6E7E7' }
      },
      fontFamily: {
        sans: ['Montserrat', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace']
      }
    }
  },
  plugins: []
}
