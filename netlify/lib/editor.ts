import { createHash, timingSafeEqual } from 'node:crypto'
import { fail } from './http'

/**
 * Who may change the statement. The site is open to read, so recording a
 * payment, an invoice, a correction or a file needs the editor passcode, set as
 * EDITOR_KEY in the Netlify environment. Without it, editing is off.
 *
 * The passcode travels in the `x-editor-key` header and is compared in constant
 * time. It is never logged and never stored; the name typed with each change is
 * what the audit log and the statement record.
 */
export function editorEnabled(): boolean {
  return Boolean(process.env.EDITOR_KEY?.trim())
}

function same(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

/** A refusal, or null when the request carries the right passcode. */
export function refuseUnlessEditor(req: Request): Response | null {
  const key = process.env.EDITOR_KEY?.trim()
  if (!key) return fail(503, 'Editing is switched off. Set EDITOR_KEY in the Netlify environment to turn it on.')
  const given = req.headers.get('x-editor-key') ?? ''
  if (!given || !same(given, key)) return fail(401, 'That editor passcode is not right.')
  return null
}
