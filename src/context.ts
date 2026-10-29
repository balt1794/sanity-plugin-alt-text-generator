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
  /**
   * Write alt text automatically when an image is uploaded and its alt field is
   * still empty. Off by default because each image uses one credit. People can
   * also switch it on in the plugin's Settings panel, which takes priority.
   */
  autoGenerate?: boolean
}

export interface AltTextGeneratorContextValue {
  apiKey: string
  apiEndpoint?: string
  language?: string
  autoGenerate: boolean
  /** Updates the live, in-memory API key immediately after a successful save from Settings. */
  updateApiKey: (apiKey: string) => void
  /** Updates the live auto-generate switch immediately after it is saved from Settings. */
  updateAutoGenerate: (autoGenerate: boolean) => void
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
