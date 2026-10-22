import { NextRequest, NextResponse } from 'next/server'
import { furgonetkaFetch } from '@/lib/furgonetka'

interface PointItem {
  code:     string
  name:     string
  type?:    string
  service?: string
  address:  { street: string; city: string; post_code: string }
}

type PointsApiResponse = {
  items?:  PointItem[]
  data?:   PointItem[]
  points?: PointItem[]
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q        = (searchParams.get('q')?.trim() ?? '').slice(0, 80)
  // Trasa jest publiczna — każda usługa to osobne żądanie do Furgonetki,
  // więc ograniczamy ich liczbę i format (bez tego jedno wywołanie mogło
  // wygenerować setki zapytań na naszym tokenie API).
  const services = [...new Set(
    (searchParams.get('services')?.split(',') ?? [])
      .map(s => s.trim())
      .filter(s => /^[a-z0-9_-]{1,32}$/i.test(s)),
  )].slice(0, 6)

  if (!q) return NextResponse.json({ points: [] })

  const isPostalCode = /^\d{2}-?\d{3}$/.test(q)

  const results: Array<{
    code:    string
    name:    string
    service: string
    address: { street: string; city: string; post_code: string }
  }> = []

  const fetchForService = async (service: string) => {
    const params = new URLSearchParams({ country_code: 'PL' })
    if (service) params.set('service', service)
    if (isPostalCode) {
      params.set('post_code', q.replace('-', ''))
    } else {
      params.set('city', q)
    }

    try {
      const data = await furgonetkaFetch<PointsApiResponse>(`/v2/points?${params}`)
      const items = data.items ?? data.data ?? data.points ?? []
      for (const item of items) {
        results.push({
          code:    item.code,
          name:    item.name,
          service: item.service ?? item.type ?? service,
          address: item.address,
        })
      }
    } catch {
      // silently skip — endpoint may differ per environment
    }
  }

  if (services.length > 0) {
    await Promise.all(services.map(fetchForService))
  } else {
    await fetchForService('')
  }

  return NextResponse.json({ points: results })
}
