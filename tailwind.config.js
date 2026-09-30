/**
 * The visual system. See DESIGN.md for what each token is for and why.
 *
 * Six tokens. The page is an engineering sheet: a galvanised ground, white ruled
 * sheets with square corners, blue-black ink, and one safety-marking yellow that
 * marks the average line and the active tab, and nothing else.
 *
 * `spacing` and `fontWeight` keep Tailwind's own scales.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    // Replaced, not extended: no colour outside this list is reachable.
    colors: {
      transparent: 'transparent',
      current: 'currentColor',

      /** Page ground. Galvanised steel, cool, not cream. */
      zinc: '#E9ECEB',
      /** Surfaces: ruled sheets, square corners, no shadow. */
      sheet: '#FFFFFF',
      /** Ink: text, axes, rules that carry structure, the focus ring. 16.5:1 on sheet. */
      press: {
        DEFAULT: '#16202A',
        /** Secondary text and outlines. 6.25:1 on sheet, 5.26:1 on zinc. */
        2: '#56626C',
      },
      /** Hairlines only. Never the only boundary of a control. */
      rule: '#C5CCCF',
      /** The average line and the active tab. Never text. */
      marking: '#F2B300',
      /**
       * The message when the statements fail to load, and nothing else. 7.2:1
       * on sheet. manufacturing-finance keeps red for placeholders and
       * shortfalls, and the figures have neither.
       */
      alert: '#A3261F',
    },

    fontFamily: {
      /** Archivo, one family. Headings use its condensed width. */
      sans: ['"Archivo Variable"', 'Archivo', 'system-ui', 'sans-serif'],
    },

    fontSize: {
      /** The headline sentence, once per page. */
      display: ['32px', { lineHeight: '1.15' }],
      title: ['20px', { lineHeight: '1.25' }],
      body: ['15px', { lineHeight: '1.55' }],
      table: ['13px', { lineHeight: '1.4' }],
      small: ['11.5px', { lineHeight: '1.35' }],
    },

    borderRadius: {
      none: '0',
      /** Buttons and fields, barely softened. Sheets stay square. */
      DEFAULT: '2px',
      full: '9999px',
    },

    borderWidth: {
      DEFAULT: '1px',
      0: '0',
      2: '2px',
      3: '3px',
    },

    boxShadow: { none: 'none' },

    extend: {
      maxWidth: {
        page: '1200px',
        prose: '68ch',
      },
    },
  },
  plugins: [],
}
