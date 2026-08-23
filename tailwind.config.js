/**
 * The visual system, from DESIGN-SYSTEM-V2-SPEC.md.
 *
 * EcoFibre's house style, the same one efdashboard renders. The two should be
 * indistinguishable. Cards on a tinted page, a tinted header block inside each
 * card, a leaf bar across its top, and Montserrat throughout.
 *
 * See DESIGN.md for what each token is for.
 *
 * Two notes on what is deliberately NOT overridden here:
 *
 * - `spacing` keeps Tailwind's own scale. The previous config replaced it with a
 *   sparse 8px scale, which meant `h-5` and `h-9` were not classes at all and
 *   silently did nothing. A replaced scale turns a typo into an invisible
 *   failure, and this file has no reason to take that risk.
 * - `fontWeight` keeps its defaults, because section 1 asks for 800 on the
 *   kicker and 700 on headings and figures.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    // Replaced, not extended. The near-monochrome palette this supersedes should
    // not be reachable one class at a time.
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      white: '#FFFFFF',

      /** Page background. Cards sit on this. */
      page: '#FAFAFA',
      /** Cards and table rows. */
      surface: '#FFFFFF',
      /** The tinted block behind a section heading, inside the top of a card. */
      tint: '#EFF5EA',
      /** Table group bands. */
      band: '#EDF3E8',
      /** Table header row. */
      thead: '#F4F8F1',

      rule: {
        DEFAULT: '#DFE5DC',
        /** Input borders, a shade greener than a hairline. */
        field: '#D8E5CE',
      },

      ink: {
        DEFAULT: '#333333',
        /** Headings and figures. */
        strong: '#263D23',
        /** Descriptions and secondary lines. */
        muted: '#6D7869',
        /** Table header text. */
        table: '#687365',
      },

      /** The accent: active pills, buttons, links, and the series carrying a chart. */
      leaf: {
        DEFAULT: '#507A48',
        /** Heading green, and the bar across the top of a card. */
        deep: '#294525',
        /** Kicker text. */
        kicker: '#71846B',
      },

      // Status. Section 2: these appear in pills, and in a chart only where they
      // mean there exactly what they mean in a pill. Never as decoration.
      good: { DEFAULT: '#257443', wash: '#E6F5EB' },
      info: { DEFAULT: '#345C8A', wash: '#E8F1FB' },
      plan: { DEFAULT: '#70458A', wash: '#F1E8F7' },
      watch: { DEFAULT: '#8A4A10', wash: '#FFF0D8' },
      /** The only red in the system. */
      critical: { DEFAULT: '#AD3029', wash: '#FDE8E6' },
      off: { DEFAULT: '#625C5C', wash: '#ECE9E9' },
    },

    fontFamily: {
      /** Everything. Section 1: sans throughout, no serif, no monospace. */
      sans: ['Montserrat', 'system-ui', 'sans-serif'],
    },

    /**
     * Fixed steps, from section 1. No key here may share a name with a colour
     * key: Tailwind builds `text-*` utilities from both, and a collision means
     * one of them silently loses.
     */
    fontSize: {
      kicker: ['11.5px', { lineHeight: '1', letterSpacing: '0.09em' }],
      title: ['23px', { lineHeight: '1.25' }],
      lede: ['14px', { lineHeight: '1.6' }],
      'figure-xl': ['30px', { lineHeight: '1' }],
      figure: ['17px', { lineHeight: '1.3' }],
      body: ['14px', { lineHeight: '1.6' }],
      /** Table header. */
      th: ['11px', { lineHeight: '1', letterSpacing: '0.055em' }],
      table: ['13px', { lineHeight: '1.4' }],
      /** The grey second line under a value. */
      sub: ['11px', { lineHeight: '1.3' }],
    },

    borderRadius: {
      none: '0',
      /** Buttons and fields. Section 4. */
      DEFAULT: '6px',
      /** The card. Section 3. */
      card: '14px',
      full: '9999px',
    },

    borderWidth: {
      DEFAULT: '1px',
      0: '0',
      2: '2px',
      /** The leaf bar across the top of a card. */
      5: '5px',
    },

    boxShadow: {
      none: 'none',
      card: '0 10px 30px rgba(59, 89, 54, 0.08)',
    },

    extend: {
      maxWidth: {
        page: '1280px',
        prose: '68ch',
      },
    },
  },
  plugins: [],
}
