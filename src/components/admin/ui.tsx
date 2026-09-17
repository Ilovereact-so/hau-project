/*
 * Zgodność wstecz: dawne helpery panelu. Nowy kod importuje bezpośrednio
 * z `@/components/admin/kit`.
 */
import { formatCentsPrecise, formatDateTime, orderNumber } from './kit/format'

export { EmptyState as Empty } from './kit/EmptyState'
export { Card as Panel } from './kit/Card'
export { StatCard as KpiCard } from './kit/StatCard'

/** Grosze → „1 234,50 zł”. */
export const zl = (cents: number) => formatCentsPrecise(cents)
export const fmtDate = formatDateTime
export const shortId = orderNumber
