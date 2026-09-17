'use client'

import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react'

interface Props {
  value:    string
  onChange: (code: string) => void
}

/**
 * Pole na 6-cyfrowy kod BLIK (BLIK-0).
 *
 * Kod BLIK nie jest daną wrażliwą w rozumieniu PCI — to jednorazowy token
 * autoryzacyjny ważny ~2 minuty, przekazywany do Autopay jako `AuthorizationCode`.
 */
export default function BlikCodeInput({ value, onChange }: Props) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([])

  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? '')

  function handleChange(index: number, char: string) {
    const digit = char.replace(/\D/g, '').slice(-1)
    if (!digit) return
    onChange(digits.map((d, i) => (i === index ? digit : d)).join(''))
    inputsRef.current[index + 1]?.focus()
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace') {
      event.preventDefault()
      onChange(digits.map((d, i) => (i === index ? '' : d)).join(''))
      inputsRef.current[index - 1]?.focus()
    }
    if (event.key === 'ArrowLeft')  inputsRef.current[index - 1]?.focus()
    if (event.key === 'ArrowRight') inputsRef.current[index + 1]?.focus()
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault()
    const text = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    onChange(text)
    inputsRef.current[Math.min(text.length, 5)]?.focus()
  }

  return (
    <div className="flex items-center gap-2 mt-3">
      {digits.map((digit, index) => (
        <div key={index} className="flex items-center gap-2">
          {index === 3 && <span className="text-[#BBBBBB] text-lg select-none">–</span>}
          <input
            ref={el => { inputsRef.current[index] = el }}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            aria-label={`Cyfra ${index + 1} kodu BLIK`}
            maxLength={1}
            value={digit}
            onChange={e => handleChange(index, e.target.value)}
            onKeyDown={e => handleKeyDown(index, e)}
            onPaste={handlePaste}
            onFocus={e => e.target.select()}
            className="w-[46px] h-[52px] border-2 border-[#E0E0E0] rounded-xl text-center text-[20px] font-semibold text-fancy-black focus:border-fancy-black focus:outline-none transition-colors caret-transparent"
          />
        </div>
      ))}
    </div>
  )
}
