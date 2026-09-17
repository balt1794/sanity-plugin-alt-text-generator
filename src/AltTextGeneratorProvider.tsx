import {useEffect, useMemo, useState} from 'react'
import {useClient, type LayoutProps} from 'sanity'
import {AltTextGeneratorContext, type AltTextGeneratorConfig} from './context'
import {getSettingsApiKey} from './settingsStore'

const API_VERSION = '2024-01-01'

/**
 * Injects the plugin's config into React context for the whole Studio tree,
 * via the `studio.components.layout` slot — this is how a plugin makes its
 * config reachable from an input component deep in a document form, without
 * the merchant having to repeat the API key on every field.
 *
 * The API key can come from two places: the static `apiKey` passed to
 * `altTextGenerator({...})` in sanity.config.ts, and/or the key saved through
 * the plugin's own Settings panel (stored in a document — see
 * settingsStore.ts). The Settings-panel key takes priority once loaded, so a
 * merchant can paste their key into the Studio UI without touching code.
 */
export function createAltTextGeneratorProvider(staticConfig: AltTextGeneratorConfig) {
  return function AltTextGeneratorProvider(props: LayoutProps) {
    const client = useClient({apiVersion: API_VERSION})
    const [liveApiKey, setLiveApiKey] = useState<string | undefined>(undefined)

    useEffect(() => {
      let cancelled = false
      getSettingsApiKey(client)
        .then((key) => {
          if (!cancelled) setLiveApiKey(key)
        })
        .catch(() => {
          // No settings doc yet, or no read access — fall back to static config silently.
        })
      return () => {
        cancelled = true
      }
    }, [client])

    const value = useMemo(
      () => ({
        apiKey: liveApiKey || staticConfig.apiKey || '',
        apiEndpoint: staticConfig.apiEndpoint,
        language: staticConfig.language,
        updateApiKey: setLiveApiKey,
      }),
      [liveApiKey, staticConfig],
    )

    return (
      <AltTextGeneratorContext.Provider value={value}>
        {props.renderDefault(props)}
      </AltTextGeneratorContext.Provider>
    )
  }
}
