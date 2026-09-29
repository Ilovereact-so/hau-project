import { Cookie, CreditCard, FileText, RotateCcw, ScrollText, ShieldCheck, Truck, type LucideIcon } from 'lucide-react'

/**
 * Ikona dokumentu Centrum pomocy — po slugu, żeby kafelek na /help, sidebar
 * i nagłówek dokumentu zawsze pokazywały tę samą. Dokumenty spoza listy
 * (dodane w Studio) dostają neutralną kartkę.
 */
const ICONS: Record<string, LucideIcon> = {
    regulamin: ScrollText,
    'polityka-prywatnosci': ShieldCheck,
    'polityka-cookies': Cookie,
    'zwroty-i-reklamacje': RotateCcw,
    dostawa: Truck,
    'formy-platnosci': CreditCard,
}

export function helpIcon(slug: string): LucideIcon {
    return ICONS[slug] ?? FileText
}
