import {createContext, useContext} from 'react'

export interface AltTextGeneratorConfig {
  /**
   * Optional default API key from your Alt Text Generator account
   * (alttextgeneratorai.com). Not required — merchants can instead (or also)
   * paste their key into the plugin's own Settings panel in the Studio, which
   * takes priority when both are set. Passing one here is mainly useful for
   * local development or CI.
   */
  apiKey?: string
  /** Override the generation endpoint — mainly useful for local development. */
  apiEndpoint?: string
  /** Default language for generated alt text, e.g. "english", "spanish". */
  language?: string
}

export interface AltTextGeneratorContextValue {
  apiKey: string
  apiEndpoint?: string
  language?: string
  /** Updates the live, in-memory API key immediately after a successful save from Settings. */
  updateApiKey: (apiKey: string) => void
}

export const AltTextGeneratorContext = createContext<AltTextGeneratorContextValue | null>(null)

export function useAltTextGeneratorConfig(): AltTextGeneratorContextValue {
  const ctx = useContext(AltTextGeneratorContext)
  if (!ctx) {
    throw new Error(
      'useAltTextGeneratorConfig must be used within the alt-text-generator plugin. ' +
        'Did you forget to add altTextGenerator() to your sanity.config plugins array?',
    )
  }
  return ctx
}
