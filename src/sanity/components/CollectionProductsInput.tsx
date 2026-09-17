'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useClient, useFormValue, type StringInputProps } from 'sanity'
import { IntentLink } from 'sanity/router'
import { Badge, Box, Button, Card, Flex, Spinner, Stack, Text, TextInput } from '@sanity/ui'
import { AddIcon, LaunchIcon, SearchIcon, TrashIcon } from '@sanity/icons'
import {
  COLLECTION_PRODUCTS_QUERY,
  COLLECTION_PRODUCT_SEARCH_QUERY,
  addCollectionRefMutations,
  baseDocId,
  removeCollectionRefMutations,
  type CollectionProductRow,
} from '../lib/collectionRefs'

const API_VERSION = '2025-10-11'
const DRAFT = 'drafts.'

type Row = CollectionProductRow & { hasDraft: boolean; hasPublished: boolean }

/** Scala wersję opublikowaną i szkic produktu w jeden wiersz (szkic ma pierwszeństwo w podglądzie). */
function mergeVersions(rows: CollectionProductRow[]): Row[] {
  const byId = new Map<string, Row>()
  for (const row of rows) {
    const id = baseDocId(row._id)
    const isDraft = row._id.startsWith(DRAFT)
    const prev = byId.get(id)
    const next: Row = {
      ...(prev && !isDraft ? prev : row),
      _id: id,
      hasDraft: Boolean(prev?.hasDraft) || isDraft,
      hasPublished: Boolean(prev?.hasPublished) || !isDraft,
    }
    byId.set(id, next)
  }
  return [...byId.values()].sort((a, b) => (a.title ?? '').localeCompare(b.title ?? '', 'pl'))
}

function ProductLine({ row, action }: { row: Row; action: React.ReactNode }) {
  return (
    <Card padding={2} radius={2} border>
      <Flex align="center" gap={3}>
        <Box style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 4, overflow: 'hidden', background: 'var(--card-muted-bg-color)' }}>
          {row.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`${row.imageUrl}?w=80&h=80&fit=crop`} alt="" style={{ width: 40, height: 40, objectFit: 'cover' }} />
          )}
        </Box>
        <Stack space={2} flex={1} style={{ minWidth: 0 }}>
          <Text size={1} weight="medium" textOverflow="ellipsis">
            {row.title || 'Produkt bez nazwy'}
          </Text>
          <Flex gap={2} align="center">
            {row.sku && (
              <Text size={0} muted>
                {row.sku}
              </Text>
            )}
            {!row.hasPublished && <Badge tone="caution" fontSize={0}>szkic</Badge>}
          </Flex>
        </Stack>
        <IntentLink intent="edit" params={{ id: row._id, type: 'product' }} title="Otwórz produkt">
          <Button as="span" mode="bleed" icon={LaunchIcon} padding={2} />
        </IntentLink>
        {action}
      </Flex>
    </Card>
  )
}

/**
 * Panel „Produkty w kolekcji” w Studio. Czyta produkty, które wskazują tę
 * kolekcję, i pozwala dopisać/usunąć referencję w produkcie (wszystkie
 * istniejące wersje: opublikowaną i szkic — inaczej publikacja szkicu
 * cofnęłaby zmianę). Sam dokument kolekcji nie jest modyfikowany.
 */
