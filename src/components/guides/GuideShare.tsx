'use client'

import React, { useState } from 'react'
import { Check, Link2, Share2 } from 'lucide-react'

/**
 * „Udostępnij” pod artykułem: na telefonie systemowy arkusz udostępniania
 * (Messenger, WhatsApp…), na komputerze kopiowanie linku. Bez skryptów
 * serwisów społecznościowych — nie trzeba o nie pytać w banerze cookies.
 */
export default function GuideShare({ title, url }: { title: string; url: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2200)
    } catch {
      window.prompt('Skopiuj link do artykułu:', url)
    }
  }

  const share = async () => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url })
        return
      } catch (error) {
        // Anulowanie przez użytkownika to nie błąd — nic nie robimy.
        if (error instanceof DOMException && error.name === 'AbortError') return
      }
    }
    await copy()
  }

  const button =
    'inline-flex items-center gap-2 rounded-full border border-[#DADADA] bg-white px-4 py-2 font-poppins text-[14px] font-medium text-[#20201F] transition-colors hover:border-[#20201F]'

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={share} className={button}>
        <Share2 className="size-4" />
        Udostępnij
      </button>
      <button type="button" onClick={copy} className={button} aria-live="polite">
        {copied ? <Check className="size-4 text-[#1F7A6A]" /> : <Link2 className="size-4" />}
        {copied ? 'Skopiowano' : 'Kopiuj link'}
      </button>
    </div>
  )
}
