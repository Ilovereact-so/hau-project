import Link from 'next/link'
import type { Metadata } from 'next'
import { Search, PawPrint } from 'lucide-react'
import NavbarContainer from '@/components/NavbarContainer'
import Footer from '@/components/Footer'
import TopInfoBar from '@/components/TopInfoBar'
import Container from '@/components/Container'

/**
 * Strona 404 dla całego sklepu (każdy nieistniejący adres i każde `notFound()`).
 * Wcześniej Next pokazywał tu swój domyślny, angielski ekran bez nawigacji —
 * klient trafiał w ślepy zaułek. Teraz ma nagłówek, stopkę i drogi wyjścia.
 */
export const metadata: Metadata = {
  title: 'Nie znaleziono strony',
  robots: { index: false, follow: true },
}

export default function NotFound() {
  return (
    <>
      <TopInfoBar />
      <NavbarContainer mode={1} />
      <Container className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-20 text-center font-poppins">
        <span className="rounded-full bg-[#e2f3f0] p-5" aria-hidden="true">
          <PawPrint className="h-8 w-8 text-[#6EB0A6]" />
        </span>
        <h1 className="mt-6 text-[clamp(26px,4vw,44px)] font-medium text-black">Nie ma takiej strony</h1>
        <p className="mt-3 max-w-[520px] text-[clamp(14px,1.5vw,17px)] text-[#6C6C6C]">
          Adres jest nieaktualny albo produkt zniknął z oferty. Zajrzyj na stronę główną albo poszukaj czegoś dla swojego psa.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/" className="rounded-full bg-fancy-black px-8 py-3 font-medium text-white hover:bg-[#272929]">
            Strona główna
          </Link>
          <Link
            href="/search"
            className="flex items-center gap-2 rounded-full border border-fancy-black px-8 py-3 font-medium text-black hover:bg-[#ededed]"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            Szukaj produktu
          </Link>
          <Link href="/help" className="px-4 py-3 text-[#6C6C6C] underline underline-offset-2 hover:text-black">
            Centrum pomocy
          </Link>
        </div>
      </Container>
      <Footer />
    </>
  )
}
