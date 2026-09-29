import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/admin/guard'
import { getGuideForEditor } from '@/lib/admin/guides'
import { GuideEditor } from '@/components/admin/blog/GuideEditor'
import { NoticeBox } from '@/components/admin/kit/EmptyState'
import { loadEditorData } from '../editorData'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Nowy artykuł' }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

/**
 * Nowy artykuł. Po pierwszym zapisie edytor dopisuje do adresu `?id=…`
 * (bez nawigacji) — przeładowanie strony wczytuje wtedy zapisany szkic.
 */
export default async function NewGuidePage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin()
  const sp = await searchParams
  const id = (Array.isArray(sp.id) ? sp.id[0] : sp.id) ?? ''
  const [doc, data] = await Promise.all([
    /^[A-Za-z0-9._-]{1,128}$/.test(id) ? getGuideForEditor(id).catch(() => null) : Promise.resolve(null),
    loadEditorData(),
  ])
  return (
    <>
      {data.warning && <NoticeBox className="mb-3">{data.warning}</NoticeBox>}
      <GuideEditor initial={doc} categories={data.categories} products={data.products} guides={data.guides} />
    </>
  )
}
