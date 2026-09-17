import { NextRequest, NextResponse } from 'next/server'

const BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://api.furgonetka.pl'
  : 'https://api.sandbox.furgonetka.pl'

function normalizeServiceCode(code: string): string {
  const value = code.trim().toLowerCase()
  if (!value) return value

  // Furgonetka map API expects current provider keys.
  if (value === 'paczkomat') return 'inpost'
  if (value === 'kiosk' || value === 'ruch') return 'orlen'
  if (value === 'placowka') return 'poczta'
  if (value === 'uap') return 'ups'
  if (value === 'parcelshop') return 'dhl'

  return value
}

type RawPoint = {
  code: string
  name: string
  service: string
  distance?: number
  address?: {
    street?: string
    city?: string
    postcode?: string
    country_code?: string
  }
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('query')?.trim() ?? ''
  const services = req.nextUrl.searchParams.getAll('services').map(normalizeServiceCode).filter(Boolean)
  const limitParam = Number(req.nextUrl.searchParams.get('limit') ?? '20')
  const limit = Number.isFinite(limitParam) ? Math.max(5, Math.min(50, limitParam)) : 20

  if (!query) {
    return NextResponse.json({ points: [] })
  }

  const apiKey = process.env.FURGONETKA_MAP_API_KEY ?? process.env.NEXT_PUBLIC_FURGONETKA_MAP_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Brak konfiguracji Furgonetka map API key' },
      { status: 500 },
    )
  }

  try {
    const response = await fetch(`${BASE_URL}/points/map`, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.furgonetka.v1+json',
        'Content-Type': 'application/json',
        'Furgonetka-Map-Api-Key': apiKey,
      },
      body: JSON.stringify({
        location: {
          address: {
            city: '',
            street: '',
            country_code: 'PL',
            postcode: '',
            province: '',
          },
          search_phrase: query,
          coordinates: null,
        },
        filters: {
          point_id: null,
          type: null,
          services,
          map_bounds: null,
          limit,
          point_types: [],
          country_codes: ['PL'],
          show_other_points: true,
        },
        sort: {
          furgonetka_points_priority: true,
        },
      }),
      cache: 'no-store',
    })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      return NextResponse.json(
        {
          error: 'Nie udało się pobrać punktów odbioru',
          status: response.status,
          bodyPreview: text.slice ? text.slice(0, 1000) : undefined,
        },
        { status: 502 },
      )
    }

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType || !contentType.includes('json')) {
      const text = await response.text().catch(() => '')
      return NextResponse.json(
        {
          error: 'Nieoczekiwany typ odpowiedzi z Furgonetka API',
          status: response.status,
          bodyPreview: text.slice ? text.slice(0, 1000) : undefined,
        },
        { status: 502 },
      )
    }

    let payload: { points?: RawPoint[] } = {}
    try {
      payload = await response.json() as { points?: RawPoint[] }
    } catch {
      const text = await response.text().catch(() => '')
      return NextResponse.json(
        {
          error: 'Nie udało się sparsować odpowiedzi z Furgonetka',
          status: response.status,
          bodyPreview: text.slice ? text.slice(0, 1000) : undefined,
        },
        { status: 502 },
      )
    }
    const points = (payload.points ?? []).map(point => ({
      code: point.code,
      name: point.name,
      carrier: point.service,
      distance: point.distance ?? null,
      street: point.address?.street ?? '',
      city: point.address?.city ?? '',
      postcode: point.address?.postcode ?? '',
    }))

    return NextResponse.json({ points })
  } catch (err) {
    return NextResponse.json(
      { error: 'Wystąpił błąd podczas wyszukiwania punktów', details: String(err) },
      { status: 500 },
    )
  }
}
