import { cn } from './utils'

export type BadgeTone = 'primary' | 'info' | 'purple' | 'success' | 'danger' | 'neutral'

const TONES: Record<BadgeTone, string> = {
  primary: 'text-primary bg-primary/10',
  info: 'text-info bg-info/10',
  purple: 'text-purple bg-purple/10',
  success: 'text-success bg-success/10',
  danger: 'text-danger bg-danger/10',
  neutral: 'text-text-2 bg-surface-muted',
}

const DOTS: Record<BadgeTone, string> = {
  primary: 'bg-primary',
  info: 'bg-info',
  purple: 'bg-purple',
  success: 'bg-success',
  danger: 'bg-danger',
  neutral: 'bg-muted',
}

const ROTATION: BadgeTone[] = ['primary', 'info', 'purple', 'success']

export function Badge({
  tone,
  variant,
  className,
  children,
}: {
  tone?: BadgeTone
  /** Numer wariantu rotuje po palecie akcentów. */
  variant?: number
  className?: string
  children: React.ReactNode
}) {
  const resolved: BadgeTone = tone ?? (variant === undefined ? 'neutral' : ROTATION[variant % ROTATION.length])

  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold',
        TONES[resolved],
        className
      )}
    >
      {children}
    </span>
  )
}

/** Kropka statusu przy nazwie w tabeli. */
export function Dot({ tone = 'neutral' }: { tone?: BadgeTone }) {
  return <i className={cn('inline-block size-1.5 shrink-0 rounded-full', DOTS[tone])} aria-hidden />
}

/*
 * Tony statusów HAU — dopasowanie po CAŁEJ wartości z zamkniętej listy
 * (enumy z src/db/schema.ts), nie po fragmentach słów: w meblove
 * „not_paid” łapało się na „paid” i dostawało zielony znacznik.
 */
export const ORDER_STATUS_TONES: Record<string, BadgeTone> = {
  pending: 'neutral',
  awaiting_payment: 'primary',
  paid: 'info',
  processing: 'purple',
  shipped: 'info',
  delivered: 'success',
  cancelled: 'danger',
  refunded: 'danger',
}

export const PAYMENT_TX_TONES: Record<string, BadgeTone> = {
  pending: 'primary',
  success: 'success',
  failed: 'danger',
  expired: 'neutral',
  refunded: 'purple',
}

export const SHIPMENT_TONES: Record<string, BadgeTone> = {
  created: 'neutral',
  picked_up: 'info',
  in_transit: 'info',
  out_for_delivery: 'purple',
  delivered: 'success',
  failed: 'danger',
  returned: 'danger',
}

export const PUBLISH_TONES: Record<string, BadgeTone> = {
  published: 'success',
  changed: 'info',
  draft: 'primary',
}

export function toneFor(map: Record<string, BadgeTone>, value: string | null | undefined): BadgeTone {
  return (value && map[value]) || 'neutral'
}
