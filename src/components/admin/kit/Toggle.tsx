import { cn } from './utils'

/** Przełącznik „pill” (np. ciemny motyw, aktywność metody dostawy). */
export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: () => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        'relative h-[22px] w-10 shrink-0 rounded-full border transition-colors duration-150 ease-(--ease)',
        'focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:outline-none',
        'disabled:opacity-50',
        checked ? 'border-primary bg-primary' : 'border-border-strong bg-muted'
      )}
    >
      <span
        className={cn(
          'absolute top-1/2 size-4 -translate-y-1/2 rounded-full bg-surface shadow-pill transition-all duration-150 ease-(--ease)',
          checked ? 'left-[21px]' : 'left-[2px]'
        )}
      />
    </button>
  )
}
