import PortableTextContent from './PortableTextContent'
import { hasRichText } from '@/lib/richText'

/**
 * Długi opis SEO na DOLE listingu (kategoria / subkategoria) — pod
 * produktami, żeby nie zasłaniał oferty. Renderowany na serwerze, więc
 * Google widzi pełny tekst. Pusty opis = nic się nie wyświetla.
 */
export default function ListingSeoContent({ value, title }: { value?: unknown[] | null; title?: string }) {
    if (!hasRichText(value)) return null
    return (
        <section aria-label={title ? `O kategorii ${title}` : 'Opis kategorii'} className="w-full max-w-[1100px] mx-auto mb-16 mt-4 border-t border-[#E3E3E3] pt-10 font-poppins">
            {title && <h2 className="text-black font-medium text-[clamp(17px,1.6vw,21px)] mb-2">{title}</h2>}
            <div className="text-[#4A4A4A] [&_p]:text-[clamp(13px,1.2vw,15px)] [&_li]:text-[clamp(13px,1.2vw,15px)]">
                <PortableTextContent value={value as unknown[]} />
            </div>
        </section>
    )
}
