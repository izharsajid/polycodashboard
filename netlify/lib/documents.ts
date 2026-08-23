import { z } from 'zod'
import { STORES } from './config'
import { kv } from './kv'
import { Timestamp } from './schema'
import { newId } from './tokens'

/**
 * Documents against an order. PO-TRACKER-SPEC section 4.
 *
 * Two stores: the bytes in one, the metadata in another, so a list renders
 * without pulling every file.
 */
export const DocumentGroup = z.enum(['purchase-order', 'delivery'])

export const DocumentMeta = z.object({
  id: z.string().min(1),
  orderId: z.string().min(1),
  group: DocumentGroup,
  /** What the person called it. Shown, never used to build a path. */
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(120),
  size: z.number().int().min(1),
  uploadedBy: z.string().min(1),
  uploadedByEmail: z.string().max(254),
  uploadedAt: Timestamp,
  /** Soft delete only. The file stays retrievable. Section 4. */
  deletedAt: Timestamp.nullable(),
  deletedBy: z.string().nullable(),
  deletedByEmail: z.string().max(254).nullable(),
})

export type DocumentGroupT = z.infer<typeof DocumentGroup>
export type DocumentMetaT = z.infer<typeof DocumentMeta>

/** Section 4: PDF, JPEG, PNG and the Office formats. */
export const MAX_FILE_BYTES = 20 * 1024 * 1024
export const MAX_FILES_PER_ORDER = 20

type Signature = { type: string; extensions: string[]; test: (bytes: Uint8Array) => boolean }

const startsWith = (bytes: Uint8Array, prefix: number[]) =>
  prefix.every((byte, i) => bytes[i] === byte)

/**
 * What the file actually is, from its first bytes.
 *
 * Section 6: never trust a filename or a declared MIME type. Both are supplied by
 * whoever is uploading, and a `.pdf` that is really something else is the oldest
 * trick there is.
 *
 * The Office formats are ZIP containers, so a docx, xlsx and pptx all start with
 * `PK`. That is as far as magic bytes can take us without unpacking the archive,
 * so a ZIP is accepted as the Office family and the declared type is used only to
 * choose between them for display.
 */
const SIGNATURES: Signature[] = [
  {
    type: 'application/pdf',
    extensions: ['pdf'],
    test: (b) => startsWith(b, [0x25, 0x50, 0x44, 0x46]), // %PDF
  },
  {
    type: 'image/jpeg',
    extensions: ['jpg', 'jpeg'],
    test: (b) => startsWith(b, [0xff, 0xd8, 0xff]),
  },
  {
    type: 'image/png',
    extensions: ['png'],
    test: (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  {
    type: 'application/zip',
    extensions: ['docx', 'xlsx', 'pptx'],
    test: (b) => startsWith(b, [0x50, 0x4b, 0x03, 0x04]) || startsWith(b, [0x50, 0x4b, 0x05, 0x06]),
  },
  {
    // The pre-2007 Office formats are OLE compound files.
    type: 'application/x-ole-storage',
    extensions: ['doc', 'xls', 'ppt'],
    test: (b) => startsWith(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
  },
]

const OFFICE_TYPES: Record<string, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  doc: 'application/msword',
  xls: 'application/vnd.ms-excel',
  ppt: 'application/vnd.ms-powerpoint',
}

export const ALLOWED_DESCRIPTION = 'PDF, JPEG, PNG, Word, Excel or PowerPoint'

export type Sniffed =
  | { ok: true; contentType: string }
  | { ok: false; reason: string }

/**
 * The extension is consulted only to pick which Office type a ZIP is, and only
 * after the bytes have already proved it is a ZIP. It never decides whether a
 * file is allowed.
 */
export function sniff(bytes: Uint8Array, filename: string): Sniffed {
  if (bytes.length === 0) return { ok: false, reason: 'That file is empty.' }

  const match = SIGNATURES.find((signature) => signature.test(bytes))
  if (!match) {
    return { ok: false, reason: `That file is not one we take. Allowed: ${ALLOWED_DESCRIPTION}.` }
  }

  if (match.type === 'application/zip' || match.type === 'application/x-ole-storage') {
    const extension = filename.split('.').pop()?.toLowerCase() ?? ''
    if (!match.extensions.includes(extension)) {
      return {
        ok: false,
        reason: `That looks like an archive rather than an Office file. Allowed: ${ALLOWED_DESCRIPTION}.`,
      }
    }
    return { ok: true, contentType: OFFICE_TYPES[extension] }
  }

  return { ok: true, contentType: match.type }
}

/**
 * The key the bytes are stored under. Built from identifiers we generated, never
 * from anything the uploader supplied. Section 4.
 */
export function storageKey(orderId: string, documentId: string): string {
  return `${encodeURIComponent(orderId)}:${documentId}`
}

const metaStore = () => kv(STORES.documentMeta)
const fileStore = () => kv(STORES.documents)

export async function listDocuments(orderId: string): Promise<DocumentMetaT[]> {
  const keys = await metaStore().keys(`${encodeURIComponent(orderId)}:`)
  const raw = await Promise.all(keys.map((key) => metaStore().get(key)))

  return raw
    .filter((r) => r !== null)
    .map((r) => DocumentMeta.parse(r))
    .sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt))
}

