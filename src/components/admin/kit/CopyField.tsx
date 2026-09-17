'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from './utils'

/** Kopiowanie z zapasem na przeglądarki bez `navigator.clipboard` (http, stare Safari). */
export function useCopy() {
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(null), 1800)
    return () => clearTimeout(timer)
  }, [copied])

  const copy = useCallback(async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      const helper = document.createElement('textarea')
      helper.value = value
      helper.setAttribute('readonly', '')
      helper.style.position = 'fixed'
      helper.style.opacity = '0'
      document.body.appendChild(helper)
      helper.select()
      try {
        document.execCommand('copy')
      } finally {
        document.body.removeChild(helper)
      }
    }
    setCopied(key)
  }, [])

  return { copy, copied }
}

/** Pole „tylko do skopiowania”: etykieta, wartość monospace i przycisk kopiowania. */
export function CopyField({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'accent'
}) {
  const { copy, copied } = useCopy()
  const isCopied = copied === value

  return (
    <div className="grid gap-1.5">
      <span className="text-xs font-medium text-text-2">{label}</span>
      <div
        className={cn(
          'flex items-center gap-2 rounded-xs border px-3 py-2',
          tone === 'accent' ? 'border-primary/35 bg-primary-soft/50' : 'border-border bg-surface-muted'
        )}
      >
        <code className="min-w-0 flex-1 truncate font-mono text-xs text-text">{value}</code>
        <button
          type="button"
          onClick={() => void copy(value, value)}
          aria-label={`Skopiuj: ${label}`}
          className={cn(
            'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-xs border px-2 text-[11px] font-medium',
            'transition-colors duration-150 ease-(--ease)',
            'focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none',
            isCopied
              ? 'border-success/30 bg-success/10 text-success'
              : 'border-border bg-surface text-text-2 hover:border-border-strong hover:text-text'
          )}
        >
          {isCopied ? <Check size={12} strokeWidth={2} /> : <Copy size={12} strokeWidth={1.5} />}
          {isCopied ? 'Skopiowano' : 'Kopiuj'}
        </button>
      </div>
      {hint && <span className="text-[11px] text-text-2">{hint}</span>}
    </div>
  )
}
