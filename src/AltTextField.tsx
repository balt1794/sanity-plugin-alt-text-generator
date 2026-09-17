import {useCallback, useState} from 'react'
import {Button, Card, Flex, Stack, Text} from '@sanity/ui'
import {set, useClient, useFormValue, type StringInputProps} from 'sanity'
import imageUrlBuilder from '@sanity/image-url'
import {useAltTextGeneratorConfig} from './context'
import {generateAltText, type GenerateResult} from './generateAltText'

const API_VERSION = '2024-01-01'

type ImageWithAsset = {asset?: {_ref: string}}

/**
 * Attaches to the `alt` STRING field itself (not the whole image type), so
 * the "Generate Alt Text" button renders directly under the Alternative Text
 * input instead of below every other field on the image (e.g. Caption).
 *
 * Reads the sibling image value via useFormValue since a field-level input
 * component only gets its own value/path, not the parent object's.
 */
export function AltTextField(props: StringInputProps) {
  const {onChange, value = ''} = props
  const config = useAltTextGeneratorConfig()
  const client = useClient({apiVersion: API_VERSION})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Extract<GenerateResult, {ok: false}> | null>(null)

  // props.path is e.g. ['mainImage', 'alt'] — the image value lives one level up.
  const imagePath = props.path.slice(0, -1)
  const imageValue = useFormValue(imagePath) as ImageWithAsset | undefined

  const handleGenerate = useCallback(async () => {
    if (!imageValue?.asset?._ref || !config.apiKey) return
    setLoading(true)
    setError(null)

    try {
      const {projectId, dataset} = client.config()
      if (!projectId || !dataset) {
        throw new Error('Could not determine the Sanity project/dataset for this Studio.')
      }
      const imageUrl = imageUrlBuilder({projectId, dataset}).image(imageValue).url()

      const result = await generateAltText(imageUrl, config)
      if (!result.ok) {
        setError(result)
        return
      }
      onChange(set(result.altText))
    } catch (e) {
      setError({
        ok: false,
        message: e instanceof Error ? e.message : 'Network error while generating alt text.',
        tone: 'critical',
      })
    } finally {
      setLoading(false)
    }
  }, [imageValue, client, config, onChange])

  return (
    <Stack gap={2}>
      {props.renderDefault(props)}
      {imageValue?.asset && (
        <Stack gap={2}>
          <Flex>
            <Button
              text={loading ? 'Generating…' : 'Generate Alt Text'}
              tone="primary"
              mode="ghost"
              disabled={loading || !config.apiKey}
              onClick={handleGenerate}
            />
          </Flex>
          {error && (
            <Card tone={error.tone} padding={2} radius={2} border>
              <Text size={1}>{error.message}</Text>
            </Card>
          )}
          {!config.apiKey && (
            <Text size={1} muted>
              No API key configured — open the &quot;Alt Text Generator&quot; tool in the nav to add one.
            </Text>
          )}
        </Stack>
      )}
    </Stack>
  )
}
