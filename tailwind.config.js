/**
 * The visual system. See DESIGN.md for what each token is for and why.
 *
 * A galvanised ground, white rounded cards, blue-black ink, one safety-marking
 * yellow for the average line and the active tab, seven validated category
 * hues, an income green and a caution amber. See DESIGN.md.
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

      /** A soft ground inside a card: the pop-out's summary tiles and lists. */
      mist: '#F6F7F7',

      /**
       * Money received that reduces what is asked of Polyco. Text 5.65:1 on its
       * wash, 6.55:1 on white. Always with an icon and a word, never colour alone.
       */
      income: { DEFAULT: '#1E6B34', wash: '#E3F2E6' },

      /** Orders on their way: container requested or confirmed, booked. Text 7.11:1 on its wash. */
      info: { DEFAULT: '#1F4E8C', wash: '#E6EEF9' },

      /**
       * Cargo clearing, freight and courier recharges on the statement: the
       * logistics hue, darkened for text. 5.21:1 on its wash.
       */
      recharge: { DEFAULT: '#A8431A', wash: '#FCEBE3' },

      /** Lines on hold or paid elsewhere, and flags on the record. Text 6.61:1 on its wash. */
      caution: { DEFAULT: '#7A4B00', wash: '#FDF1D6' },

      /**
       * The seven cost categories, in stack order. Validated as a set with the
       * dataviz palette validator on white: every check passes, worst adjacent
       * colour-blind ΔE 10.8. Text never wears these; a swatch or icon does.
       */
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
      /** The amount on a month card. */
      figure: ['24px', { lineHeight: '1.15' }],
      body: ['15px', { lineHeight: '1.55' }],
      table: ['13px', { lineHeight: '1.4' }],
      small: ['11.5px', { lineHeight: '1.35' }],
    },

    borderRadius: {
      none: '0',
      /** Buttons, fields, chips. */
      DEFAULT: '6px',
      /** Month cards. */
      card: '14px',
      /** The pop-out panel. */
      panel: '18px',
      full: '9999px',
    },

    borderWidth: {
      DEFAULT: '1px',
      0: '0',
      2: '2px',
      3: '3px',
    },

    boxShadow: {
      none: 'none',
      /** A month card at rest: barely lifted off the ground. */
      card: '0 1px 2px rgba(22, 32, 42, 0.06), 0 1px 1px rgba(22, 32, 42, 0.04)',
      /** A month card under the pointer or focus. */
      lift: '0 6px 18px rgba(22, 32, 42, 0.12)',
      /** The pop-out panel. */
      panel: '0 24px 64px rgba(22, 32, 42, 0.28)',
    },

    extend: {
      maxWidth: {
        page: '1200px',
        prose: '68ch',
      },
    },
  },
  plugins: [],
}
