import type {SanityClient} from 'sanity'

/**
 * A single, well-known document this plugin owns to store its own settings
 * (currently just the API key). Not registered in the consumer's schema —
 * Sanity's document store doesn't require a document's `_type` to be part of
 * the Studio's schema, so this stays entirely internal to the plugin and
 * never shows up in Content/search for the merchant.
 */
export const SETTINGS_DOC_ID = 'sanity-plugin-alt-text-generator.settings'
export const SETTINGS_DOC_TYPE = 'sanityPluginAltTextGeneratorSettings'

const API_VERSION = '2024-01-01'

export async function getSettingsApiKey(client: SanityClient): Promise<string | undefined> {
  const key = await client
    .withConfig({apiVersion: API_VERSION})
    .fetch<string | null>(`*[_id == $id][0].apiKey`, {id: SETTINGS_DOC_ID})
  return key || undefined
}

export async function saveSettingsApiKey(client: SanityClient, apiKey: string): Promise<void> {
  await client
    .withConfig({apiVersion: API_VERSION})
    .transaction()
    .createIfNotExists({_id: SETTINGS_DOC_ID, _type: SETTINGS_DOC_TYPE})
    .patch(SETTINGS_DOC_ID, (p) => p.set({apiKey}))
    .commit()
}
