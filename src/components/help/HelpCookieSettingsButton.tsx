'use client'

import React from 'react'
import { Cookie } from 'lucide-react'
import { openConsentSettings } from '@/lib/consent'

/**
 * „Ustawienia cookies” w Centrum pomocy — otwiera ten sam panel zgód co link
 * w stopce (CONSENT_OPEN_EVENT). Osobny komponent kliencki, bo reszta
 * Centrum pomocy renderuje się na serwerze.
 */
export default function HelpCookieSettingsButton({ className }: { className?: string }) {
    return (
        <button type='button' onClick={openConsentSettings} className={className}>
            <Cookie className='size-[18px] text-main' aria-hidden />
            Ustawienia cookies
        </button>
    )
}