export function CollectionProductsInput(props: StringInputProps) {
  const client = useClient({ apiVersion: API_VERSION })
  const documentId = useFormValue(['_id']) as string | undefined
  const createdAt = useFormValue(['_createdAt']) as string | undefined
  const collectionId = documentId ? baseDocId(documentId) : null

  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Row[]>([])
  const [searching, setSearching] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const searchSeq = useRef(0)

  const load = useCallback(async () => {
    if (!collectionId) return
    setLoading(true)
    try {
      const data = await client.fetch<CollectionProductRow[]>(COLLECTION_PRODUCTS_QUERY, { id: collectionId })
      setRows(mergeVersions(data))
      setError('')
    } catch (err) {
      setError(`Nie udało się pobrać produktów: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }, [client, collectionId])

  useEffect(() => {
    void load()
  }, [load])

  // Wyszukiwarka produktów do dodania (z opóźnieniem, ostatnie zapytanie wygrywa).
  useEffect(() => {
    const term = query.replace(/[*"\\]/g, ' ').trim()
    if (term.length < 2) {
      setResults([])
      return
    }
    const seq = ++searchSeq.current
    setSearching(true)
    const timer = setTimeout(async () => {
      try {
        const data = await client.fetch<CollectionProductRow[]>(COLLECTION_PRODUCT_SEARCH_QUERY, { q: `*${term}*` })
        if (seq === searchSeq.current) setResults(mergeVersions(data))
      } catch {
        if (seq === searchSeq.current) setResults([])
      } finally {
        if (seq === searchSeq.current) setSearching(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [client, query])

  const memberIds = useMemo(() => new Set(rows.map((row) => row._id)), [rows])

  const mutate = async (productId: string, kind: 'add' | 'remove') => {
    if (!collectionId) return
    setBusy(productId)
    setError('')
    try {
      const versions = await client.fetch<string[]>('*[_id in [$id, $draft]]._id', {
        id: productId,
        draft: `${DRAFT}${productId}`,
      })
      if (!versions.length) throw new Error('Produkt nie istnieje.')
      const mutations =
        kind === 'add'
          ? addCollectionRefMutations(versions, collectionId)
          : removeCollectionRefMutations(versions, collectionId)
      await client.mutate(mutations, { visibility: 'sync' })
      await load()
    } catch (err) {
      setError(`Nie udało się ${kind === 'add' ? 'dodać' : 'usunąć'} produktu: ${(err as Error).message}`)
    } finally {
      setBusy(null)
    }
  }

  if (!collectionId) return null

  return (
    <Stack space={3} data-testid={props.id}>
      {!createdAt && (
        <Card padding={3} radius={2} tone="caution">
          <Text size={1}>Kolekcja nie jest jeszcze zapisana — wpisz nazwę, a potem dodawaj produkty.</Text>
        </Card>
      )}

      <TextInput
        icon={SearchIcon}
        placeholder="Szukaj produktu po nazwie lub SKU, aby dodać…"
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
        disabled={!createdAt}
      />
      {searching && (
        <Flex justify="center" padding={2}>
          <Spinner muted />
        </Flex>
      )}
      {!searching && query.trim().length >= 2 && (
        <Stack space={2}>
          {results.length === 0 && (
            <Text size={1} muted>
              Brak produktów pasujących do „{query.trim()}”.
            </Text>
          )}
          {results.map((row) => (
            <ProductLine
              key={row._id}
              row={row}
              action={
                memberIds.has(row._id) ? (
                  <Badge tone="positive">w kolekcji</Badge>
                ) : (
                  <Button
                    icon={AddIcon}
                    text="Dodaj"
                    tone="primary"
                    mode="ghost"
                    fontSize={1}
                    padding={2}
                    loading={busy === row._id}
                    disabled={Boolean(busy)}
                    onClick={() => void mutate(row._id, 'add')}
                  />
                )
              }
            />
          ))}
        </Stack>
      )}

      {error && (
        <Card padding={3} radius={2} tone="critical">
          <Text size={1}>{error}</Text>
        </Card>
      )}

      <Text size={1} weight="semibold">
        {loading ? 'Wczytywanie…' : `W kolekcji: ${rows.length}`}
      </Text>
      {!loading && rows.length === 0 && (
        <Text size={1} muted>
          Brak produktów. Dodaj je wyszukiwarką powyżej albo wybierz tę kolekcję w polu „Kolekcje” produktu.
        </Text>
      )}
      <Stack space={2}>
        {rows.map((row) => (
          <ProductLine
            key={row._id}
            row={row}
            action={
              <Button
                icon={TrashIcon}
                mode="bleed"
                tone="critical"
                padding={2}
                title="Usuń z kolekcji"
                loading={busy === row._id}
                disabled={Boolean(busy)}
                onClick={() => void mutate(row._id, 'remove')}
              />
            }
          />
        ))}
      </Stack>
    </Stack>
  )
}

export default CollectionProductsInput
