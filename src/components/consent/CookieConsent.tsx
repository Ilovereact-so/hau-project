'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Cookie, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  ALL_DENIED,
  ALL_GRANTED,
  CONSENT_LABELS,
  CONSENT_OPEN_EVENT,
  OPTIONAL_CATEGORIES,
  readConsentCookie,
  writeConsentCookie,
  type ConsentState,
} from '@/lib/consent'

/*
 * Baner zgód na cookies.
 *
 * Reguły, których trzyma się ta implementacja:
 *  - do czasu decyzji nie działa nic poza cookies niezbędnymi (skrypty
 *    analityczne czekają na zdarzenie zgody — patrz components/consent/Analytics),
 *  - „Odrzuć” jest równie łatwe jak „Akceptuj” (jeden klik, ten sam poziom),
 *  - zgodę da się zmienić później: link „Ustawienia cookies” w stopce,
 *  - baner renderuje się dopiero po sprawdzeniu ciasteczka, więc nie mruga
 *    osobom, które już zdecydowały.
 */

type Panel = 'hidden' | 'banner' | 'settings'

export default function CookieConsent() {
  const [panel, setPanel] = useState<Panel>('hidden')
  const [analytics, setAnalytics] = useState(false)
  const [marketing, setMarketing] = useState(false)

  useEffect(() => {
    const current = readConsentCookie()
    if (current) {
      setAnalytics(current.analytics)
      setMarketing(current.marketing)
    } else {
      setPanel('banner')
    }
  }, [])

  // Link w stopce („Ustawienia cookies”) otwiera panel z aktualnym wyborem.
  useEffect(() => {
    const open = () => {
      const current = readConsentCookie()
      setAnalytics(current?.analytics ?? false)
      setMarketing(current?.marketing ?? false)
      setPanel('settings')
    }
    window.addEventListener(CONSENT_OPEN_EVENT, open)
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, open)
  }, [])

  const save = useCallback((state: Pick<ConsentState, 'analytics' | 'marketing'>) => {
    writeConsentCookie({ ...ALL_DENIED, ...state })
    setAnalytics(state.analytics)
    setMarketing(state.marketing)
    setPanel('hidden')
  }, [])

  // Esc zamyka panel ustawień (baner pierwszej decyzji zostaje — trzeba wybrać).
  useEffect(() => {
    if (panel !== 'settings') return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPanel(readConsentCookie() ? 'hidden' : 'banner')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panel])

  if (panel === 'hidden') return null

  const settings = panel === 'settings'
  const values: Record<(typeof OPTIONAL_CATEGORIES)[number], boolean> = { analytics, marketing }
  const setters: Record<(typeof OPTIONAL_CATEGORIES)[number], (value: boolean) => void> = {
    analytics: setAnalytics,
    marketing: setMarketing,
  }

  return (
    <div
      role="dialog"
      aria-modal={settings || undefined}
      aria-labelledby="cookie-consent-title"
      className={cn(
        'fixed inset-x-0 bottom-0 z-[1000] font-poppins',
        settings && 'top-0 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]',
      )}
    >
      <div
        className={cn(
          'mx-auto w-full bg-background text-black shadow-[0_-10px_40px_rgba(0,0,0,0.18)]',
          settings
            ? 'max-h-[85vh] max-w-[620px] overflow-auto rounded-[32px] p-6 sm:p-8'
            : 'max-w-[1350px] rounded-t-[28px] p-5 sm:rounded-[28px] sm:p-6 sm:mb-4',
        )}
      >
        <div className="flex items-start gap-3">
          
          <div className="flex-1">
            <div className="flex space-x-3 items-center">              
              <Cookie className="h-5 w-5 text-fancy-black" />              
              <h2 id="cookie-consent-title" className="text-[clamp(16px,1.6vw,20px)] font-medium">
                  {settings ? 'Ustawienia cookies' : 'Dbamy o Twoją prywatność'}
              </h2>
            </div>
            
            <p className="mt-1 text-[14px] leading-[1.6] text-[#4a4a4a]">
              Używamy plików cookies, żeby sklep działał (koszyk, logowanie, płatności) oraz — za Twoją zgodą — żeby
              liczyć anonimowe statystyki odwiedzin. Zgodę możesz zmienić w każdej chwili w stopce, w „Ustawieniach
              cookies”. Szczegóły opisaliśmy w{' '}
              <Link href="/help/polityka-cookies" className="underline underline-offset-2 hover:text-[#6EB0A6]">
                polityce cookies
              </Link>{' '}
              i{' '}
              <Link href="/help/polityka-prywatnosci" className="underline underline-offset-2 hover:text-[#6EB0A6]">
                polityce prywatności
              </Link>
              .
            </p>
          </div>
          {settings && (
            <button
              type="button"
              onClick={() => setPanel(readConsentCookie() ? 'hidden' : 'banner')}
              aria-label="Zamknij ustawienia cookies"
              className="rounded-full p-1 text-[#6C6C6C] hover:bg-[#ededed] hover:text-black cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {settings && (
          <ul className="mt-5 grid gap-3">
            <li className="rounded-[18px] bg-[#ededed]  p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{CONSENT_LABELS.necessary.title}</span>
                <span className="text-[13px] text-[#6C6C6C]">zawsze aktywne</span>
              </div>
              <p className="mt-1 text-[13px] leading-[1.6] text-[#6C6C6C]">{CONSENT_LABELS.necessary.description}</p>
            </li>
            {OPTIONAL_CATEGORIES.map((category) => (
              <li key={category} className="rounded-[18px] border border-[#ededed] p-4">
                <label className="flex cursor-pointer items-center justify-between gap-3">
                  <span className="font-medium">{CONSENT_LABELS[category].title}</span>
                  <label className="flex relative group ">
                    <input
                      type="checkbox"
                      checked={values[category]}
                      onChange={(event) => setters[category](event.target.checked)}
                      className="h-5 w-5 rounded-[5px] opacity-0"
                    />
                    <div className="absolute top-0 left-0 w-full flex justify-center items-center h-full border-[2px] border-[#818181] group-has-[:checked]:border-fancy-black group-has-[:checked]:bg-fancy-black rounded-[6px] ease-in-out duration-150">
                      <Check size={14} strokeWidth={3} className=" text-white group-has-[:checked]:opacity-100 opacity-0" />
                    </div>
                  </label>
                </label>
                <p className="mt-1 text-[13px] leading-[1.6] text-[#6C6C6C]">{CONSENT_LABELS[category].description}</p>
              </li>
            ))}
          </ul>
        )}

        <div className={cn('mt-5 flex flex-col gap-2 sm:flex-row sm:items-center', settings ? '' : 'sm:justify-end')}>
          {!settings && (
            <button
              type="button"
              onClick={() => setPanel('settings')}
              className="order-3 rounded-full px-5 py-3 text-[15px] font-medium text-[#4a4a4a] underline underline-offset-2 hover:text-black cursor-pointer sm:order-1 sm:mr-auto sm:no-underline"
            >
              Ustawienia
            </button>
          )}
          <button
            type="button"
            onClick={() => save(ALL_DENIED)}
            className="order-2 rounded-full bg-[#ededed] px-6 py-3 text-[15px] font-medium text-black hover:bg-[#ededed] cursor-pointer"
          >
            Odrzuć opcjonalne
          </button>
          {settings && (
            <button
              type="button"
              onClick={() => save({ analytics, marketing })}
              className="order-2 rounded-full bg-[#ededed] px-6 py-3 text-[15px] font-medium text-black hover:bg-[#ededed] cursor-pointer"
            >
              Zapisz wybór
            </button>
          )}
          <button
            type="button"
            onClick={() => save(ALL_GRANTED)}
            className="order-1 rounded-full bg-fancy-black px-6 py-3 text-[15px] font-medium text-white hover:bg-[#272929] cursor-pointer sm:order-3"
          >
            Akceptuję wszystkie
          </button>
        </div>
      </div>
    </div>
  )
}
