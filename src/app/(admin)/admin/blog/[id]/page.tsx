import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/guard'
import { getGuideForEditor } from '@/lib/admin/guides'
import { GuideEditor } from '@/components/admin/blog/GuideEditor'
import { NoticeBox } from '@/components/admin/kit/EmptyState'
import { loadEditorData } from '../editorData'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Edycja artykułu' }

type Params = Promise<{ id: string }>

export default async function EditGuidePage({ params }: { params: Params }) {
  await requireAdmin()
  const { id } = await params
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(id)) notFound()
  const [doc, data] = await Promise.all([getGuideForEditor(id), loadEditorData()])
  if (!doc) notFound()
  return (
    <>
      {data.warning && <NoticeBox className="mb-3">{data.warning}</NoticeBox>}
      {/* key = id: przejście między artykułami (np. po „Duplikuj”) montuje edytor od nowa. */}
      <GuideEditor key={doc.id} initial={doc} categories={data.categories} products={data.products} guides={data.guides} />
    </>
  )
}
