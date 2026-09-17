import type { Metadata } from 'next'
import Link from 'next/link'
import { UsersRound } from 'lucide-react'
import { getAdminCustomers } from '@/lib/admin/ordersQueries'
import { Badge } from '@/components/admin/kit/Badge'
import { Card, CardHeader } from '@/components/admin/kit/Card'
import { DataTable, Td, Th, Tr } from '@/components/admin/kit/DataTable'
import { EmptyState, ErrorBox } from '@/components/admin/kit/EmptyState'
import { formatCentsPrecise, formatDate } from '@/components/admin/kit/format'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Klienci' }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function AdminCustomersPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const q = ((Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? '').trim()

  let customers: Awaited<ReturnType<typeof getAdminCustomers>> = []
  let error = ''
  try {
    customers = await getAdminCustomers({ q, limit: 200 })
  } catch (reason) {
    error = `Nie udało się pobrać klientów: ${(reason as Error).message}`
  }

  const registered = customers.filter((customer) => !customer.isGuest).length
  const ltv = customers.reduce((sum, customer) => sum + customer.ltvCents, 0)

  return (
    <section className="flex flex-col gap-4 animate-fade-in">
      <Card className="flex flex-col">
        <CardHeader
          icon={UsersRound}
          title="Klienci"
          subtitle={`${customers.length} klientów (${registered} z kontem) · łączna wartość opłaconych zamówień ${formatCentsPrecise(ltv)}. Dane z adresu ostatniego zamówienia.`}
        />
        <div className="px-4 pt-3 pb-4">
          {error && <ErrorBox className="mb-3">{error}</ErrorBox>}
          {q && (
            <p className="mt-0 mb-3 text-xs text-text-2">
              Wyniki dla „<b className="text-text">{q}</b>” — imię i nazwisko, e-mail, telefon lub ID konta.{' '}
              <Link href="/admin/customers" className="font-medium hover:underline">Wyczyść</Link>
            </p>
          )}
          {customers.length ? (
            <DataTable>
              <thead>
                <tr>
                  <Th>Klient</Th>
                  <Th>Kontakt</Th>
                  <Th>Konto</Th>
                  <Th className="text-right">Zamówienia</Th>
                  <Th className="text-right">Wartość (opłacone)</Th>
                  <Th>Ostatnie zamówienie</Th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <Tr key={customer.userId}>
                    <Td className="max-w-[240px]">
                      <Link href={`/admin/orders?q=${encodeURIComponent(customer.userId)}`} className="block truncate font-medium text-text hover:underline">
                        {customer.name || customer.email || 'Klient'}
                      </Link>
                      <span className="block truncate text-[11px] text-text-2">{customer.city || '—'}</span>
                    </Td>
                    <Td className="max-w-[240px]">
                      {customer.email ? (
                        <a href={`mailto:${customer.email}`} className="block truncate text-text hover:underline">{customer.email}</a>
                      ) : (
                        <span className="text-text-2">—</span>
                      )}
                      <span className="block truncate text-[11px] text-text-2">{customer.phone || ''}</span>
                    </Td>
                    <Td>
                      <Badge tone={customer.isGuest ? 'neutral' : 'info'}>{customer.isGuest ? 'Gość' : 'Konto'}</Badge>
                    </Td>
                    <Td className="text-right">
                      {customer.ordersCount}
                      {customer.paidOrders !== customer.ordersCount && (
                        <span className="block text-[11px] text-text-2">{customer.paidOrders} skutecznych</span>
                      )}
                    </Td>
                    <Td className="text-right font-medium whitespace-nowrap">{formatCentsPrecise(customer.ltvCents)}</Td>
                    <Td className="whitespace-nowrap text-text-2">{formatDate(customer.lastOrder)}</Td>
                  </Tr>
                ))}
              </tbody>
            </DataTable>
          ) : !error ? (
            <EmptyState icon={<UsersRound size={20} strokeWidth={1.5} />} title={q ? 'Brak wyników' : 'Brak klientów'}>
              {q ? 'Żaden klient nie pasuje do wyszukiwania.' : 'Klienci pojawią się tutaj po pierwszych zamówieniach.'}
            </EmptyState>
          ) : null}
        </div>
      </Card>
    </section>
  )
}
