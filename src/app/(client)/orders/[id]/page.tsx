import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'

interface Props {
  params:       Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * Wspólny adres powrotu z płatności i linków do zamówienia (/orders/[id]).
 * Zalogowany → szczegóły w profilu; gość → strona zamówienia gościa
 * (/zamowienie/[id], dostęp po ciasteczku albo podpisanym linku `?t=`).
 * Parametry zapytania (np. `?payment=success`) przechodzą dalej.
 */
export default async function OrderDetailRedirect({ params, searchParams }: Props) {
  const { id } = await params
  const search = await searchParams
  const { userId } = await auth()

  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(search)) {
    if (typeof value === 'string') query.set(key, value)
    else if (Array.isArray(value) && value[0]) query.set(key, value[0])
  }

  const suffix = query.toString()
  const base = userId ? `/profile/orders/${id}` : `/zamowienie/${id}`
  redirect(`${base}${suffix ? `?${suffix}` : ''}`)
}
