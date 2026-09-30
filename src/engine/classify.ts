/**
 * The seven categories and the rules that put every statement line into exactly
 * one of them. BRIEF-TAB1 section 2.
 *
 * The descriptions on the statements are free text and inconsistent, so the
 * rules match on the words that identify a cost, not on whole descriptions. Rules
 * only ever look at the description, never the remark: remarks explain a line,
 * and a remark that mentions clearance or AKD on a supplier payment must not
 * move that payment.
 *
 * There is no fallback bucket. A line that matches no category, or more than
 * one, is an error, and the test over all 149 lines keeps it that way. If a new
 * statement brings a line that will not classify, fix the rule here.
 */

/** Stack order, bottom to top. Chosen with the palette validator so every
 * neighbouring pair stays distinguishable for colour-blind readers. */
export const CATEGORIES = [
  'payroll',
  'raw',
  'working',
  'compliance',
  'supplier',
  'facility',
  'logistics',
] as const

export type Category = (typeof CATEGORIES)[number]

export const CATEGORY_LABEL: Record<Category, string> = {
  payroll: 'Payroll and people',
  raw: 'Raw material',
  working: 'Working capital',
  compliance: 'Compliance and certification',
  supplier: 'Supplier payments',
  facility: 'Facility',
  logistics: 'Logistics and clearance',
}

export const RULES: Record<Category, RegExp[]> = {
  // "N Fiber Containers" in every variant (bagasse, unbleached, bamboo), and the
  // AKD and wire mesh consumed with the fibre.
  raw: [/\bfib(?:er|re) containers?\b/i, /\bakd\b/i, /\bwire mesh\b/i],

  // Salaries, director payroll, GOSI and LMRA levies, accommodation, visas,
  // staff medical insurance.
  payroll: [
    /\bsalar(?:y|ies)\b/i,
    /\bpayroll\b/i,
    /\bgosi\b/i,
    /\blmra\b/i,
    /\baccommodation\b/i,
    /\bvisa\b/i,
    /\bmedical insurance\b/i,
  ],

  // Rent, power, water, and the factory's own insurance.
  facility: [/\brental\b/i, /\belectricity\b/i, /\bwater\b/i, /\bfactory insurance\b/i],

  supplier: [/\bsupplier payments?\b/i],

  // Certification, its maintenance work, and product recall cover.
  compliance: [/\bbrc\b/i, /\biso\b/i, /\bproduct recall insurance\b/i],

  // Clearing cargo and tools, couriers, and the customs duty refund.
  logistics: [/\bclearance\b/i, /\bfedex\b/i, /\bcourier\b/i, /\bcustoms duty\b/i],

  working: [/\bpetty cash\b/i],
}

/** Every category whose rules match. Exactly one is the only valid answer. */
export function matchCategories(description: string): Category[] {
  return CATEGORIES.filter((c) => RULES[c].some((rule) => rule.test(description)))
}

export class UnclassifiedLine extends Error {}

export function classify(description: string): Category {
  const found = matchCategories(description)
  if (found.length !== 1) {
    throw new UnclassifiedLine(
      found.length === 0
        ? `No category matches "${description}". Add a rule in src/engine/classify.ts.`
        : `"${description}" matches ${found.join(' and ')}. Tighten the rules so it matches one.`,
    )
  }
  return found[0]
}
