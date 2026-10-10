import { NextResponse } from 'next/server'
import { getShopSettings } from '@/lib/shopSettings.server'

/** Publiczne ustawienia koszyka (próg darmowej dostawy, najtańsza dostawa). */
export const revalidate = 60

export async function GET() {
  const settings = await getShopSettings()
  return NextResponse.json(settings, {
    headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' },
  })
}
