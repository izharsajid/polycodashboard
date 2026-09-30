import type { Config } from '@netlify/functions'
import { refuseUnlessEditor } from '../lib/editor'
import { json, wrongMethod } from '../lib/http'

/** Check an editor passcode before showing the forms. Answers yes or why not. */
export default async (req: Request) => {
  const badMethod = wrongMethod(req, 'POST')
  if (badMethod) return badMethod
  return refuseUnlessEditor(req) ?? json({ ok: true })
}

export const config: Config = { path: '/api/editor' }
