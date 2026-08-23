/**
 * The visual system, from DESIGN-SYSTEM-SPEC.md.
 *
 * An institutional financial document rendered on a screen, not a SaaS
 * dashboard. Typography carries the design; space and rules replace cards;
 * figures dominate. See DESIGN.md for what each token is for and where the two
 * contrast corrections came from.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    // Not `extend`. The old palette competed with this one, and leaving it in
    // reach means it comes back one class at a time.
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      white: '#FFFFFF',

      ink: {
        DEFAULT: '#16181A',
        70: '#4A4F55',
        // Two points darker than the spec's #71777E, which measured 4.41:1 on
        // paper and failed the 4.5 body minimum section 7 sets. 4.53:1 now.
        50: '#6F757C',
        30: '#A8ADB3',
      },
      rule: {
        DEFAULT: '#E4E6E8',
        soft: '#EFF1F2',
      },
      paper: '#FCFCFB',
      surface: '#FFFFFF',

      /** The one accent. Active nav, the series carrying a chart's message, a primary action. */
      accent: {
        DEFAULT: '#2D5F3F',
        soft: '#EDF2EE',
      },

      /** Status pills, negative figures and flags only. Never decoration. */
      watch: {
        // Four points darker than #A66A00, which measured 4.37:1 on paper.
        DEFAULT: '#A26600',
        soft: '#FBF3E4',
      },
      critical: {
        DEFAULT: '#9B2C24',
        soft: '#FAEDEC',
      },
    },

    fontFamily: {
      /** Findings, headings, section titles. Gravity, and reads as a document. */
      serif: ['"Source Serif 4"', 'Georgia', 'serif'],
      /** Interface, labels, body, tables, and every figure. */
      sans: ['Inter', 'system-ui', 'sans-serif'],
      /** The EcoFibre wordmark only. Retired everywhere else. */
      wordmark: ['Montserrat', 'system-ui', 'sans-serif'],
    },

    /** Fixed steps. No ad-hoc sizes. */
    fontSize: {
      eyebrow: ['11px', { lineHeight: '1', letterSpacing: '0.14em' }],
      label: ['13px', { lineHeight: '1.4' }],
      table: ['13px', { lineHeight: '1.5' }],
      body: ['15px', { lineHeight: '1.6' }],
      subtitle: ['17px', { lineHeight: '1.4' }],
      figure: ['19px', { lineHeight: '1.2' }],
      title: ['21px', { lineHeight: '1.3' }],
      finding: ['30px', { lineHeight: '1.25' }],
      'figure-xl': ['42px', { lineHeight: '1' }],
    },

    /** An 8px base: 8 · 16 · 24 · 32 · 48 · 64 · 96. Nothing between. */
    spacing: {
      0: '0px',
      px: '1px',
      1: '8px',
      2: '16px',
      3: '24px',
      4: '32px',
      6: '48px',
      8: '64px',
      12: '96px',
    },

    /** Pills, buttons and form fields. Containers have none. */
    borderRadius: {
      none: '0',
      DEFAULT: '4px',
      full: '9999px',
    },

    borderWidth: {
      DEFAULT: '1px',
      0: '0',
      2: '2px',
    },

    /** Cards are retired, so there is nothing to raise. */
    boxShadow: {
      none: 'none',
    },

    extend: {
      maxWidth: {
        /** Standard tabs. The statement and the order table go full bleed. */
        page: '1280px',
        prose: '68ch',
      },
      fontWeight: {
        normal: '400',
        medium: '500',
        semibold: '600',
      },
    },
  },
  plugins: [],
}
