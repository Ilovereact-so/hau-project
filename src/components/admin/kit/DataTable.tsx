import * as React from 'react'
import { cn } from './utils'

export function DataTable({ className, ...props }: React.ComponentPropsWithoutRef<'table'>) {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface shadow-1">
      <div className="overflow-x-auto">
        <table className={cn('min-w-full border-collapse text-xs', className)} {...props} />
      </div>
    </div>
  )
}

export function Th({ className, ...props }: React.ComponentPropsWithoutRef<'th'>) {
  return (
    <th
      className={cn(
        'sticky top-0 z-10 border-b border-r border-border bg-surface-muted last:border-r-0',
        'px-3 py-2.5 text-left text-[11px] font-medium whitespace-nowrap text-text-2',
        className
      )}
      {...props}
    />
  )
}

export function Td({ className, ...props }: React.ComponentPropsWithoutRef<'td'>) {
  return <td className={cn('border-b border-border px-3 py-3 align-middle text-text', className)} {...props} />
}

export function Tr({ className, ...props }: React.ComponentPropsWithoutRef<'tr'>) {
  return (
    <tr
      className={cn('transition-colors duration-150 ease-(--ease) hover:bg-surface-muted/70', className)}
      {...props}
    />
  )
}
