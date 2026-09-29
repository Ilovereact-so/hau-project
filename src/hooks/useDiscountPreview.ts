'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import useStore from 'store'
import { previewDiscountCode, type DiscountPreview } from '@/actions/discounts'
import { useDiscountStore } from '@/store/discountStore'

export type DiscountPreviewState =
  | { status: 'idle' }
  | { status: 'loading'; code: string }
  | { status: 'ready'; preview: Extract<DiscountPreview, { ok: true }> }

/*
 * Podgląd zastosowanego kodu dla bieżącej zawartości koszyka. Przelicza się
 * (z opóźnieniem) po każdej zmianie ilości — rabat procentowy i próg wartości
 * zależą od sumy. Gdy serwer odrzuci kod (wygasł, limit), zdejmujemy go
 * i zwracamy komunikat do pokazania.
 */
export function useDiscountPreview(): {
  state: DiscountPreviewState
  /** komunikat, gdy zapisany kod przestał działać */
  droppedMessage: string | null
  clearDropped: () => void
} {
  const code = useDiscountStore(s => s.code)
  const setCode = useDiscountStore(s => s.setCode)
  const cartItems = useStore(s => s.cartItems)
  const [state, setState] = useState<DiscountPreviewState>({ status: 'idle' })
  const [droppedMessage, setDropped] = useState<string | null>(null)
  const seq = useRef(0)

  const items = useMemo(
    () => cartItems.map(i => ({ productId: i.product._id, variantId: i.variant, qty: i.quantity })),
    [cartItems],
  )
  const itemsKey = useMemo(() => JSON.stringify(items), [items])

  useEffect(() => {
    if (!code || !items.length) {
      setState({ status: 'idle' })
      return
    }
    const id = ++seq.current
    setState(prev => (prev.status === 'ready' && prev.preview.code === code ? prev : { status: 'loading', code }))
    const timer = setTimeout(async () => {
      const result = await previewDiscountCode({ code, items })
      if (id !== seq.current) return
      if (result.ok) {
        setState({ status: 'ready', preview: result })
      } else {
        setCode(null)
        setDropped(result.error)
        setState({ status: 'idle' })
      }
    }, 350)
    return () => clearTimeout(timer)
    // itemsKey zamiast items — ta sama zawartość nie wywołuje nowego zapytania
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, itemsKey, setCode])

  return { state, droppedMessage, clearDropped: () => setDropped(null) }
}
