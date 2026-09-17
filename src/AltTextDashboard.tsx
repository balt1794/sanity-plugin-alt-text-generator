import {useCallback, useMemo, useRef, useState} from 'react'
import {
  Box,
  Button,
  Card,
  Checkbox,
  Container,
  Flex,
  Heading,
  Stack,
  Text,
  TextArea,
  Spinner,
} from '@sanity/ui'
import {useClient, useSchema} from 'sanity'
import {findAltTextFields} from './schemaScan'
import {fetchAltTextRows, saveAltTextUpdates, type AltTextRow} from './dashboardData'
import {generateAltText} from './generateAltText'
import {useAltTextGeneratorConfig} from './context'
import {SettingsPanel} from './SettingsPanel'

const API_VERSION = '2024-01-01'

type Filter = 'missing' | 'all'

/**
 * The bulk companion to AltTextImageInput: scans every document type in the
 * schema for image fields that have an `alt` subfield (see schemaScan.ts),
 * lists every image found across the dataset, and lets the user review,
 * generate, and save alt text for many images in one pass.
 */
export function AltTextDashboard() {
  const schema = useSchema()
  const client = useClient({apiVersion: API_VERSION})
  const config = useAltTextGeneratorConfig()

  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [rows, setRows] = useState<AltTextRow[]>([])
  const [scannedTypes, setScannedTypes] = useState(0)

  const [filter, setFilter] = useState<Filter>('missing')
  const [overwrite, setOverwrite] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dirty, setDirty] = useState<Record<string, string>>({}) // key -> new alt text
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})

  const [bulkRunning, setBulkRunning] = useState(false)
  const [progress, setProgress] = useState('')
  const [credits, setCredits] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const stopRequested = useRef(false)

  const targets = useMemo(() => findAltTextFields(schema), [schema])

  const handleScan = useCallback(async () => {
    setScanning(true)
    setScanError(null)
    try {
      const found = await fetchAltTextRows(client, targets)
      setRows(found)
      setScannedTypes(new Set(targets.map((t) => t.documentType)).size)
      setDirty({})
      setSelected(new Set())
      setRowErrors({})
    } catch (e) {
      setScanError(e instanceof Error ? e.message : 'Scan failed.')
    } finally {
      setScanning(false)
    }
  }, [client, targets])

  const currentAlt = useCallback(
    (row: AltTextRow) => (row.key in dirty ? dirty[row.key] : row.alt),
    [dirty],
  )

  const visibleRows = useMemo(() => {
    return rows.filter((row) => {
      if (filter === 'all') return true
      const text = currentAlt(row)
      return !text || text.trim() === ''
    })
  }, [rows, filter, currentAlt])

  const isLocked = useCallback(
    (row: AltTextRow) => !overwrite && currentAlt(row).trim() !== '',
    [overwrite, currentAlt],
  )

  const setRowText = useCallback((key: string, text: string) => {
    setDirty((prev) => ({...prev, [key]: text}))
  }, [])

  const generateOne = useCallback(
    async (row: AltTextRow): Promise<{ok: boolean; message?: string}> => {
      setRowErrors((prev) => {
        const next = {...prev}
        delete next[row.key]
        return next
      })
      if (!row.imageUrl) return {ok: false, message: 'No image URL.'}

      const result = await generateAltText(row.imageUrl, config)
      if (!result.ok) {
        setRowErrors((prev) => ({...prev, [row.key]: result.message}))
        return {ok: false, message: result.message}
      }
      setRowText(row.key, result.altText)
      if (result.creditsLeft !== null) setCredits(result.creditsLeft)
      return {ok: true}
    },
    [config, setRowText],
  )

  const runBulk = useCallback(
    async (list: AltTextRow[]) => {
      setBulkRunning(true)
      stopRequested.current = false
      let done = 0
      let applied = 0
      let failed = 0
      let lastError = ''

      for (const row of list) {
        if (stopRequested.current) break
        const result = await generateOne(row)
        done++
        if (result.ok) {
          applied++
        } else {
          failed++
          lastError = result.message || ''
          if (lastError.toLowerCase().includes('credits')) {
            setProgress(`Stopped: out of credits. ${applied} generated.`)
            break
          }
        }
        setProgress(
          `${done} / ${list.length} · ${applied} generated` +
            (failed ? ` · ${failed} failed — last error: ${lastError}` : ''),
        )
      }

      setBulkRunning(false)
    },
    [generateOne],
  )

  const handleGenerateSelected = useCallback(() => {
    const list = visibleRows.filter((r) => selected.has(r.key) && !isLocked(r))
    if (!list.length) return
    runBulk(list)
  }, [visibleRows, selected, isLocked, runBulk])

  const handleGenerateAllMissing = useCallback(() => {
    const list = rows.filter((r) => currentAlt(r).trim() === '')
    if (!list.length) return
    runBulk(list)
  }, [rows, currentAlt, runBulk])

  const handleSave = useCallback(async () => {
    const updates = Object.entries(dirty).map(([key, alt]) => {
      const row = rows.find((r) => r.key === key)!
      return {documentId: row.documentId, fieldPath: row.fieldPath, alt}
    })
    if (!updates.length) return

    setSaving(true)
    try {
      await saveAltTextUpdates(client, updates)
      // Reflect saved values into the base rows and clear dirty state.
      setRows((prev) =>
        prev.map((r) => (r.key in dirty ? {...r, alt: dirty[r.key]} : r)),
      )
      setDirty({})
      setProgress(`Saved ${updates.length} image(s).`)
    } catch (e) {
      setProgress(`Save failed: ${e instanceof Error ? e.message : 'unknown error'}`)
    } finally {
      setSaving(false)
    }
  }, [dirty, rows, client])

  const toggleSelectAll = useCallback(
    (checked: boolean) => {
      setSelected(checked ? new Set(visibleRows.filter((r) => !isLocked(r)).map((r) => r.key)) : new Set())
    },
    [visibleRows, isLocked],
  )

  const missingCount = rows.filter((r) => currentAlt(r).trim() === '').length

  return (
    <Container width={4} padding={4}>
      <Stack gap={4}>
        <Heading size={2}>Alt Text Generator AI</Heading>

        <SettingsPanel />

        <Flex align="center" gap={3}>
          <Button text={scanning ? 'Scanning…' : 'Scan Dataset'} tone="primary" disabled={scanning} onClick={handleScan} />
          {rows.length > 0 && (
            <Text size={1} muted>
              {rows.length} image{rows.length === 1 ? '' : 's'} · {missingCount} missing alt text (scanned {scannedTypes}{' '}
              document type{scannedTypes === 1 ? '' : 's'})
            </Text>
          )}
          {scanning && <Spinner muted />}
        </Flex>

        {scanError && (
          <Card tone="critical" padding={3} radius={2} border>
            <Text size={1}>{scanError}</Text>
          </Card>
        )}

        {targets.length === 0 && !scanning && (
          <Card tone="caution" padding={3} radius={2} border>
            <Text size={1}>
              No image fields with an &quot;alt&quot; subfield were found in this Studio&apos;s schema. Add an{' '}
              <code>alt</code> string field to an image type (see the README) for it to show up here.
            </Text>
          </Card>
        )}

        {rows.length > 0 && (
          <Stack gap={4}>
            <Flex align="center" gap={3}>
              <Button
                text="Missing"
                mode={filter === 'missing' ? 'default' : 'ghost'}
                tone={filter === 'missing' ? 'primary' : 'default'}
                onClick={() => setFilter('missing')}
              />
              <Button
                text="All"
                mode={filter === 'all' ? 'default' : 'ghost'}
                tone={filter === 'all' ? 'primary' : 'default'}
                onClick={() => setFilter('all')}
              />
              <Flex align="center" gap={2}>
                <Checkbox checked={overwrite} onChange={(e) => setOverwrite(e.currentTarget.checked)} id="atg-overwrite" />
                <Text as="label" size={1} htmlFor="atg-overwrite">
                  Overwrite images that already have alt text
                </Text>
              </Flex>
            </Flex>

            <Flex align="center" gap={2}>
              <Checkbox
                checked={visibleRows.length > 0 && visibleRows.every((r) => isLocked(r) || selected.has(r.key))}
                onChange={(e) => toggleSelectAll(e.currentTarget.checked)}
                id="atg-select-all"
              />
              <Text as="label" size={1} htmlFor="atg-select-all">
                Select all visible {selected.size > 0 && `(${selected.size} selected)`}
              </Text>
            </Flex>

            <Card border radius={2} style={{maxHeight: 520, overflowY: 'auto'}}>
              <Stack gap={0}>
                {visibleRows.map((row) => {
                  const locked = isLocked(row)
                  const text = currentAlt(row)
                  const error = rowErrors[row.key]
                  return (
                    <Flex key={row.key} padding={3} gap={3} align="flex-start" style={{borderBottom: '1px solid var(--card-border-color)'}}>
                      <Box paddingTop={1}>
                        <Checkbox
                          checked={selected.has(row.key)}
                          disabled={locked}
                          onChange={(e) => {
                            // Extract the primitive before it reaches the state
                            // updater — React can invoke that updater outside the
                            // original synchronous event (Strict Mode double-invokes
                            // it), and by then `e.currentTarget` is already null.
                            const checked = e.currentTarget.checked
                            setSelected((prev) => {
                              const next = new Set(prev)
                              if (checked) next.add(row.key)
                              else next.delete(row.key)
                              return next
                            })
                          }}
                        />
                      </Box>
                      {row.imageUrl && (
                        <img
                          src={`${row.imageUrl}?w=80&h=80&fit=crop`}
                          width={56}
                          height={56}
                          style={{objectFit: 'cover', borderRadius: 4, flexShrink: 0}}
                          alt=""
                        />
                      )}
                      <Box style={{width: 220, flexShrink: 0}}>
                        <Text size={1} weight="medium">
                          {row.documentTitle}
                        </Text>
                        <Text size={1} muted>
                          {row.documentType} · {row.fieldLabel}
                        </Text>
                      </Box>
                      <Box flex={1}>
                        <Stack gap={2}>
                          <TextArea
                            rows={2}
                            value={text}
                            disabled={locked}
                            onChange={(e) => setRowText(row.key, e.currentTarget.value)}
                          />
                          {error && (
                            <Text size={1} style={{color: 'var(--card-critical-fg-color, #e02b27)'}}>
                              {error}
                            </Text>
                          )}
                        </Stack>
                      </Box>
                      <Box paddingTop={1}>
                        <Button
                          text="Generate"
                          mode="ghost"
                          fontSize={1}
                          disabled={locked || bulkRunning}
                          onClick={() => generateOne(row)}
                        />
                      </Box>
                    </Flex>
                  )
                })}
              </Stack>
            </Card>

            <Flex align="center" gap={3} wrap="wrap">
              <Button
                text="Generate Selected"
                tone="primary"
                disabled={bulkRunning || selected.size === 0}
                onClick={handleGenerateSelected}
              />
              <Button
                text="Generate All Missing"
                mode="ghost"
                disabled={bulkRunning || missingCount === 0}
                onClick={handleGenerateAllMissing}
              />
              {bulkRunning && (
                <Button text="Stop" mode="ghost" tone="critical" onClick={() => (stopRequested.current = true)} />
              )}
              <Button
                text={saving ? 'Saving…' : 'Save Changes'}
                tone="positive"
                disabled={saving || Object.keys(dirty).length === 0}
                onClick={handleSave}
              />
              {credits !== null && (
                <Text size={1} muted>
                  ({credits} credits remaining)
                </Text>
              )}
            </Flex>

            {progress && (
              <Text size={1} muted>
                {progress}
              </Text>
            )}
          </Stack>
        )}
      </Stack>
    </Container>
  )
}
