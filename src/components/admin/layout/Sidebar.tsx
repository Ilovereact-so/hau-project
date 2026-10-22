'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ChevronDown, ExternalLink, LogOut, Moon, PanelLeft, Store, UserRound } from 'lucide-react'
import { cn } from '../kit/utils'
import { Brand } from '../kit/Brand'
import { Toggle } from '../kit/Toggle'
import { AdminCounters, NAV_ITEMS, NavItem, isChildActive } from './navigation'

export type AdminUser = {
  name: string
  email: string
  imageUrl: string | null
}

/**
 * Sidebar panelu — 1:1 z meblove (odwrotne zaokrąglenia, rozwijane grupy
 * z prowadnicą, stopka z motywem i wylogowaniem, karta użytkownika),
 * z tą różnicą, że pozycje są prawdziwymi linkami App Routera.
 */
export function Sidebar({
  activeLabel,
  pathname,
  search,
  collapsed,
  onToggleCollapse,
  isDark,
  onToggleTheme,
  onNavigate,
  onLogout,
  user,
  counters,
}: {
  activeLabel: string
  pathname: string
  search: URLSearchParams
  collapsed: boolean
  onToggleCollapse: () => void
  isDark: boolean
  onToggleTheme: () => void
  onNavigate: () => void
  onLogout: () => void
  user: AdminUser
  counters: AdminCounters
}) {
  const [expanded, setExpanded] = useState<string[]>(() => [hasGroup(activeLabel) ? activeLabel : 'Zamówienia'])

  const toggleGroup = (label: string) =>
    setExpanded((current) =>
      current.includes(label) ? current.filter((item) => item !== label) : [...current, label]
    )
  // Klik w nazwę grupy (np. „Produkty”) przechodzi na jej stronę i ROZWIJA
  // listę — nie zwija, bo zwinięcie po kliknięciu w nazwę byłoby zaskoczeniem.
  // Zwija się tylko strzałką.
  const expandGroup = (label: string) =>
    setExpanded((current) => (current.includes(label) ? current : [...current, label]))

  // Wejście w sekcję inną drogą (link z dashboardu, wstecz, adres z paska)
  // też rozwija jej grupę — aktywna pozycja nie może być schowana.
  useEffect(() => {
    if (hasGroup(activeLabel)) expandGroup(activeLabel)
  }, [activeLabel])

  const EDGE_FADE_SIZE = 30
  const maskImage = `linear-gradient(to bottom, transparent 0, black ${EDGE_FADE_SIZE}px, black calc(100% - ${EDGE_FADE_SIZE}px), transparent 100%)`

  return (
    <aside
      className={cn(
        'relative flex h-full min-h-0 flex-col gap-4 border-r border-border bg-surface',
        collapsed ? 'px-2 py-4' : 'p-4'
      )}
    >
      {/* ── Odwrotne zaokrąglenia ───────────────────────────── */}
      <div className="absolute top-0 -right-[30px] hidden h-[30px] w-[30px] overflow-hidden md:block">
        <div className="nav_shadow h-full w-full rounded-tl-[30px] border-t border-l border-border" />
      </div>
      <div className="absolute bottom-0 -right-[30px] hidden h-[30px] w-[30px] scale-y-[-1] overflow-hidden md:block">
        <div className="nav_shadow h-full w-full rounded-tl-[30px] border-t border-l border-border" />
      </div>

      {/* ── Logo + zwijanie ─────────────────────────────────── */}
      <div className={cn('flex', collapsed ? 'flex-col items-center gap-2' : 'items-center justify-between gap-2 pl-2')}>
        <Link href="/admin" onClick={onNavigate} aria-label="Dashboard">
          <Brand compact={collapsed} />
        </Link>
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Rozwiń nawigację' : 'Zwiń nawigację'}
          title={collapsed ? 'Rozwiń nawigację' : 'Zwiń nawigację'}
          className={cn(
            'hidden size-7 shrink-0 place-items-center rounded-xs text-text-2 transition-colors duration-150 ease-(--ease) md:grid',
            'hover:bg-surface-muted hover:text-text',
            'focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none'
          )}
        >
          <PanelLeft size={16} strokeWidth={1.5} className={cn(collapsed && 'rotate-180')} />
        </button>
      </div>

      {/* ── Nawigacja ───────────────────────────────────────── */}
      <nav
        style={{ WebkitMaskImage: maskImage, maskImage }}
        className="-mr-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto py-2 pr-1 md:gap-2"
        aria-label="Nawigacja panelu"
      >
        {NAV_ITEMS.map((item) => (
          <NavRow
            key={item.label}
            item={item}
            collapsed={collapsed}
            active={activeLabel === item.label}
            open={expanded.includes(item.label)}
            onToggleGroup={() => toggleGroup(item.label)}
            onNavigate={() => {
              if (item.children?.length) expandGroup(item.label)
              onNavigate()
            }}
            pathname={pathname}
            search={search}
            badge={item.badgeKey ? counters[item.badgeKey] : 0}
          />
        ))}
      </nav>

      {/* ── Stopka: motyw / sklep / wylogowanie ─────────────── */}
      <div className="flex flex-col gap-0.5">
        <div
          className={cn(
            'flex h-9 items-center rounded-xs px-2.5 text-[14px] font-medium text-text-2',
            collapsed ? 'justify-center px-0' : 'gap-2.5'
          )}
        >
          {collapsed ? (
            <button type="button" onClick={onToggleTheme} aria-label="Ciemny motyw" title="Ciemny motyw" className="grid place-items-center">
              <Moon size={16} strokeWidth={1.5} className={cn('shrink-0', isDark && 'text-primary')} />
            </button>
          ) : (
            <>
              <Moon size={16} strokeWidth={1.5} className="shrink-0" />
              <span className="flex-1 truncate">Ciemny motyw</span>
              <Toggle checked={isDark} onChange={onToggleTheme} label="Ciemny motyw" />
            </>
          )}
        </div>

        <Link href="/" className={footerRowClass(collapsed)} title={collapsed ? 'Wróć do sklepu' : undefined}>
          <Store size={16} strokeWidth={1.5} className="shrink-0" />
          {!collapsed && <span className="flex-1 truncate">Wróć do sklepu</span>}
        </Link>
        <button type="button" onClick={onLogout} className={footerRowClass(collapsed, 'danger')} title={collapsed ? 'Wyloguj się' : undefined}>
          <LogOut size={16} strokeWidth={1.5} className="shrink-0" />
          {!collapsed && <span className="flex-1 truncate">Wyloguj się</span>}
        </button>
      </div>

      {/* ── Karta użytkownika ──────────────────────────────── */}
      <div
        className={cn(
          'flex items-center rounded-md bg-surface-muted text-text shadow-pill shadow-muted',
          collapsed ? 'justify-center p-1.5' : 'gap-2.5 p-2'
        )}
      >
        <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-surface-muted text-text-2">
          {user.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.imageUrl} alt="" className="size-full object-cover" />
          ) : (
            <UserRound size={16} strokeWidth={1.5} />
          )}
        </span>
        {!collapsed && (
          <span className="min-w-0 flex-1">
            <strong className="block truncate text-xs font-semibold text-text">{user.name}</strong>
            <span className="block truncate text-[11px] text-text-2">{user.email || 'Administrator'}</span>
          </span>
        )}
      </div>
    </aside>
  )
}

