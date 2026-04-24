'use client'

import { cn } from '@/lib/utils'

const OPTIONS = [
  { id: 'przelewy24' as const, name: 'Przelewy24',  desc: 'Przelew online, BLIK, karta' },
  { id: 'autopay'   as const, name: 'Autopay',      desc: 'Szybki przelew, Google Pay, Apple Pay' },
  { id: 'cod'       as const, name: 'Za pobraniem', desc: 'Płatność przy odbiorze (+5,00 zł)' },
]

export type PaymentMethod = typeof OPTIONS[number]['id']

interface Props {
  value:    PaymentMethod
  onChange: (v: PaymentMethod) => void
}

export default function Step2PaymentForm({ value, onChange }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-[#E8E8E8] p-6 space-y-4">
      <h2 className="text-[17px] font-semibold text-fancy-black">Metoda płatności</h2>
      <div className="space-y-3">
        {OPTIONS.map(opt => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={cn(
              'w-full text-left border-2 rounded-xl p-4 transition-all duration-200 flex items-center gap-4',
              value === opt.id
                ? 'border-fancy-black bg-fancy-black/[0.03]'
                : 'border-[#E8E8E8] hover:border-[#BBBBBB]',
            )}
          >
            <div className={cn(
              'w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center',
              value === opt.id ? 'border-fancy-black' : 'border-[#BBBBBB]',
            )}>
              {value === opt.id && <div className="w-2.5 h-2.5 rounded-full bg-fancy-black" />}
            </div>
            <div className="flex-1">
              <p className="text-[15px] font-semibold text-fancy-black">{opt.name}</p>
              <p className="text-[13px] text-[#6C6C6C] mt-0.5">{opt.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
