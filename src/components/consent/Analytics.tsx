'use client'

import Script from 'next/script'
import { useEffect, useState } from 'react'
import { CONSENT_EVENT, readConsentCookie, type ConsentState } from '@/lib/consent'

/*
 * Google Analytics 4 w trybie Consent Mode v2.
 *
 * Skrypt GA ładuje się DOPIERO po zgodzie na statystykę — do tego czasu
 * przeglądarka nie pobiera nic z domen Google i nie powstają żadne cookies
 * analityczne. Domyślne ustawienie zgód (`denied`) wysyłamy zawsze, zanim
 * jakikolwiek tag zdąży cokolwiek wysłać; po decyzji użytkownika lecą
 * `consent update`, więc wycofanie zgody działa od razu, bez przeładowania.
 *
 * Identyfikator pomiaru wpisz w `.env` jako NEXT_PUBLIC_GA_MEASUREMENT_ID
 * (np. G-XXXXXXX). Bez niego komponent nie robi nic.
 */

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

function pushConsentUpdate(state: ConsentState | null) {
  if (typeof window === 'undefined') return
  window.dataLayer = window.dataLayer || []
  // Zwykła funkcja, nie strzałkowa — gtag wymaga `arguments`.
  function gtag(...args: unknown[]) {
    window.dataLayer!.push(args)
  }
  gtag('consent', 'update', {
    analytics_storage: state?.analytics ? 'granted' : 'denied',
    ad_storage: state?.marketing ? 'granted' : 'denied',
    ad_user_data: state?.marketing ? 'granted' : 'denied',
    ad_personalization: state?.marketing ? 'granted' : 'denied',
  })
}

export default function Analytics() {
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    const apply = (state: ConsentState | null) => {
      pushConsentUpdate(state)
      setAllowed(Boolean(state?.analytics))
    }
    apply(readConsentCookie())
    const onChange = (event: Event) => apply((event as CustomEvent<ConsentState>).detail ?? readConsentCookie())
    window.addEventListener(CONSENT_EVENT, onChange)
    return () => window.removeEventListener(CONSENT_EVENT, onChange)
  }, [])

  if (!GA_ID) return null

  return (
    <>
      {/* Domyślne zgody ustawiamy zawsze — także zanim użytkownik zdecyduje. */}
      <Script id="gtag-consent-default" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
window.gtag=window.gtag||gtag;
gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500});`}
      </Script>
      {allowed && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="gtag-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('js',new Date());
gtag('config','${GA_ID}',{anonymize_ip:true});`}
          </Script>
        </>
      )}
    </>
  )
}
