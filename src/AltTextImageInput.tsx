import {useCallback, useState} from 'react'
import {Button, Card, Flex, Stack, Text} from '@sanity/ui'
import {set, useClient, type ImageInputProps} from 'sanity'
import imageUrlBuilder from '@sanity/image-url'
import {useAltTextGeneratorConfig} from './context'
import {generateAltText, type GenerateResult} from './generateAltText'

const API_VERSION = '2024-01-01'

/**
 * Drop-in replacement for the default image input: renders the normal image
 * field (upload, crop, hotspot — via `renderDefault`) plus a "Generate Alt
 * Text" button that sends the uploaded asset's CDN URL to the Alt Text
 * Generator API and writes the result into the image's `alt` field.
 */
export function AltTextImageInput(props: ImageInputProps) {
  const {value, onChange} = props
  const config = useAltTextGeneratorConfig()
  const client = useClient({apiVersion: API_VERSION})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Extract<GenerateResult, {ok: false}> | null>(null)

  const handleGenerate = useCallback(async () => {
    if (!value?.asset?._ref || !config.apiKey) return
    setLoading(true)
    setError(null)

    try {
      const {projectId, dataset} = client.config()
      if (!projectId || !dataset) {
        throw new Error('Could not determine the Sanity project/dataset for this Studio.')
      }
      const imageUrl = imageUrlBuilder({projectId, dataset}).image(value).url()

      const result = await generateAltText(imageUrl, config)
      if (!result.ok) {
        setError(result)
        return
      }
      onChange(set(result.altText, ['alt']))
    } catch (e) {
      setError({
        ok: false,
        message: e instanceof Error ? e.message : 'Network error while generating alt text.',
        tone: 'critical',
      })
    } finally {
      setLoading(false)
    }
  }, [value, client, config, onChange])

  return (
    <Stack gap={2}>
      {props.renderDefault(props)}
      {value?.asset && (
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
