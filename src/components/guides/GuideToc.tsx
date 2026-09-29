'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ListOrdered } from 'lucide-react'
import type { GuideHeading } from '@/lib/guides/content'

/**
 * Spis treści poradnika z podświetleniem bieżącej sekcji.
 *
 * `variant="sidebar"` — przyklejona kolumna obok tekstu (desktop),
 * `variant="inline"` — zwijana ramka nad treścią (telefon, tablet).
 * Nagłówki i ich `id` pochodzą z `guideHeadings` — tej samej funkcji, której
 * używa renderer treści, więc kotwice zawsze pasują.
 */
export default function GuideToc({ headings, variant }: { headings: GuideHeading[]; variant: 'sidebar' | 'inline' }) {
  const items = useMemo(() => headings.filter((heading) => heading.level <= 3), [headings])
  const [active, setActive] = useState<string | null>(items[0]?.id ?? null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (variant !== 'sidebar' || items.length < 2) return
    const elements = items
      .map((item) => document.getElementById(item.id))
      .filter((element): element is HTMLElement => Boolean(element))
    if (!elements.length) return
    // Aktywna = ostatnia sekcja, której nagłówek minął górną część ekranu.
    const observer = new IntersectionObserver(
      () => {
        const offset = 140
        let current = elements[0].id
        for (const element of elements) {
          if (element.getBoundingClientRect().top - offset <= 0) current = element.id
        }
        setActive(current)
      },
      { rootMargin: '-120px 0px -60% 0px', threshold: [0, 1] },
    )
    elements.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [items, variant])

  if (items.length < 2) return null

  const list = (
    <ol className="m-0 list-none space-y-1 p-0">
      {items.map((item) => (
        <li key={item.key} className={item.level === 3 ? 'pl-4' : ''}>
          <a
            href={`#${item.id}`}
            onClick={() => setOpen(false)}
            className={`block rounded-[14px] px-4 py-2 font-poppins text-[14px] leading-snug no-underline transition-colors ${
              active === item.id && variant === 'sidebar'
                ? 'bg-[#EDEDED] text-black'
                : 'text-[#5A5A5A] hover:bg-[#F4F4F4] hover:text-[#20201F]'
            }`}
          >
            {item.text}
          </a>
        </li>
      ))}
    </ol>
  )

  if (variant === 'sidebar') {
    return (
      <nav aria-label="Spis treści" className="sticky top-17">
        <p className="m-0 mb-3 flex items-center gap-2 px-3 font-poppins text-[12px] font-semibold uppercase tracking-[0.08em] text-fancy-black">
          <ListOrdered className="size-4" />
          W tym artykule
        </p>
        {list}
      </nav>
    )
  }

  return (
    <nav aria-label="Spis treści" className="rounded-[18px] border border-[#E6E6E6] bg-[#FAFAFA]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 font-poppins text-[15px] font-medium text-[#20201F]"
      >
        <span className="flex items-center gap-2">
          <ListOrdered className="size-4 text-[#5E9E94]" />
          Spis treści
          <span className="text-[13px] font-normal text-[#8A8A8A]">({items.length})</span>
        </span>
        <ChevronDown className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="border-t border-[#E6E6E6] px-1 py-2">{list}</div>}
    </nav>
  )
}
