'use client'

import { useEffect, useRef } from 'react'
import Script from 'next/script'

export interface FurgonetkaPoint {
  code:    string
  name:    string
  carrier: string
}

interface Props {
  /** Furgonetka map widget API key */
  apiKey: string
  /** Limit shown carriers to one service, e.g. ['inpost'] */
  courierServices?: string[]
  /** Called once the user picks a point */
  onSelect: (point: FurgonetkaPoint) => void
  /** Called when the modal closes without selection */
  onClose?: () => void
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

export default function FurgonetkaMap({ apiKey, courierServices, onSelect, onClose }: Props) {
  // keep stable refs so the script callback always sees the latest props
  const onSelectRef = useRef(onSelect)
  const onCloseRef  = useRef(onClose)

  useEffect(() => { onSelectRef.current = onSelect }, [onSelect])
  useEffect(() => { onCloseRef.current  = onClose  }, [onClose])

  return (
    <Script
      src="https://furgonetka.pl/js/dist/map/map.js"
      strategy="lazyOnload"
      id="furgonetka-map-script"
    />
  )
}

/** Call this imperatively to open the map modal */
export function openFurgonetkaMap(opts: {
  courierServices?: string[]
  onSelect:         (point: FurgonetkaPoint) => void
  onClose?:         () => void
}) {
  if (typeof window === 'undefined' || !window.Furgonetka) {
    console.warn('Furgonetka map script not yet loaded')
    return
  }

  new window.Furgonetka.Map({
    apiKey:  MAP_API_KEY,
    ...(opts.courierServices ? { courierServices: opts.courierServices } : {}),
    callback: ({ point }) => {
      opts.onSelect({ code: point.code, name: point.name, carrier: point.type })
    },
    closeModalCallback: opts.onClose,
    env: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
  }).show()
}
