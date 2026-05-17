'use client'

import { useEffect } from 'react'

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
        callback:            (params: { point: { code: string; name: string; type: string } }) => void
        closeModalCallback?: () => void
        env?:                'sandbox' | 'production'
      }) => { show: () => void }
    }
  }
}

const MAP_API_KEY = process.env.NEXT_PUBLIC_FURGONETKA_MAP_API_KEY!

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

/** Open the Furgonetka locker map modal imperatively */
export function openFurgonetkaMap(opts: {
  courierServices?: string[]
  onSelect:         (point: FurgonetkaPoint) => void
  onClose?:         () => void
}) {
  if (typeof window === 'undefined') return

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
      ...(opts.courierServices?.length ? { courierServices: opts.courierServices } : {}),
      callback: ({ point }) => {
        opts.onSelect({ code: point.code, name: point.name, carrier: point.type })
      },
      closeModalCallback: opts.onClose,
      env: 'sandbox',
    }).show()
  }

  tryOpen()
}
