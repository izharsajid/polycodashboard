/**
 * The visual system. See DESIGN.md for what each token is for and why.
 *
 * Six tokens for the page and seven for the data. The page is an engineering
 * sheet: a galvanised ground, white ruled sheets with square corners, blue-black
 * ink, and one safety-marking yellow that means "selected" and nothing else.
 * The seven category hues are the only other colour anywhere, validated as a set
 * for colour-blind separation and contrast on white.
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
      /** Selection, and nothing else. Never text, always edged in press. */
      marking: '#F2B300',
      /**
       * Form errors on the sign-in and account pages. 7.2:1 on sheet. The tab
       * itself carries no red: manufacturing-finance keeps red for placeholders
       * and shortfalls, and this tab has neither.
       */
      alert: { DEFAULT: '#A3261F', wash: '#FBEAE8' },

      /** The seven categories, in stack order. Text never wears these. */
      cat: {
        payroll: '#2F6BC4',
        raw: '#B5801C',
        working: '#C24D86',
        compliance: '#3B8A1F',
        supplier: '#6A4FC2',
        facility: '#13A08A',
        logistics: '#E0612B',
      },
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
