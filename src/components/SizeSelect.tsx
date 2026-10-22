"use client"

import * as React from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "framer-motion"
import { Check, ChevronDown } from "lucide-react"
import { GetSlugProduct } from "../../sanity.types"
import { VariantOption } from "./OptionWidthImageFromVariant"
import { useClickOutside } from "@/hooks/useClickOutside"
import { sortFilterValues } from "@/lib/filterValueOrder"

type Props = {
  filterValues?: GetSlugProduct["filterValues"]
  option: VariantOption
  setValue?: (value: string) => void
}

// Zwykły rozsuwany dropdown na position:absolute wewnątrz relative wrappera —
// bez Select.Portal z base-ui. Portal renderował popup poza normalnym flow
// strony i przy okazji blokował scroll body (base-ui wiesza własny scroll-lock
// na document, gdy popup jest otwarty w portalu). Tutaj popup jest zwykłym
// dzieckiem w drzewie, więc strona scrolluje się normalnie, a zamykanie po
// kliknięciu poza elementem idzie przez ten sam useClickOutside co reszta
// dropdownów w apce (patrz FilterCard w SubcategoryFilterContainer.tsx).
// Wszystkie etykiety w jednej komórce siatki (patrz przycisk niżej).
const STACK: React.CSSProperties = { gridArea: '1 / 1' }

export default function SizeSelect({ option, filterValues, setValue }: Props) {
  const items = React.useMemo(
    () =>
      sortFilterValues(
        filterValues
          ?.map((item) => ({
            label: item.value,
            value: item.slug?.current,
          }))
          .filter((item): item is { label: string; value: string } => Boolean(item?.value)) ?? [],
        (item) => item.label,
      ),
    [filterValues]
  )
  // Rozmiar opisujemy rozmiarem psa — link do wyjaśnienia w Centrum pomocy.
  const isSizeOption = /rozmiar|size/i.test(`${option?.name?.key ?? ''} ${option?.name?.label ?? ''}`)

  const selected = option?.value?.slug?.current ?? null
  const selectedLabel = items?.find((item) => item.value === selected)?.label ?? option?.value?.value ?? ""

  const [open, setOpen] = React.useState(false)
  const rootRef = React.useRef<HTMLDivElement>(null)
  useClickOutside(rootRef, () => setOpen(false))

  React.useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open])

  const handleSelect = (value: string) => {
    setOpen(false)
    if (value === selected) return
    setValue?.(value)
  }

  return (
    <div ref={rootRef} className="w-fit font-poppins mt-3">
      <div className="flex items-baseline gap-3">
        <p className='2lg:text-[16px] text-[15px] text-black '>{option?.name?.label}:</p>
        {isSizeOption && (
          <Link href="/help/jak-dobrac-rozmiar" className="text-[13px] text-[#6C6C6C] underline underline-offset-2 hover:text-black">
            Jak dobrać rozmiar?
          </Link>
        )}
      </div>
      {/* Kotwica listy = sam przycisk. Wcześniej lista brała `w-full` całego
          bloku, a ten był szerszy od przycisku przez napis
          „Rozmiar psa: Jak dobrać rozmiar?” — rozwinięta lista wystawała
          poza pole. Teraz lista ma dokładnie szerokość przycisku. */}
      <div className="relative w-fit">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`flex my-2 items-center justify-between gap-3 min-w-[9rem] h-[50px] px-5 text-black bg-[#EDEDED] cursor-pointer select-none transition-colors hover:bg-white ${
          open ? "rounded-t-[20px]" : "rounded-[20px]"
        }`}
      >
        {/* Szerokość przycisku = najdłuższa opcja (niewidoczne etykiety w tej
            samej komórce siatki), więc zmiana rozmiaru nie zmienia szerokości
            pola, a lista mieści każdą pozycję. */}
        <span className="grid 2lg:text-[16px] text-[15px] leading-6 text-left">
          {items?.map(({ label, value }) => (
            <span key={value} aria-hidden className="invisible whitespace-nowrap" style={STACK}>{label}</span>
          ))}
          <span className="whitespace-nowrap" style={STACK}>{selectedLabel}</span>
        </span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: -10 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.15, ease: "easeInOut" }}
            className="absolute left-0 top-full z-20 w-full min-w-[9rem] max-h-64 overflow-y-auto rounded-b-[20px] bg-[#EDEDED] shadow-lg"
          >
            {items?.map(({ label, value }) => (
              <li key={value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={value === selected}
                  onClick={() => handleSelect(value)}
                  className="flex items-center gap-2 w-full h-[50px] px-5 text-left text-black text-[0.875rem] cursor-pointer hover:bg-white transition-colors"
                >
                  <Check className={`w-3 h-3 shrink-0 ${value === selected ? "opacity-100" : "opacity-0"}`} />
                  <span className="whitespace-nowrap">{label}</span>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
      </div>
    </div>
  )
}
