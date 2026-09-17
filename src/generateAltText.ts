import type {AltTextGeneratorConfig} from './context'

const DEFAULT_ENDPOINT = 'https://alttextgeneratorai.com/api/sanity'

export type GenerateResult =
  | {ok: true; altText: string; creditsLeft: number | null}
  | {ok: false; message: string; tone: 'critical' | 'caution'}

function messageForStatus(status: number, body: string): {message: string; tone: 'critical' | 'caution'} {
  if (status === 401) return {message: 'Invalid API key. Check it under the plugin config.', tone: 'critical'}
  if (status === 402) return {message: 'No credits left on this API key.', tone: 'caution'}
  return {message: body || `Generation failed (${status}).`, tone: 'critical'}
}

export async function generateAltText(imageUrl: string, config: AltTextGeneratorConfig): Promise<GenerateResult> {
  try {
    const endpoint = config.apiEndpoint || DEFAULT_ENDPOINT
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        image: imageUrl,
        wpkey: config.apiKey,
        language: config.language || 'english',
      }),
    })

    const body = await res.text()

    if (!res.ok) {
      return {ok: false, ...messageForStatus(res.status, body)}
    }

    const creditsHeader = res.headers.get('X-Credits-Left')
    return {
      ok: true,
      altText: body.trim(),
      creditsLeft: creditsHeader === null ? null : Number(creditsHeader),
    }
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Network error while generating alt text.',
      tone: 'critical',
    }
  }
}
