import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * The as-at date on the Funds Requested tab is the day the site was built, in
 * Bahrain, where the statements are issued. The coverage rail runs to it, so the
 * gap after the last statement grows with each build instead of being fixed.
 */
const buildDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bahrain',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date())

export default defineConfig({
  plugins: [react()],
  define: { __BUILD_DATE__: JSON.stringify(buildDate) },
})
