/** Łączy klasy Tailwinda — wariant shadcn `cn()` bez zależności (port z meblove). */
export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}
