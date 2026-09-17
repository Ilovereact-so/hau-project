"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

type PortalProps = {
  children: React.ReactNode
  /** Id kontenera docelowego. Gdy nie istnieje — ląduje w document.body. */
  targetId?: string
}

export function Portal({ children, targetId = "sub-category-container" }: PortalProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  // Fallback na document.body: wcześniej brak elementu o tym id powodował
  // `return null`, czyli CAŁKOWICIE cichy brak drawera z filtrami — dokładnie
  // to działo się na /search, bo ten kontener istniał tylko na stronie
  // subkategorii. Zawartość portalu jest pozycjonowana `fixed` (viewport),
  // a żaden z tych kontenerów nie tworzy własnego containing blocku
  // (brak transform/filter/contain), więc renderowanie w body wygląda
  // identycznie — to bezpieczny fallback, nie kompromis wizualny.
  const portalRoot = document.getElementById(targetId) ?? document.body

  return createPortal(children, portalRoot)
}
