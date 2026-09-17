import {useCallback, useEffect, useState} from 'react'
import {Box, Button, Card, Flex, Stack, Text, TextInput} from '@sanity/ui'
import {useClient} from 'sanity'
import {useAltTextGeneratorConfig} from './context'
import {saveSettingsApiKey} from './settingsStore'
import {fetchCreditsRemaining} from './verifyCredits'

const API_VERSION = '2024-01-01'
const GET_KEY_URL = 'https://alttextgeneratorai.com/dashboard'

/**
 * Lets a merchant paste their API key directly in the Studio, no code edit
 * required — saved to a plugin-internal settings document (settingsStore.ts)
 * and pushed straight into the shared context so every open field/tool picks
 * it up immediately. Also shows the current credit balance for the active key.
 */
export function SettingsPanel() {
  const client = useClient({apiVersion: API_VERSION})
  const config = useAltTextGeneratorConfig()

  const [keyInput, setKeyInput] = useState(config.apiKey)
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [credits, setCredits] = useState<number | null>(null)
  const [checkingCredits, setCheckingCredits] = useState(false)

  // Keep the input in sync if the live key changes elsewhere (e.g. loaded after mount).
  useEffect(() => {
    setKeyInput(config.apiKey)
  }, [config.apiKey])

  const checkCredits = useCallback(
    async (apiKey: string) => {
      if (!apiKey) {
        setCredits(null)
        return
      }
      setCheckingCredits(true)
      const result = await fetchCreditsRemaining(config, apiKey)
      setCredits(result)
      setCheckingCredits(false)
    },
    [config],
  )

  useEffect(() => {
    checkCredits(config.apiKey)
    // Only re-check when the live key itself changes, not on every config identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.apiKey])

  const handleSave = useCallback(async () => {
    setSaving(true)
    setError(null)
    setJustSaved(false)
    try {
      const trimmed = keyInput.trim()
      await saveSettingsApiKey(client, trimmed)
      config.updateApiKey(trimmed)
      setJustSaved(true)
      checkCredits(trimmed)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }, [client, keyInput, config, checkCredits])

  return (
    <Card padding={4} radius={2} border tone="transparent">
      <Stack gap={3}>
        <Text size={1} weight="medium">
          API Key
        </Text>
        <Text size={1} muted>
          Paste your Alt Text Generator API key below.{' '}
          <a href={GET_KEY_URL} target="_blank" rel="noreferrer">
            Get a free API key →
          </a>
        </Text>
        <Flex gap={2} align="center" wrap="wrap">
          <Box flex={1} style={{minWidth: 240}}>
            <TextInput
              value={keyInput}
              placeholder="Paste your API key"
              onChange={(e) => setKeyInput(e.currentTarget.value)}
            />
          </Box>
          <Button
            text={saving ? 'Saving…' : 'Save'}
            tone="primary"
            disabled={saving || keyInput.trim() === config.apiKey}
            onClick={handleSave}
          />
        </Flex>
        {justSaved && (
          <Text size={1} style={{color: 'var(--card-positive-fg-color, #2a9d5c)'}}>
            Saved.
          </Text>
        )}
        {error && (
          <Text size={1} style={{color: 'var(--card-critical-fg-color, #e02b27)'}}>
            {error}
          </Text>
        )}
        {!config.apiKey && (
          <Text size={1} style={{color: 'var(--card-caution-fg-color, #a56a0d)'}}>
            No API key configured yet — generation will fail until you add one.
          </Text>
        )}
        {config.apiKey && (
          <Text size={1} muted>
            {checkingCredits
              ? 'Checking credits…'
              : credits === null
                ? 'Could not check credits for this key.'
                : `${credits} credit${credits === 1 ? '' : 's'} remaining`}
          </Text>
        )}
      </Stack>
    </Card>
  )
}
