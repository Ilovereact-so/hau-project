/**
 * Mini-wizualizacje w kartach KPI — cztery formy z referencji:
 * słupki, krzywa rosnąca, „zygzak” i ciąg kropek. Rysowane inline.
 */

const ACCENT = '#F59E0B'

function normalize(values: number[], fallback: number[]) {
  const source = values.length >= 2 ? values : fallback
  const max = Math.max(...source)
  const min = Math.min(...source)
  const span = max - min || 1
  return source.map((value) => (value - min) / span)
}

function pickSamples(values: number[], count: number) {
  if (values.length <= count) return values
  const step = (values.length - 1) / (count - 1)
  return Array.from({ length: count }, (_, index) => values[Math.round(index * step)])
}

export function SparkBars({ values = [] as number[] }) {
  const bars = normalize(pickSamples(values, 6), [0.2, 0.35, 0.5, 0.62, 0.8, 1])
  return (
    <svg width="56" height="34" viewBox="0 0 56 34" aria-hidden className="shrink-0">
      {bars.map((value, index) => {
        const height = 6 + value * 26
        return (
          <rect
            key={index}
            x={index * 9.5}
            y={34 - height}
            width="5.5"
            height={height}
            rx="2"
            fill={ACCENT}
            opacity={0.35 + (index / Math.max(1, bars.length - 1)) * 0.65}
          />
        )
      })}
    </svg>
  )
}

function toPath(points: number[], width: number, height: number) {
  const stepX = width / Math.max(1, points.length - 1)
  return points
    .map((value, index) => {
      const x = index * stepX
      const y = height - 3 - value * (height - 6)
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

export function SparkLine({ values = [] as number[] }) {
  const points = normalize(pickSamples(values, 8), [0.05, 0.12, 0.24, 0.3, 0.48, 0.6, 0.82, 1])
  return (
    <svg width="56" height="34" viewBox="0 0 56 34" aria-hidden className="shrink-0">
      <path d={toPath(points, 56, 34)} fill="none" stroke={ACCENT} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function SparkWave({ values = [] as number[] }) {
  const points = normalize(pickSamples(values, 9), [0.5, 0.15, 0.7, 0.3, 0.85, 0.4, 0.95, 0.55, 0.75])
  return (
    <svg width="56" height="34" viewBox="0 0 56 34" aria-hidden className="shrink-0">
      <path d={toPath(points, 56, 34)} fill="none" stroke={ACCENT} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function SparkDots({ filled = 2, total = 4 }: { filled?: number; total?: number }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5" aria-hidden>
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={
            index < filled
              ? 'grid size-[18px] place-items-center rounded-full bg-primary'
              : 'size-[18px] rounded-full border-[1.5px] border-border-strong'
          }
        >
          {index < filled && <span className="size-1.5 rounded-full bg-white" />}
        </span>
      ))}
    </span>
  )
}