function hasGroup(label: string) {
  return NAV_ITEMS.some((item) => item.label === label && Boolean(item.children?.length))
}

function footerRowClass(collapsed: boolean, tone: 'default' | 'danger' = 'default') {
  return cn(
    'flex h-9 items-center rounded-xs text-left text-[14px] font-medium text-text-2',
    'transition-colors duration-150 ease-(--ease)',
    'focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none',
    collapsed ? 'justify-center px-0' : 'gap-2.5 px-2.5',
    tone === 'danger' ? 'hover:bg-danger/10 hover:text-danger' : 'hover:bg-surface-muted hover:text-text'
  )
}

function NavRow({
  item,
  collapsed,
  active,
  open,
  onToggleGroup,
  onNavigate,
  pathname,
  search,
  badge,
}: {
  item: NavItem
  collapsed: boolean
  active: boolean
  open: boolean
  onToggleGroup: () => void
  onNavigate: () => void
  pathname: string
  search: URLSearchParams
  badge: number
}) {
  const Icon = item.icon
  const hasChildren = Boolean(item.children?.length)

  return (
    <div className="flex flex-col">
      <Link
        href={item.href}
        title={collapsed ? item.label : undefined}
        onClick={onNavigate}
        target={item.external ? '_blank' : undefined}
        rel={item.external ? 'noopener noreferrer' : undefined}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'group relative flex h-9 items-center rounded-xs text-left text-[13px] font-medium',
          'transition-colors duration-150 ease-(--ease)',
          'focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none',
          collapsed ? 'justify-center px-0' : 'gap-2.5 px-2.5',
          active
            ? 'bg-surface-muted text-text shadow-pill shadow-muted'
            : 'border border-transparent text-text-2 hover:bg-surface-muted hover:text-text'
        )}
      >
        <Icon
          size={16}
          strokeWidth={1.5}
          className={cn('shrink-0', active ? 'text-primary' : 'text-text-2 group-hover:text-text-2')}
        />
        {collapsed && badge > 0 && (
          <span className="absolute top-1 right-1 size-1.5 rounded-full bg-danger" aria-hidden />
        )}
        {!collapsed && (
          <>
            <span className={cn('flex-1 truncate text-[15px]', active ? 'font-semibold' : 'font-medium')}>
              {item.label}
            </span>

            {item.external && <ExternalLink size={12} strokeWidth={1.5} className="shrink-0 text-text-2" />}
            {badge > 0 && (
              <span className="rounded-full bg-danger px-1.5 py-px text-[10px] font-semibold text-white">
                {badge > 9 ? '9+' : badge}
              </span>
            )}
            {hasChildren && (
              <span
                role="button"
                tabIndex={0}
                aria-label={open ? `Zwiń ${item.label}` : `Rozwiń ${item.label}`}
                aria-expanded={open}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  onToggleGroup()
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    event.stopPropagation()
                    onToggleGroup()
                  }
                }}
                className="grid size-4 shrink-0 place-items-center rounded-[4px] text-text-2 transition hover:text-text"
              >
                <ChevronDown
                  size={14}
                  strokeWidth={1.5}
                  className={cn('transition-transform duration-150 ease-(--ease)', open && 'rotate-180')}
                />
              </span>
            )}
          </>
        )}
      </Link>

      {hasChildren && open && !collapsed && (
        <div className="mt-0.5 ml-[18px] flex flex-col border-l border-muted pl-3">
          {item.children!.map((child) => {
            const current = isChildActive(child, pathname, search)
            return (
              <Link
                key={child.label}
                href={child.href}
                onClick={onNavigate}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'relative flex h-8 items-center rounded-xs px-2.5 text-left text-[14px]',
                  'transition-colors duration-150 ease-(--ease) hover:text-text',
                  'focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none',
                  current ? 'font-semibold text-text' : 'text-text-2'
                )}
              >
                <span className="truncate font-medium">{child.label}</span>
                <div className="absolute top-[50%] -left-3 h-px w-3 translate-y-[-50%] bg-muted" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
