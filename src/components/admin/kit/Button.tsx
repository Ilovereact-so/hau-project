import * as React from 'react'
import Link from 'next/link'
import { cn } from './utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-text-2 shadow-1',
  secondary: 'bg-surface text-text hover:bg-surface-muted border border-border shadow-pill',
  ghost: 'bg-transparent text-text-2 hover:bg-surface-muted',
  danger: 'bg-transparent text-danger hover:bg-danger/10',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 rounded-xs px-2.5 text-xs',
  md: 'h-10 rounded-sm px-4 text-sm',
}

const BASE =
  'inline-flex items-center justify-center gap-1.5 font-medium whitespace-nowrap' +
  ' transition-colors duration-150 ease-(--ease)' +
  ' focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface' +
  ' disabled:pointer-events-none disabled:opacity-50'

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cn(BASE, SIZES[size], VARIANTS[variant], className)
}

type ButtonProps = React.ComponentPropsWithoutRef<'button'> & { variant?: Variant; size?: Size }

export function Button({ className, variant = 'primary', size = 'md', type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />
}

/** Link wyglądający jak przycisk (nawigacja App Routera). */
export function ButtonLink({
  className,
  variant = 'primary',
  size = 'md',
  ...props
}: React.ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />
}

const ICON_BUTTON =
  'grid size-8 place-items-center rounded-xs border border-border bg-bg text-text-2' +
  ' transition-colors duration-150 ease-(--ease) hover:border-border-strong hover:text-text' +
  ' focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40' +
  ' disabled:pointer-events-none disabled:opacity-50'

/** Kwadratowy przycisk ikonowy (lupa, strzałka). */
export function IconButton({
  label,
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<'button'> & { label: string }) {
  return (
    <button type="button" aria-label={label} title={label} className={cn(ICON_BUTTON, className)} {...props}>
      {children}
    </button>
  )
}

export function IconLink({
  label,
  className,
  children,
  ...props
}: React.ComponentProps<typeof Link> & { label: string }) {
  return (
    <Link aria-label={label} title={label} className={cn(ICON_BUTTON, className)} {...props}>
      {children}
    </Link>
  )
}
