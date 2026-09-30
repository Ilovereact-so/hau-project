'use client'

import { useCallback, useMemo } from 'react'
import { PatchEvent, set, unset, useFormValue, type ArrayOfPrimitivesInputProps } from 'sanity'
import { Box, Button, Card, Checkbox, Flex, Stack, Text } from '@sanity/ui'

/*
 * Przypisanie zdjęcia do wariantów produktu (pole `images[].variantKeys`).
 * Zamiast wpisywania kluczy — lista wariantów z checkboxami i skróty po
 * wartości opcji („wszystkie mint”). Nic nie zaznaczone = zdjęcie wspólne.
 */

type RawVariant = {
  _key?: string
  sku?: string
  optionValues?: Array<{ label?: string; value?: { _ref?: string } }>
}

function variantLabel(variant: RawVariant, index: number) {
  const parts = (variant.optionValues ?? []).map((ov) => ov?.label).filter(Boolean)
  return parts.length ? parts.join(' · ') : variant.sku || `Wariant ${index + 1}`
}

export function ImageVariantsInput(props: ArrayOfPrimitivesInputProps<string>) {
  const { onChange, value, readOnly } = props
  const rawVariants = useFormValue(['variants']) as RawVariant[] | undefined
  const variants = useMemo(() => rawVariants ?? [], [rawVariants])
  const selected = useMemo(() => new Set((value ?? []).filter(Boolean)), [value])

  const commit = useCallback(
    (next: Set<string>) => {
      const keys = variants.map((v) => v._key).filter((k): k is string => Boolean(k) && next.has(k!))
      onChange(PatchEvent.from(keys.length ? set(keys) : unset()))
    },
    [onChange, variants],
  )

  // Skróty: wartość opcji (etykieta „color: mint”) → warianty, które ją mają.
  const groups = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const variant of variants) {
      for (const ov of variant.optionValues ?? []) {
        if (!ov?.label || !variant._key) continue
        map.set(ov.label, [...(map.get(ov.label) ?? []), variant._key])
      }
    }
    return [...map.entries()].filter(([, keys]) => keys.length > 1 && keys.length < variants.length)
  }, [variants])

  if (!variants.length) {
    return (
      <Card padding={3} radius={2} tone="transparent" border>
        <Text size={1} muted>Produkt nie ma wariantów — zdjęcie jest wspólne.</Text>
      </Card>
    )
  }

  return (
    <Stack space={3}>
      <Text size={1} muted>
        {selected.size ? `Zdjęcie wariantów: ${selected.size} z ${variants.length}` : 'Nic nie zaznaczono — zdjęcie wspólne (widoczne przy każdym wariancie).'}
      </Text>
      {groups.length > 0 && (
        <Flex gap={2} wrap="wrap">
          {groups.map(([label, keys]) => {
            const all = keys.every((k) => selected.has(k))
            return (
              <Button
                key={label}
                mode={all ? 'default' : 'ghost'}
                tone={all ? 'primary' : 'default'}
                fontSize={1}
                padding={2}
                text={label}
                disabled={readOnly}
                onClick={() => {
                  const next = new Set(selected)
                  for (const k of keys) {
                    if (all) next.delete(k)
                    else next.add(k)
                  }
                  commit(next)
                }}
              />
            )
          })}
        </Flex>
      )}
      <Stack space={2}>
        {variants.map((variant, index) =>
          variant._key ? (
            <Flex key={variant._key} align="center" gap={2}>
              <Checkbox
                id={`iv-${variant._key}`}
                checked={selected.has(variant._key)}
                disabled={readOnly}
                onChange={() => {
                  const next = new Set(selected)
                  if (next.has(variant._key!)) next.delete(variant._key!)
                  else next.add(variant._key!)
                  commit(next)
                }}
              />
              <Box flex={1}>
                <Text size={1}>
                  <label htmlFor={`iv-${variant._key}`}>{variantLabel(variant, index)}</label>
                </Text>
              </Box>
            </Flex>
          ) : null,
        )}
      </Stack>
    </Stack>
  )
}
