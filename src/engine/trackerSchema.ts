import { z } from 'zod'

/**
 * What efdashboard.com holds for the PO tracker, as /api/tracker passes it on:
 * the `po_data` rows and `settings` from its Supabase project, and the file list
 * from its own /api/po-documents. efdashboard.com is the master for orders and
 * dispatches; this site reads it live and never edits it.
 */
const Text = z.string().nullable().optional().transform((v) => v ?? '')

export const TrackerRow = z.object({
  id: z.number(),
  row_no: Text,
  product: Text,
  po_number: Text,
  film: Text,
  rolls: Text,
  shipping: Text,
  cargo_ready: Text,
  qty: Text,
  dispatched: Text,
  status: Text,
  sort_order: z.number().nullable().optional(),
})

export const TrackerDocument = z.object({
  po: z.string(),
  name: z.string(),
  title: z.string(),
  note: z.string().nullable().optional().transform((v) => v ?? ''),
  size: z.number().nullable().optional(),
  updated_at: z.string().nullable().optional(),
})

/** efdashboard.com's Line Usage: what each machine is on now. */
export const LineUsageRow = z.object({
  id: z.number(),
  section: z.string(),
  machine: z.string(),
  running: z.boolean().nullable().transform((v) => v ?? false),
  product: Text,
  schedule: Text,
  notes: Text,
  sort_order: z.number().nullable().optional(),
})

export const TrackerPayload = z.object({
  rows: z.array(TrackerRow),
  settings: z.array(z.object({ key: z.string(), value: z.string().nullable() })),
  documents: z.array(TrackerDocument),
  line_usage: z.array(LineUsageRow).default([]),
  fetched_at: z.string(),
})

export type TrackerRowT = z.infer<typeof TrackerRow>
export type TrackerDocumentT = z.infer<typeof TrackerDocument>
export type TrackerPayloadT = z.infer<typeof TrackerPayload>
export type LineUsageRowT = z.infer<typeof LineUsageRow>
