import { ShieldCheck } from 'lucide-react'

/*
 * Informacje wymagane przez GPSR (rozporządzenie (UE) 2023/988, art. 19) przy
 * sprzedaży online: producent (nazwa, adres pocztowy, kontakt elektroniczny),
 * osoba odpowiedzialna w UE dla producenta spoza Unii oraz ostrzeżenia
 * i informacje o bezpieczeństwie. Dane z pola `safety` produktu w Sanity.
 * Bez żadnych danych sekcja się nie renderuje.
 */

export type ProductSafety = {
  manufacturerName?: string | null
  manufacturerAddress?: string | null
  manufacturerContact?: string | null
  responsiblePerson?: string | null
  warnings?: string | null
}

const clean = (value?: string | null) => (value ?? '').trim()

export function hasSafetyInfo(safety?: ProductSafety | null): boolean {
  if (!safety) return false
  return [safety.manufacturerName, safety.manufacturerAddress, safety.manufacturerContact, safety.responsiblePerson, safety.warnings]
    .some((value) => clean(value))
}

function contactHref(contact: string): string | null {
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) return `mailto:${contact}`
  if (/^https?:\/\//i.test(contact)) return contact
  if (/^www\./i.test(contact)) return `https://${contact}`
  return null
}

export default function ProductSafetyInfo({ safety }: { safety?: ProductSafety | null }) {
  if (!hasSafetyInfo(safety)) return null
  const name = clean(safety?.manufacturerName)
  const address = clean(safety?.manufacturerAddress)
  const contact = clean(safety?.manufacturerContact)
  const responsible = clean(safety?.responsiblePerson)
  const warnings = clean(safety?.warnings)
  const href = contact ? contactHref(contact) : null

  return (
    <section
      id="bezpieczenstwo"
      aria-labelledby="bezpieczenstwo-heading"
      className="w-full max-w-[1430px] mx-auto xl:px-26 2lg:px-20 md:px-16 sm:px-8 px-6 scroll-mt-24 flex justify-center mt-12"
    >
      <div className="w-full border-t border-[#D9D9D9] pt-8 font-poppins">
        <h2 id="bezpieczenstwo-heading" className="flex items-center gap-2 text-black font-medium text-[clamp(18px,1.8vw,24px)] mb-4">
          <ShieldCheck className="w-6 h-6 text-[#6EB0A6]" aria-hidden="true" />
          Bezpieczeństwo produktu
        </h2>
        <dl className="grid gap-x-10 gap-y-4 sm:grid-cols-2 max-w-[820px] text-[14px] text-[#3D3D3D]">
          {(name || address || contact) && (
            <div>
              <dt className="font-medium text-black mb-1">Producent</dt>
              <dd className="whitespace-pre-line leading-relaxed">
                {name && <>{name}<br /></>}
                {address && <>{address}<br /></>}
                {contact && (href
                  ? <a href={href} className="underline underline-offset-2 hover:text-black" rel={href.startsWith('http') ? 'noopener nofollow' : undefined} target={href.startsWith('http') ? '_blank' : undefined}>{contact}</a>
                  : contact)}
              </dd>
            </div>
          )}
          {responsible && (
            <div>
              <dt className="font-medium text-black mb-1">Osoba odpowiedzialna w UE</dt>
              <dd className="whitespace-pre-line leading-relaxed">{responsible}</dd>
            </div>
          )}
          {warnings && (
            <div className="sm:col-span-2">
              <dt className="font-medium text-black mb-1">Ostrzeżenia i informacje o bezpieczeństwie</dt>
              <dd className="whitespace-pre-line leading-relaxed">{warnings}</dd>
            </div>
          )}
        </dl>
      </div>
    </section>
  )
}
