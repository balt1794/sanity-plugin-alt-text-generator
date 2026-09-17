import type {AltTextGeneratorConfig} from './context'

const DEFAULT_ENDPOINT = 'https://alttextgeneratorai.com/api/sanity'

/**
 * The credits-check endpoint isn't Sanity-specific — it's the same
 * `/api/verify` every plugin (Framer, WordPress, Magento...) already calls.
 * Derived from the generation endpoint so a local-dev `apiEndpoint` override
 * (e.g. http://localhost:3000/api/sanity) checks credits against the same
 * local backend instead of production.
 */
function verifyEndpointFor(config: AltTextGeneratorConfig): string {
  const base = config.apiEndpoint || DEFAULT_ENDPOINT
  return base.replace(/\/[^/]+$/, '/verify')
}

export async function fetchCreditsRemaining(config: AltTextGeneratorConfig, apiKey: string): Promise<number | null> {
  if (!apiKey) return null
  try {
    const res = await fetch(verifyEndpointFor(config), {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({apiKey}),
    })
    if (!res.ok) return null
    const data = (await res.json()) as {freeRewritesLeft?: number}
    return typeof data.freeRewritesLeft === 'number' ? data.freeRewritesLeft : null
  } catch {
    return null
  }
}
