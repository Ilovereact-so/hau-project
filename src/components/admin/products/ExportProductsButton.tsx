'use client'

import { useTransition } from 'react'
import toast from 'react-hot-toast'
import { FileDown } from 'lucide-react'
import { adminExportProductsCsv } from '@/actions/adminProducts'
import { downloadCsv } from '../ExportOrdersCsv'
import { Button } from '../kit/Button'

/**
 * Eksport całego katalogu do CSV w formacie importu — plik można poprawić
 * (np. w Excelu) i wgrać z powrotem w „Import CSV”; produkty są rozpoznawane po SKU.
 */
export function ExportProductsButton({ variant = 'secondary' }: { variant?: 'secondary' | 'ghost' }) {
  const [pending, startTransition] = useTransition()
  const run = () =>
    startTransition(async () => {
      const result = await adminExportProductsCsv()
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      downloadCsv(result.data.csv, result.data.fileName)
      toast.success(`Wyeksportowano ${result.data.count} produktów`)
    })
  return (
    <Button
      size="sm"
      variant={variant}
      onClick={run}
      disabled={pending}
      title="Plik w formacie importu: popraw go i wgraj z powrotem w „Import CSV” (produkty rozpoznawane po SKU)."
    >
      <FileDown size={14} strokeWidth={1.5} />
      {pending ? 'Eksportuję…' : 'Eksport CSV'}
    </Button>
  )
}
