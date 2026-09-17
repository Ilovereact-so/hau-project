/** Szkielet ładowania treści panelu — ta sama geometria co karty i tabela. */
export default function AdminLoading() {
  return (
    <div className="flex animate-pulse flex-col gap-4" aria-busy="true" aria-label="Ładowanie">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-[104px] rounded-md border border-border/70 bg-surface-muted" />
        ))}
      </div>
      <div className="rounded-md border border-border bg-surface-muted p-4">
        <div className="h-4 w-48 rounded-xs bg-track" />
        <div className="mt-2 h-3 w-72 rounded-xs bg-track" />
        <div className="mt-5 flex flex-col gap-2">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="h-10 rounded-xs bg-surface" />
          ))}
        </div>
      </div>
    </div>
  )
}
