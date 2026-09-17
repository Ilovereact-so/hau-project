'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Bell, Database, Menu, Search, Store } from 'lucide-react'
import { cn } from '../kit/utils'
import { SEARCHABLE_PATHS } from './navigation'

/**
 * Belka nad treścią: tytuł po lewej, akcje i wyszukiwarka po prawej.
 * Wyszukiwarka steruje parametrem `q` w adresie — listy (zamówienia,
 * produkty, klienci, kategorie) filtrują się po nim po stronie serwera.
 */
export function Topbar({
  title,
  subtitle,
  onOpenNav,
  toShip,
}: {
  title: string
  subtitle: string
  onOpenNav: () => void
  toShip: number
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 px-4 pt-5 pb-1 sm:px-5 lg:px-7 lg:pt-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          aria-label="Otwórz nawigację"
          onClick={onOpenNav}
          className="grid size-9 shrink-0 place-items-center rounded-xs border border-border bg-surface text-text-2 transition hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none md:hidden"
        >
          <Menu size={16} strokeWidth={1.5} />
        </button>
        <div className="min-w-0">
          <h1 className="m-0 truncate text-base font-semibold tracking-tight text-text">{title}</h1>
          <p className="mt-1 mb-0 text-xs text-text-2">{subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <IconAction label={toShip ? `Do wysyłki: ${toShip}` : 'Brak zamówień do wysyłki'} href="/admin/orders?status=paid" badge={toShip}>
          <Bell size={16} strokeWidth={1.5} />
        </IconAction>
        <IconAction label="Otwórz sklep" href="/" newTab>
          <Store size={16} strokeWidth={1.5} />
        </IconAction>

        <SearchBox />

        <IconAction label="Sanity Studio" href="/studio" newTab>
          <Database size={16} strokeWidth={1.5} />
        </IconAction>
      </div>
    </header>
  )
}

function SearchBox() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const urlQuery = params.get('q') ?? ''
  const [value, setValue] = useState(urlQuery)
  const typing = useRef(false)

  const searchable = SEARCHABLE_PATHS.find((path) => pathname === path)

  /* Adres zmienił się z zewnątrz (nawigacja, wstecz) — pole za nim nadąża,
     chyba że użytkownik akurat pisze. */
  useEffect(() => {
    if (!typing.current) setValue(urlQuery)
  }, [urlQuery])

  /* Na listach filtrujemy na żywo (z opóźnieniem), bez dokładania wpisów
     do historii przeglądarki. */
  useEffect(() => {
    if (!searchable || !typing.current) return
    const timer = window.setTimeout(() => {
      typing.current = false
      const next = new URLSearchParams(params.toString())
      if (value.trim()) next.set('q', value.trim())
      else next.delete('q')
      next.delete('page')
      router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false })
    }, 350)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const submit = () => {
    typing.current = false
    const q = value.trim()
    const target = searchable ?? '/admin/orders'
    router.push(q ? `${target}?q=${encodeURIComponent(q)}` : target)
  }

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      className={cn(
        'flex h-9 w-40 items-center gap-2 rounded-xs border border-border bg-surface-muted px-3 sm:w-56 xl:w-72',
        'transition focus-within:border-border-strong focus-within:ring-2 focus-within:ring-primary/25'
      )}
    >
      <Search size={15} strokeWidth={1.5} className="shrink-0 text-text-2/80" />
      <input
        type="search"
        value={value}
        onChange={(event) => {
          typing.current = true
          setValue(event.target.value)
        }}
        placeholder={searchable ? 'Szukaj na tej liście…' : 'Szukaj zamówień…'}
        aria-label="Szukaj"
        className="min-w-0 flex-1 bg-transparent text-xs text-text outline-none placeholder:text-text-2/80"
      />
    </form>
  )
}

function IconAction({
  label,
  badge,
  href,
  newTab,
  children,
}: {
  label: string
  badge?: number
  href: string
  newTab?: boolean
  children: ReactNode
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      target={newTab ? '_blank' : undefined}
      rel={newTab ? 'noopener noreferrer' : undefined}
      className={cn(
        'relative grid size-9 place-items-center rounded-xs border border-border bg-surface-muted text-text-2',
        'transition-colors duration-150 ease-(--ease) hover:border-border-strong hover:text-text',
        'focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none'
      )}
    >
      {children}
      {badge ? (
        <span className="absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[9px] font-semibold text-white">
          {badge > 9 ? '9+' : badge}
        </span>
      ) : null}
    </Link>
  )
}
