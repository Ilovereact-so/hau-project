'use client'

import React, { useEffect, useRef } from 'react'

/**
 * Poziomy rząd pigułek, który po wejściu na stronę przewija się tak, żeby
 * aktywny dokument (`aria-current="page"`) był widoczny — inaczej na telefonie
 * np. „Regulamin” stał za krawędzią ekranu. Przewijamy sam rząd (scrollLeft),
 * a nie stronę, więc nic nie skacze w pionie.
 */
export default function HelpChipScroller({ className, children }: { className?: string; children: React.ReactNode }) {
    const ref = useRef<HTMLUListElement>(null)

    useEffect(() => {
        const list = ref.current
        const active = list?.querySelector<HTMLElement>('[aria-current="page"]')
        if (!list || !active) return
        const item = active.closest('li') ?? active
        const target = item.offsetLeft - (list.clientWidth - item.offsetWidth) / 2
        list.scrollLeft = Math.max(0, target)
    }, [])

    return (
        <ul ref={ref} className={className}>
            {children}
        </ul>
    )
}
