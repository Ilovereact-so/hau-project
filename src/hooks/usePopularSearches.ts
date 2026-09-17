'use client'
import { useEffect, useState } from 'react'
import { getProductTitlesPool, PopularProductName } from '@/sanity/helpers/clientRequest'

// Cache na poziomie modułu (nie stanu) — pula i wylosowany podzbiór mają przetrwać
// wielokrotne mounty/unmounty SearchBarContext (portal na mode 1 potrafi się
// remontować) w obrębie tej samej sesji strony, żeby "popularne" nie tasowały się
// na nowo za każdym otwarciem search bara.
let cachedPicks: string[] | null = null
let inflightPromise: Promise<PopularProductName[]> | null = null

function pickRandom<T>(arr: T[], count: number): T[] {
    const copy = [...arr]
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy.slice(0, count)
}

// Fallback na "Popularne" pokazywany zamiast "Ostatnio wyszukiwane", gdy user nie
// ma jeszcze żadnej historii wyszukiwań. Na razie to zwykły losowy podzbiór nazw
// produktów (patrz getProductTitlesPool) — docelowo do podmiany na realną
// popularność (np. licznik kliknięć/wyszukań), ale interfejs hooka (popularTerms)
// zostaje ten sam.
export function usePopularSearches(count = 5) {
    const [popularTerms, setPopularTerms] = useState<string[]>(cachedPicks ?? [])

    useEffect(() => {
        if (cachedPicks) {
            setPopularTerms(cachedPicks)
            return
        }

        let cancelled = false

        const load = async () => {
            if (!inflightPromise) {
                inflightPromise = getProductTitlesPool()
            }
            const pool = await inflightPromise
            const uniqueTitles = Array.from(new Set(pool.map(p => p.title).filter(Boolean)))
            const picks = pickRandom(uniqueTitles, count)
            cachedPicks = picks

            if (!cancelled) setPopularTerms(picks)
        }

        load()
        return () => { cancelled = true }
    }, [count])

    return { popularTerms }
}
