import type { Config, Context } from '@netlify/functions'
import { z } from 'zod'
import { Entry } from '../../src/engine/statementSchema'
import { record } from '../lib/audit'
import { refuseUnlessEditor } from '../lib/editor'
import { clientIp, fail, json, readBody, wrongMethod } from '../lib/http'
import { entries } from '../lib/statement-store'
import { newId } from '../lib/tokens'

/**
 * Record a payment, an invoice or a correction, or void one recorded in error.
 * Needs the editor passcode. Nothing is ever deleted: a voided entry stays, with
 * who voided it, when and why.
 */
const Create = z.object({
  action: z.literal('create'),
  entry: Entry.omit({ id: true, at: true, voided: true }),
})
const Void = z.object({
  action: z.literal('void'),
  id: z.string().min(1).max(60),
  by: z.string().min(1).max(80),
  reason: z.string().min(3).max(300),
})
const Body = z.discriminatedUnion('action', [Create, Void])

export default async (req: Request, context: Context) => {
  const badMethod = wrongMethod(req, 'POST')
  if (badMethod) return badMethod
  const refused = refuseUnlessEditor(req)
  if (refused) return refused

  const body = await readBody(req, Body)
  if (!body) return fail(400, 'That change is incomplete. Check the amount, date, description and your name.')
  const store = entries()

  if (body.action === 'create') {
    const e = body.entry
    if (e.kind === 'correction') {
      if (!e.field) return fail(400, 'Say what is being corrected.')
      const addsPo = e.field === 'po_amount' && e.row === null && e.po
      if (e.row === null && !addsPo) return fail(400, 'A correction needs the workbook row it applies to.')
      if ((e.field === 'received_date' || e.field === 'delivery_date') && !/^\d{4}-\d{2}-\d{2}$/.test(e.value ?? '')) {
        return fail(400, 'Give the corrected date.')
      }
      if (e.field === 'po' && !/^[A-Za-z0-9-]{1,40}$/.test(e.value ?? '')) return fail(400, 'Choose the PO to assign.')
    }
    if (e.kind === 'resolution' && !e.key) return fail(400, 'Say which discrepancy this settles.')
    if (e.kind === 'invoice' && !e.invoiceKind) return fail(400, 'Say whether the invoice is for goods, a recharge or something else.')
    const saved = Entry.parse({ ...e, id: newId(), at: new Date().toISOString(), voided: null })
    await store.put(saved.id, saved)
    await record({
      action: 'data_edited',
      result: 'success',
      actorEmail: null,
      target: `statement:${saved.kind}`,
      detail: `${saved.by} recorded ${saved.kind} ${saved.amount} on ${saved.date}: ${saved.description}`.slice(0, 1000),
      ip: clientIp(context),
    })
    return json({ entry: saved }, 201)
  }

  const existing = Entry.safeParse(await store.get(body.id))
  if (!existing.success) return fail(404, 'No recorded change has that reference.')
  if (existing.data.voided) return fail(409, 'That change is already voided.')
  const voided = { ...existing.data, voided: { by: body.by, at: new Date().toISOString(), reason: body.reason } }
  await store.put(voided.id, voided)
  await record({
    action: 'data_edited',
    result: 'success',
    target: `statement:void`,
    detail: `${body.by} voided ${existing.data.kind} ${existing.data.amount} (${existing.data.description}): ${body.reason}`.slice(0, 1000),
    ip: clientIp(context),
  })
  return json({ entry: voided })
}

export const config: Config = { path: '/api/statement/entries' }
