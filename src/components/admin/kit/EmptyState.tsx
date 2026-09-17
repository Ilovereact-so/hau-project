import * as React from 'react'
import { AlertCircle } from 'lucide-react'
import { cn } from './utils'

export function EmptyState({
  icon,
  title,
  children,
  className,
}: {
  icon: React.ReactNode
  title: string
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex min-h-[260px] flex-col items-center justify-center gap-3 rounded-md border border-border bg-surface p-8 text-center shadow-1',
        className
      )}
    >
      <span className="grid size-11 place-items-center rounded-md border border-border bg-surface-muted text-muted">
        {icon}
      </span>
      <h2 className="m-0 text-sm font-semibold tracking-tight text-text">{title}</h2>
      {children && <p className="m-0 max-w-[46ch] text-xs text-text-2">{children}</p>}
    </div>
  )
}

export function EmptyNote({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('m-0 text-xs text-text-2', className)}>{children}</p>
}

export function ErrorBox({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-2 rounded-xs border border-danger/30 bg-danger/10 px-3 py-2 text-[11px] font-medium text-danger',
        className
      )}
    >
      <AlertCircle size={14} strokeWidth={1.5} className="mt-px shrink-0" />
      <span>{children}</span>
    </div>
  )
}

export function NoticeBox({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      role="status"
      className={cn('rounded-xs border border-border bg-surface-muted px-3 py-2 text-xs text-text-2', className)}
    >
      {children}
    </div>
  )
}
