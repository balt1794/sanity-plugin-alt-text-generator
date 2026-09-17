import type {SanityClient} from 'sanity'
import type {AltTextFieldTarget} from './schemaScan'

export interface AltTextRow {
  key: string
  documentId: string
  documentType: string
  documentTitle: string
  fieldPath: string[]
  fieldLabel: string
  imageUrl: string | null
  alt: string
}

function fieldAlias(fieldPath: string[]): string {
  return 'f_' + fieldPath.join('_')
}

function groqPath(fieldPath: string[]): string {
  return fieldPath.join('.')
}

/**
 * One GROQ query per document type (fields are grouped by documentType first),
 * projecting every discovered image field on that type plus a best-effort title.
 */
function buildQuery(documentType: string, fields: AltTextFieldTarget[]): string {
  const projections = fields
    .map((f) => {
      const alias = fieldAlias(f.fieldPath)
      const path = groqPath(f.fieldPath)
      return `"${alias}": ${path}{alt, "url": asset->url}`
    })
    .join(',\n    ')

  return `*[_type == "${documentType}"]{
    _id,
    _type,
    "documentTitle": coalesce(title, name, heading, label, _id),
    ${projections}
  }`
}

export async function fetchAltTextRows(
  client: SanityClient,
  targets: AltTextFieldTarget[],
): Promise<AltTextRow[]> {
  const byType = new Map<string, AltTextFieldTarget[]>()
  for (const t of targets) {
    const list = byType.get(t.documentType) || []
    list.push(t)
    byType.set(t.documentType, list)
  }

  const rows: AltTextRow[] = []

  for (const [documentType, fields] of byType) {
    const query = buildQuery(documentType, fields)
    const docs = await client.fetch<Record<string, unknown>[]>(query)

    for (const doc of docs) {
      for (const f of fields) {
        const alias = fieldAlias(f.fieldPath)
        const value = doc[alias] as {alt?: string; url?: string} | null | undefined
        if (!value || !value.url) continue // field empty on this doc — nothing to show

        rows.push({
          key: `${doc._id}:${f.fieldPath.join('.')}`,
          documentId: doc._id as string,
          documentType,
          documentTitle: (doc.documentTitle as string) || (doc._id as string),
          fieldPath: f.fieldPath,
          fieldLabel: f.fieldPath.join(' › '),
          imageUrl: value.url,
          alt: value.alt || '',
        })
      }
    }
  }

  return rows
}

export interface AltTextUpdate {
  documentId: string
  fieldPath: string[]
  alt: string
}

/** Saves every update in one transaction — either all land or none do. */
export async function saveAltTextUpdates(client: SanityClient, updates: AltTextUpdate[]): Promise<void> {
  if (!updates.length) return

  let tx = client.transaction()
  for (const u of updates) {
    const patchKey = `${groqPath(u.fieldPath)}.alt`
    tx = tx.patch(u.documentId, (p) => p.set({[patchKey]: u.alt}))
  }
  await tx.commit()
}
