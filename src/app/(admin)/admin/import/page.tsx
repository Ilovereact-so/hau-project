import type { Metadata } from 'next'
import { History } from 'lucide-react'
import { adminGetImportJobs } from '@/actions/adminExport'
import { Badge } from '@/components/admin/kit/Badge'
import { Card, CardHeader } from '@/components/admin/kit/Card'
import { DataTable, Td, Th, Tr } from '@/components/admin/kit/DataTable'
import { ErrorBox } from '@/components/admin/kit/EmptyState'
import { formatDateTime } from '@/components/admin/kit/format'
import { ImportWizard } from '@/components/admin/import/ImportWizard'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Import CSV' }

export default async function AdminImportPage() {
  let jobs: Awaited<ReturnType<typeof adminGetImportJobs>> = []
  let error = ''
  try {
    jobs = await adminGetImportJobs(20)
  } catch (reason) {
    error = `Nie udało się pobrać historii importów: ${(reason as Error).message}`
  }

  return (
    <section className="flex flex-col gap-4 animate-fade-in">
      <ImportWizard />

      <Card className="flex flex-col">
        <CardHeader icon={History} title="Historia importów" subtitle="Ostatnie 20 uruchomień (tabela import_jobs)." />
        <div className="px-4 pt-3 pb-4">
          {error && <ErrorBox className="mb-3">{error}</ErrorBox>}
          {jobs.length ? (
            <DataTable>
              <thead>
                <tr>
                  <Th>Pliki</Th>
                  <Th>Data</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Wierszy</Th>
                  <Th className="text-right">OK</Th>
                  <Th className="text-right">Problemy</Th>
                  <Th>Skuteczność</Th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const pct = job.totalRows ? Math.min(100, Math.round((job.okRows / job.totalRows) * 100)) : 0
                  return (
                    <Tr key={job.id}>
                      <Td className="max-w-[320px] truncate font-medium">{job.fileName || '—'}</Td>
                      <Td className="whitespace-nowrap text-text-2">{formatDateTime(job.createdAt)}</Td>
                      <Td>
                        <Badge tone={job.status === 'done' ? 'success' : job.status === 'failed' ? 'danger' : 'primary'}>
                          {job.status === 'done' ? 'Zakończony' : job.status === 'failed' ? 'Nieudany' : 'W toku'}
                        </Badge>
                      </Td>
                      <Td className="text-right">{job.totalRows}</Td>
                      <Td className="text-right text-success">{job.okRows}</Td>
                      <Td className="text-right text-danger">{job.failedRows}</Td>
                      <Td>
                        <span className="flex items-center gap-2">
                          <span className="h-1.5 w-20 overflow-hidden rounded-full bg-track">
                            <span className="block h-full rounded-full bg-success" style={{ width: `${pct}%` }} />
                          </span>
                          <span className="text-[11px] text-text-2">{pct}%</span>
                        </span>
                      </Td>
                    </Tr>
                  )
                })}
              </tbody>
            </DataTable>
          ) : !error ? (
            <p className="m-0 text-xs text-text-2">Brak historii — żaden import jeszcze nie został uruchomiony.</p>
          ) : null}
        </div>
      </Card>
    </section>
  )
}
