import { redirect } from 'next/navigation'

interface Props {
  params:       Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

// Szczegóły zamówienia przeniesione do /profile/orders/[id]. Zachowujemy
// parametry zapytania (np. ?payment=success po powrocie z bramki płatności).
export default async function OrderDetailRedirect({ params, searchParams }: Props) {
  const { id } = await params
  const search = await searchParams

  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(search)) {
    if (typeof value === 'string') query.set(key, value)
    else if (Array.isArray(value) && value[0]) query.set(key, value[0])
  }

  const suffix = query.toString()
  redirect(`/profile/orders/${id}${suffix ? `?${suffix}` : ''}`)
}
