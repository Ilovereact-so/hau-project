'use client'

import * as React from 'react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from './utils'

/**
 * Tło okna modalnego (Escape zamyka). Renderowane portalem do elementu
 * `.hau-admin`, żeby modal dziedziczył tokeny motywu — a nie do `body`,
 * gdzie zmienne `--adm-*` nie istnieją.
 */
export function ModalBackdrop({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [onClose])

  const host = typeof document !== 'undefined' ? document.querySelector('.hau-admin') : null
  const node = (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[#0F172A]/35 p-4 backdrop-blur-sm animate-fade-in"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      role="presentation"
    >
      {children}
    </div>
  )
  return host ? createPortal(node, host) : node
}

/** Standardowe okno: nagłówek, treść, stopka z akcjami. */
export function Modal({
  title,
  subtitle,
  onClose,
  footer,
  width = 'w-[min(520px,100%)]',
  children,
  as = 'div',
  onSubmit,
}: {
  title: string
  subtitle?: React.ReactNode
  onClose: () => void
  footer?: React.ReactNode
  width?: string
  children: React.ReactNode
  as?: 'div' | 'form'
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void
}) {
  const Tag = as as 'form'
  return (
    <ModalBackdrop onClose={onClose}>
      <Tag
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onSubmit={as === 'form' ? onSubmit : undefined}
        className={cn(
          'flex max-h-[90vh] flex-col gap-4 overflow-auto rounded-xl border border-border bg-surface p-6 shadow-2 animate-fade-up',
          width
        )}
      >
        <div>
          <h2 className="m-0 text-sm font-semibold tracking-tight text-text">{title}</h2>
          {subtitle && <p className="mt-1 mb-0 text-xs leading-[1.5] text-text-2">{subtitle}</p>}
        </div>
        {children}
        {footer && <div className="flex flex-wrap justify-end gap-2.5">{footer}</div>}
      </Tag>
    </ModalBackdrop>
  )
}
