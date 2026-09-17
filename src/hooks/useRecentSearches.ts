'use client'
import { useCallback, useEffect, useState } from 'react'

export type RecentProduct = {
    _id: string
    title: string
    subtitle?: string
    brand?: string
    slug: string
    price: number
    /** Nieużywane (dawna ręczna cena przekreślona) — zostaje dla starych wpisów w localStorage. */
    compareAtPrice?: number
    images?: any
    variantKey?: string
    type?: {
        title: string
        slug: string
    }
}

const TERMS_KEY = 'hau_recent_search_terms'
const PRODUCTS_KEY = 'hau_recent_search_products'
const MAX_TERMS = 5
const MAX_PRODUCTS = 8

function readStorage<T>(key: string): T[] {
    if (typeof window === 'undefined') return []
    try {
        const raw = window.localStorage.getItem(key)
        return raw ? JSON.parse(raw) : []
    } catch {
        return []
    }
}

function writeStorage<T>(key: string, value: T[]) {
    try {
        window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
        // localStorage niedostępny (np. tryb prywatny) — pomijamy zapis
    }
}

export function useRecentSearches() {
    const [recentTerms, setRecentTerms] = useState<string[]>([])
    const [recentProducts, setRecentProducts] = useState<RecentProduct[]>([])

    useEffect(() => {
        setRecentTerms(readStorage<string>(TERMS_KEY))
        setRecentProducts(readStorage<RecentProduct>(PRODUCTS_KEY))
    }, [])

    const addTerm = useCallback((term: string) => {
        const trimmed = term.trim()
        if (trimmed.length < 2) return

        setRecentTerms(prev => {
            const next = [trimmed, ...prev.filter(t => t.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_TERMS)
            writeStorage(TERMS_KEY, next)
            return next
        })
    }, [])

    const removeTerm = useCallback((term: string) => {
        setRecentTerms(prev => {
            const next = prev.filter(t => t !== term)
            writeStorage(TERMS_KEY, next)
            return next
        })
    }, [])

    const addProduct = useCallback((product: RecentProduct) => {
        setRecentProducts(prev => {
            const next = [product, ...prev.filter(p => p._id !== product._id)].slice(0, MAX_PRODUCTS)
            writeStorage(PRODUCTS_KEY, next)
            return next
        })
    }, [])

    const clearAll = useCallback(() => {
        setRecentTerms([])
        setRecentProducts([])
        writeStorage(TERMS_KEY, [])
        writeStorage(PRODUCTS_KEY, [])
    }, [])

    return { recentTerms, recentProducts, addTerm, removeTerm, addProduct, clearAll }
}
