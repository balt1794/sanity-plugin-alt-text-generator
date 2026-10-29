import {useEffect, useRef} from 'react'
import {useAltTextGeneratorConfig} from './context'

/**
 * Runs `generate` once when an image is uploaded or swapped, if auto-generate
 * is switched on and an API key is set. A first upload only gets alt text when
 * the field is empty. Swapping one image for another always writes new alt
 * text, because the old text describes the old image. The asset the form opens
 * with is remembered first, so existing images are never touched just by
 * opening a document.
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
    if (!enabled) return
    if (previous || !filled) run()
  }, [assetRef])
}
