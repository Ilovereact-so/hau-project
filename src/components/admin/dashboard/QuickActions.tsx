'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight, ChevronRight, Megaphone, PackageOpen, Search, ShoppingBag, Truck, WalletCards,
} from 'lucide-react'
import { Button } from '../kit/Button'

const SHORTCUTS = [
  { icon: ShoppingBag, label: 'Zamówienia', href: '/admin/orders', color: 'text-primary' },
  { icon: PackageOpen, label: 'Produkty', href: '/admin/products', color: 'text-info' },
  { icon: WalletCards, label: 'Płatności', href: '/admin/payments', color: 'text-purple' },
  { icon: Megaphone, label: 'Marketing', href: '/admin/marketing', color: 'text-pink' },
  { icon: Truck, label: 'Dostawy', href: '/admin/shipping', color: 'text-success' },
]

const TARGETS = [
  { value: '/admin/orders?status=paid', label: 'Zamówienia — do wysyłki' },
  { value: '/admin/orders', label: 'Zamówienia — wszystkie' },
  { value: '/admin/products', label: 'Produkty — katalog i publikacja' },
  { value: '/admin/products?filter=low', label: 'Magazyn — niski stan' },
  { value: '/admin/categories', label: 'Kategorie — nazwy i zdjęcia' },
  { value: '/admin/import', label: 'Import CSV — nowe produkty' },
  { value: '/admin/orders/export', label: 'Eksport zamówień — księgowość' },
]

/** Odpowiednik „Quick Review” z referencji: wybór modułu, skróty ikonowe i para przycisków. */
export function QuickActions({ recentLabel, recentHref }: { recentLabel: string; recentHref: string }) {
  const router = useRouter()
  const [target, setTarget] = useState(TARGETS[0].value)

  return (
    <div className="flex flex-1 flex-col px-4 pb-4">
      <label className="relative mt-3 flex h-10 items-center gap-2 rounded-xs border border-border bg-surface px-3 focus-within:ring-2 focus-within:ring-primary/25">
        <Search size={15} strokeWidth={1.5} className="shrink-0 text-muted" />
        <select
          aria-label="Wybierz moduł"
          className="pill min-w-0 flex-1 cursor-pointer bg-transparent text-xs text-text outline-none"
          value={target}
          onChange={(event) => setTarget(event.target.value)}
        >
          {TARGETS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <p className="mt-2 mb-0 truncate text-[11px] text-text-2">
        Ostatnio:{' '}
        <Link href={recentHref} className="font-medium text-text hover:underline">
          {recentLabel}
        </Link>
      </p>

      <div className="mt-4 flex items-center gap-2">
        {SHORTCUTS.map((shortcut) => {
          const Icon = shortcut.icon
          return (
            <Link
              key={shortcut.label}
              href={shortcut.href}
              title={shortcut.label}
              aria-label={shortcut.label}
              className="grid size-9 place-items-center rounded-xs border border-border bg-surface transition-colors duration-150 ease-(--ease) hover:border-border-strong hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
            >
              <Icon size={16} strokeWidth={1.5} className={shortcut.color} />
            </Link>
          )
        })}
        <span className="grid size-9 place-items-center text-muted" aria-hidden>
          <ChevronRight size={16} strokeWidth={1.5} />
        </span>
      </div>

      <div className="mt-auto flex gap-2 pt-5">
        <Button variant="secondary" className="flex-1" onClick={() => router.push('/admin/products')}>
          Katalog
        </Button>
        <Button className="flex-1" onClick={() => router.push(target)}>
          Otwórz <ArrowRight size={15} strokeWidth={1.8} />
        </Button>
      </div>
    </div>
  )
}
