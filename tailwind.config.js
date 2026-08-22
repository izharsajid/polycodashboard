/**
 * Tokens read off efdashboard.com as computed styles. See DESIGN.md for the
 * element each one came from. Do not add a colour that is not here: REDESIGN-SPEC
 * section 7.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#333333',
          strong: '#263D23',
          muted: '#6D7869',
          faint: '#7B8578',
          table: '#687365',
        },
        rule: {
          DEFAULT: '#DFE5DC',
          soft: '#DAE4D4',
          // Carry-over name. The strongest rule efdashboard uses is the field
          // border, so that is what it points at.
          strong: '#D8E5CE',
          field: '#D8E5CE',
        },
        paper: {
          DEFAULT: '#FAFAFA',
          panel: '#FBFCFA',
          surface: '#FFFFFF',
        },
        leaf: {
          DEFAULT: '#507A48',
          deep: '#294525',
          mid: '#41613B',
          kicker: '#71846B',
          wash: '#E6F5EB',
        },
        // Status palette from .po-state on the PO tracker. `critical` is the
        // only red in the system and stays reserved for shortfalls, exceptions
        // and placeholders.
        state: {
          good: '#257443',
          'good-wash': '#E6F5EB',
          info: '#345C8A',
          'info-wash': '#E8F1FB',
          plan: '#70458A',
          'plan-wash': '#F1E8F7',
          watch: '#8A4A10',
          'watch-wash': '#FFF0D8',
          critical: '#AD3029',
          'critical-wash': '#FDE8E6',
          off: '#625C5C',
          'off-wash': '#ECE9E9',
        },
        /**
         * Names the current components already use, pointed at the extracted
         * palette so nothing loses its colour between step 1 and step 5. Every
         * value below is a status colour above, not a new one. Steps 2 to 5
         * migrate the call sites to `state-*` and these come out.
         */
        alert: {
          DEFAULT: '#AD3029',
          wash: '#FDE8E6',
        },
        ember: {
          DEFAULT: '#8A4A10',
          wash: '#FFF0D8',
        },
      },
      fontFamily: {
        /**
         * efdashboard specifies "Segoe UI", which is a Windows system font. On
         * the Macs and phones this is read on it never resolves and falls
         * through to Tahoma, so copying the stack would copy an intention
         * rather than a result. Montserrat is already loaded here, renders the
         * same everywhere, and sits closer to the extracted weights than the
         * fallback does. See DESIGN.md.
         */
        sans: ['Montserrat', 'system-ui', 'sans-serif'],
        // Kept from this project. Financial figures must line up on the decimal,
        // which efdashboard's left-aligned table cells do not need to do.
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        kicker: ['0.72rem', { lineHeight: '1', letterSpacing: '0.0864rem' }],
        'table-head': ['0.7rem', { lineHeight: '1', letterSpacing: '0.0385rem' }],
        'table-cell': ['0.75rem', { lineHeight: '1.4' }],
        lede: ['0.88rem', { lineHeight: '1.6' }],
        section: ['1.45rem', { lineHeight: '1.25' }],
        title: ['2rem', { lineHeight: '1.6' }],
        figure: ['1.05rem', { lineHeight: '1.6' }],
      },
      borderRadius: {
        card: '14px',
        field: '6px',
        tab: '5px 5px 0 0',
      },
      boxShadow: {
        card: '0 10px 30px rgba(59, 89, 54, 0.08)',
      },
      spacing: {
        card: '1.625rem',
        'card-gap': '1.25rem',
      },
      borderWidth: {
        accent: '5px',
      },
    },
  },
  plugins: [],
}
