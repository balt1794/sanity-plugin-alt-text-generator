import type {Schema, SchemaType} from 'sanity'

export interface AltTextFieldTarget {
  documentType: string
  /** e.g. ['mainImage'] or ['seo', 'ogImage'] — joined with '.' for GROQ/patch paths. */
  fieldPath: string[]
}

function chainHasName(type: SchemaType | undefined, name: string): boolean {
  let t: SchemaType | undefined = type
  while (t) {
    if (t.name === name) return true
    t = (t as {type?: SchemaType}).type
  }
  return false
}

function hasAltSubfield(imageType: SchemaType): boolean {
  const fields = (imageType as {fields?: {name: string}[]}).fields || []
  return fields.some((f) => f.name === 'alt')
}

const MAX_NESTING_DEPTH = 2

function walkFields(
  type: SchemaType,
  path: string[],
  documentType: string,
  out: AltTextFieldTarget[],
  seen: Set<string>,
  depth: number,
) {
  const fields = (type as {fields?: {name: string; type: SchemaType}[]}).fields
  if (!fields) return

  for (const field of fields) {
    const fieldPath = [...path, field.name]
    const fieldType = field.type

    if (chainHasName(fieldType, 'image')) {
      if (hasAltSubfield(fieldType)) {
        const key = `${documentType}:${fieldPath.join('.')}`
        if (!seen.has(key)) {
          seen.add(key)
          out.push({documentType, fieldPath})
        }
      }
      continue
    }

    // Recurse into plain nested objects (e.g. `seo.ogImage`), skip arrays/references
    // to keep discovery predictable — deeply nested or array-of-image fields are a
    // known gap, not attempted here.
    if (fieldType.jsonType === 'object' && depth < MAX_NESTING_DEPTH) {
      walkFields(fieldType, fieldPath, documentType, out, seen, depth + 1)
    }
  }
}

/**
 * Walks every document type in the (fully merged, runtime) schema and finds
 * every image field that has an `alt` subfield — the convention this plugin's
 * own AltTextImageInput relies on, and the one most real-world Sanity schemas
 * already use for accessible images either way.
 */
export function findAltTextFields(schema: Schema): AltTextFieldTarget[] {
  const results: AltTextFieldTarget[] = []
  const seen = new Set<string>()

  for (const typeName of schema.getTypeNames()) {
    const type = schema.get(typeName)
    if (!type || !chainHasName(type, 'document')) continue
    walkFields(type, [], typeName, results, seen, 0)
  }

  return results
}
