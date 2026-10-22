import { NextRequest, NextResponse } from 'next/server'
import { FURGONETKA_API_URL } from '@/lib/furgonetkaEnv'
import { formatPostcodeQuery, normalizeServiceCode, sortedByDistance, type PickupCandidate } from '@/lib/pickupPoints'

/*
 * Wyszukiwarka punktów odbioru w kasie (kod pocztowy / miejscowość / adres).
 *
 * Środowisko API = to samo co mapa i reszta integracji (NEXT_PUBLIC_FURGONETKA_ENV,
 * lib/furgonetkaEnv.ts). Wcześniej wynikało z NODE_ENV, więc staging (build
 * produkcyjny z kluczem z piaskownicy) pytał produkcyjne API i dostawał 403.
 *
 * Zwracamy do 50 punktów od najbliższego — kasa pokazuje z nich 3 najbliższe
 * KAŻDEGO przewoźnika (lib/pickupPoints.ts → nearestByCarrier).
 */

type RawPoint = {
  code: string
  name: string
  service: string
  type?: string | null
  point_type?: string | null
  distance?: number
  address?: {
    street?: string
    city?: string
    postcode?: string
    country_code?: string
  }
}

export async function GET(req: NextRequest) {
  const query = formatPostcodeQuery(req.nextUrl.searchParams.get('query')?.slice(0, 120) ?? '')
  const services = [...new Set(req.nextUrl.searchParams.getAll('services').map(normalizeServiceCode).filter(Boolean))]
  const limitParam = Number(req.nextUrl.searchParams.get('limit') ?? '50')
  const limit = Number.isFinite(limitParam) ? Math.max(5, Math.min(50, limitParam)) : 50

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
    const response = await fetch(`${FURGONETKA_API_URL}/points/map`, {
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
    const points: PickupCandidate[] = sortedByDistance(
      (payload.points ?? [])
        .filter((point) => point?.code)
        .map((point) => ({
          code: point.code,
          name: point.name,
          carrier: point.service,
          type: point.type ?? point.point_type ?? null,
          distance: typeof point.distance === 'number' && Number.isFinite(point.distance) ? point.distance : null,
          street: point.address?.street ?? '',
          city: point.address?.city ?? '',
          postcode: point.address?.postcode ?? '',
        })),
    )

    return NextResponse.json({ points })
  } catch (err) {
    return NextResponse.json(
      { error: 'Wystąpił błąd podczas wyszukiwania punktów', details: String(err) },
      { status: 500 },
    )
  }
}
