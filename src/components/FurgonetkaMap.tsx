'use client'

import { useEffect } from 'react'
import { FURGONETKA_ENV } from '@/lib/furgonetkaEnv'

export interface FurgonetkaPoint {
  code:    string
  name:    string
  carrier: string
}

declare global {
  interface Window {
    Furgonetka?: {
      Map: new (config: {
        apiKey:              string
        courierServices?:    string[]
        street?:             string
        city?:               string
        postcode?:           string
        zoom?:               number
        showServiceTypeFilter   ?: boolean
        callback:            (params: { point: { code: string; name: string; type: string; service?: string } }) => void
        closeModalCallback?: () => void
        env?:                'sandbox' | 'production'
      }) => { show: () => void }
    }
  }
}

// Wkompilowywany przy BUDOWANIU (GitHub → Environments → staging). Pusty klucz
// = widżet i tak się otwiera, ale każde zapytanie o punkty dostaje 403
// z api.furgonetka.pl — dlatego wtedy mapy w ogóle nie otwieramy.
const MAP_API_KEY = (process.env.NEXT_PUBLIC_FURGONETKA_MAP_API_KEY ?? '').trim()

export default function FurgonetkaMap() {
  useEffect(() => {
    if (document.getElementById('furgonetka-map-script')) return
    const script = document.createElement('script')
    script.src   = 'https://furgonetka.pl/js/dist/map/map.js'
    script.async = true
    script.id    = 'furgonetka-map-script'
    document.head.appendChild(script)
  }, [])

  return null
}

/**
 * Open the Furgonetka locker map modal imperatively.
 * Zwraca `false`, gdy mapy nie da się otworzyć (brak klucza API) — wtedy
 * wywołujący pokazuje komunikat i odsyła do wyszukiwania po kodzie pocztowym.
 */
export function openFurgonetkaMap(opts: {
  courierServices?: string[]
  location?:        string | undefined
  onSelect:         (point: FurgonetkaPoint) => void
  onClose?:         () => void
}): boolean {
  if (typeof window === 'undefined') return false
  if (!MAP_API_KEY) {
    console.error('Furgonetka: brak NEXT_PUBLIC_FURGONETKA_MAP_API_KEY w buildzie — mapa punktów wyłączona')
    return false
  }

  function tryOpen(attempts = 0) {
    if (!window.Furgonetka) {
      if (attempts >= 25) {
        console.error('Furgonetka: mapa niedostępna — skrypt nie załadował się')
        return
      }
      setTimeout(() => tryOpen(attempts + 1), 300)
      return
    }

    new window.Furgonetka.Map({
      apiKey: MAP_API_KEY,
      zoom:13,
      showServiceTypeFilter : false,
      ...(opts.courierServices?.length ? { courierServices: opts.courierServices } : {}),
      ...(opts.location  ? { street:   opts.location }   : {}),
      callback: ({ point }) => {
        opts.onSelect({ code: point.code, name: point.name, carrier: point.service ?? point.type })
      },
      closeModalCallback: opts.onClose,
      // To samo środowisko co `lib/furgonetka.ts` (NEXT_PUBLIC_FURGONETKA_ENV).
      // Klucz mapy musi pochodzić z tego samego środowiska — klucz
      // z piaskownicy na produkcyjnym API daje 403 na /points/map.
      env: FURGONETKA_ENV,
    }).show()

    // Nadpisanie stylów widżetu (zaokrąglone rogi) — do włączenia po dwóch
    // cyklach rAF, gdy <style> widżetu jest już w DOM:
    // requestAnimationFrame(() => requestAnimationFrame(injectOverride))
  }

  tryOpen()
  return true
}