export async function getDocument(id: string): Promise<DocumentMetaT | null> {
  // The metadata key carries the order, so a bare document id needs a scan. With
  // twenty files per order and a handful of orders in play that is cheap, and it
  // keeps one key format rather than a second index that can drift.
  for (const key of await metaStore().keys()) {
    if (!key.endsWith(`:${id}`)) continue
    const parsed = DocumentMeta.safeParse(await metaStore().get(key))
    if (parsed.success) return parsed.data
  }
  return null
}

export async function readDocumentBytes(meta: DocumentMetaT): Promise<string | null> {
  return fileStore().get<string>(storageKey(meta.orderId, meta.id))
}

export type SaveInput = {
  orderId: string
  group: DocumentGroupT
  filename: string
  bytes: Uint8Array
  contentType: string
  uploadedBy: string
  uploadedByEmail: string
}

export async function saveDocument(input: SaveInput, now = new Date()): Promise<DocumentMetaT> {
  const meta = DocumentMeta.parse({
    id: newId(),
    orderId: input.orderId,
    group: input.group,
    filename: input.filename,
    contentType: input.contentType,
    size: input.bytes.length,
    uploadedBy: input.uploadedBy,
    uploadedByEmail: input.uploadedByEmail,
    uploadedAt: now.toISOString(),
    deletedAt: null,
    deletedBy: null,
    deletedByEmail: null,
  })

  // Base64 because the Blobs wrapper carries JSON. Bytes first: metadata pointing
  // at a file that is not there is worse than a file nothing points at.
  await fileStore().put(storageKey(meta.orderId, meta.id), Buffer.from(input.bytes).toString('base64'))
  await metaStore().put(storageKey(meta.orderId, meta.id), meta)

  return meta
}

/** Soft. A document store that can lose a bill of lading without trace is not a record. */
export async function softDeleteDocument(
  meta: DocumentMetaT,
  by: { id: string; email: string },
  now = new Date(),
): Promise<DocumentMetaT> {
  const deleted: DocumentMetaT = {
    ...meta,
    deletedAt: now.toISOString(),
    deletedBy: by.id,
    deletedByEmail: by.email,
  }
  await metaStore().put(storageKey(meta.orderId, meta.id), deleted)
  return deleted
}

/**
 * How many live documents each order carries, keyed by order.
 *
 * The table wants a count against every row, and one request for the set beats
 * one request per order.
 */
export async function documentCounts(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}

  for (const key of await metaStore().keys()) {
    const parsed = DocumentMeta.safeParse(await metaStore().get(key))
    if (!parsed.success || parsed.data.deletedAt !== null) continue
    counts[parsed.data.orderId] = (counts[parsed.data.orderId] ?? 0) + 1
  }
  return counts
}
