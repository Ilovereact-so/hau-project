/** Szkielet ładowania treści panelu — geometria 1:1 z DashboardView:
 *  nagłówek sekcji „Podsumowanie" + 4 karty StatCard (ikona + etykieta + chip,
 *  wartość 28px + mini-wykres), potem siatka kart z nagłówkami CardHeader. */
export default function AdminLoading() {
  return (
    <div className="flex animate-pulse flex-col gap-4" aria-busy="true" aria-label="Ładowanie">
      <div className="flex items-center justify-between gap-3">
        <div className="h-4 w-32 rounded-xs bg-track" />
        <div className="h-8 w-32 rounded-full bg-track" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="rounded-md border border-border/70 p-4">
            <div className="flex items-center gap-2">
              <div className="size-[15px] shrink-0 rounded-full bg-track" />
              <div className="h-3 min-w-[40%] flex-1 rounded-xs bg-track" />
              <div className="h-[18px] w-12 shrink-0 rounded-full bg-track" />
            </div>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div className="h-[28px] w-24 rounded-xs bg-track" />
              <div className="h-8 w-20 rounded-xs bg-track" />
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-md border border-border bg-surface-muted">
        <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4">
          <div className="flex items-start gap-2">
            <div className="mt-px size-4 shrink-0 rounded-full bg-track" />
            <div>
              <div className="h-4 w-48 rounded-xs bg-track" />
              <div className="mt-1 h-3 w-72 max-w-[60vw] rounded-xs bg-track" />
            </div>
          </div>
          <div className="h-8 w-40 rounded-sm bg-track" />
        </div>
        <div className="px-4 pt-3 pb-4 flex flex-col gap-2">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="flex items-center gap-3 rounded-xs border border-border bg-surface px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="h-3 w-2/3 rounded-xs bg-track" />
                <div className="mt-1 h-[11px] w-1/2 rounded-xs bg-track" />
              </div>
              <div className="h-3 w-16 shrink-0 rounded-xs bg-track" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
