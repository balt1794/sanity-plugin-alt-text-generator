import {useEffect, useRef} from 'react'
import {useAltTextGeneratorConfig} from './context'

/**
 * Runs `generate` once when a new image is uploaded or swapped on a field whose
 * alt text is still empty, if auto-generate is switched on and an API key is
 * set. The asset the form opens with is remembered first, so existing images
 * that lack alt text are never touched just by opening a document.
 */
export function useAutoGenerate(assetRef: string | undefined, hasAlt: boolean, generate: () => void) {
  const config = useAltTextGeneratorConfig()
  const lastRef = useRef(assetRef)
  const latest = useRef({generate, hasAlt, enabled: false})
  latest.current = {generate, hasAlt, enabled: config.autoGenerate && Boolean(config.apiKey)}

  useEffect(() => {
    const previous = lastRef.current
    lastRef.current = assetRef
    if (!assetRef || assetRef === previous) return
    const {generate: run, hasAlt: filled, enabled} = latest.current
    if (enabled && !filled) run()
  }, [assetRef])
}
