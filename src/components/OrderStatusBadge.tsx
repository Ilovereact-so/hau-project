import { cn } from '@/lib/utils'
import type { OrderStatus } from '@/db/schema'

const LABELS: Record<OrderStatus, string> = {
  pending:          'Oczekujące',
  awaiting_payment: 'Oczekiwanie na płatność',
  paid:             'Opłacone',
  processing:       'W realizacji',
  shipped:          'Wysłane',
  delivered:        'Dostarczone',
  cancelled:        'Anulowane',
  refunded:         'Zwrócone',
}

const STYLES: Record<OrderStatus, string> = {
  pending:          'bg-gray-100 text-gray-600',
  awaiting_payment: 'bg-yellow-100 text-yellow-700',
  paid:             'bg-blue-100 text-blue-700',
  processing:       'bg-purple-100 text-purple-700',
  shipped:          'bg-indigo-100 text-indigo-700',
  delivered:        'bg-green-100 text-green-700',
  cancelled:        'bg-red-100 text-red-600',
  refunded:         'bg-orange-100 text-orange-600',
}

interface Props {
  status: OrderStatus
  className?: string
}

export default function OrderStatusBadge({ status, className }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold',
        STYLES[status],
        className,
      )}
    >
      {LABELS[status]}
    </span>
  )
}
