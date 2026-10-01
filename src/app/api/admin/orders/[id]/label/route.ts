import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { shipments } from '@/db/schema'
import { adminDenied, errorMessage } from '@/lib/admin/guard'
import { LabelNotReadyError, getShipmentLabel } from '@/lib/furgonetka'

/*
 * Etykieta przesyłki z Furgonetki. API zwraca PLIK (PDF albo ZPL/EPL jako
 * tekst), a nie JSON z adresem — dlatego pobieramy go serwerem (token API
 * nie może trafić do przeglądarki) i oddajemy wprost do otwarcia w karcie.
 */

export const dynamic = 'force-dynamic'

function errorPage(message: string, status: number) {
  return new NextResponse(message, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await adminDenied()
  if (denied) return errorPage('Brak uprawnień — zaloguj się jako admin.', denied.status)

  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return errorPage('Nieprawidłowy numer zamówienia.', 400)

  const [shipment] = await db
    .select({ furgonetkaId: shipments.furgonetkaId, trackingNumber: shipments.trackingNumber })
    .from(shipments)
    .where(eq(shipments.orderId, id))
  if (!shipment) return errorPage('Zamówienie nie ma przesyłki.', 404)
  if (!shipment.furgonetkaId) return errorPage('Przesyłka nadana poza Furgonetką — etykieta jest u przewoźnika.', 404)

  try {
    const label = await getShipmentLabel(shipment.furgonetkaId)
    const pdf = label.contentType.includes('pdf')
    const name = `etykieta-${shipment.trackingNumber || shipment.furgonetkaId}.${pdf ? 'pdf' : 'txt'}`
    return new NextResponse(label.data, {
      headers: {
        'Content-Type': label.contentType,
        'Content-Disposition': `${pdf ? 'inline' : 'attachment'}; filename="${name.replace(/[^\w.-]/g, '_')}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (err) {
    if (err instanceof LabelNotReadyError) return errorPage(err.message, 409)
    console.error('[furgonetka] etykieta', err)
    return errorPage(errorMessage(err, 'Nie udało się pobrać etykiety z Furgonetki.'), 502)
  }
}
