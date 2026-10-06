import config from '../../../tailwind.config.js'
import type { Family } from '../../engine/machines'

/**
 * The design tokens as plain colours for three.js, which cannot take a class
 * name. Nothing here is a new colour: every value is read from tailwind.config.js.
 */
type Tokens = {
  zinc: string
  sheet: string
  rule: string
  mist: string
  marking: string
  alert: string
  press: { DEFAULT: string; 2: string }
  info: { DEFAULT: string; wash: string }
  income: { DEFAULT: string; wash: string }
  caution: { DEFAULT: string; wash: string }
  cat: Record<'payroll' | 'raw' | 'working' | 'compliance' | 'supplier' | 'facility' | 'logistics', string>
}
const c = config.theme.colors as unknown as Tokens

export const T = {
  floor: c.zinc,
  sheet: c.sheet,
  rule: c.rule,
  mist: c.mist,
  ink: c.press.DEFAULT,
  steel: c.press[2],
  yellow: c.marking,
  red: c.alert,
  blue: c.info.DEFAULT,
  glass: c.info.wash,
  teal: c.cat.facility,
  heat: c.cat.logistics,
  green: c.cat.compliance,
  amber: c.marking,
}

/** One colour per product family, the same hues as the Machines tab. */
export const FAMILY_HEX: Record<Family, string> = {
  medical: c.cat.payroll,
  platinum: c.cat.supplier,
  oasis: c.cat.facility,
  pointfive: c.cat.raw,
  destiny: c.cat.logistics,
  halfm: c.cat.working,
  other: c.press[2],
}
