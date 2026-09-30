import { defineConfig } from 'vitest/config'
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
  // The audit log is paused in production until Polyco's users are onboarded
  // (AUDIT_LOG=on turns it on). The tests run with it on, so what it records
  // stays proven for when it is switched on.
  test: { env: { AUDIT_LOG: 'on' } },
})
