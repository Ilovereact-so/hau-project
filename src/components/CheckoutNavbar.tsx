'use client'

import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { STEPS, type Step } from '@/app/(client)/checkout/_components/utils'

export default function CheckoutNavbar({ step, userSlot }: { step: Step; userSlot: React.ReactNode }) {

  return (
    <header className="w-full z-10">
      <div className="mx-auto px-4 sm:px-15 h-[90px] flex items-center justify-between gap-4">

        {/* Logo */}
        <Link href="/" className="flex-shrink-0">
          <Image src="/logo_hau.svg" alt="HAU" width={80} height={80} className="h-[65px] w-auto" />
        </Link>

        {/* Step indicators */}
        <nav className="flex items-center font-poppins">
          {STEPS.map((label, i) => {
            const done    = i < step
            const active  = i === step
            const pending = i > step
            return (
              <div key={label} className="flex items-center">
                {i > 0 && (
                  <hr className={cn(
                    'w-[36px] sm:w-[56px] h-[1px] mx-2 sm:mx-3',
                    done ? 'bg-black' : 'bg-[#D9D9D9]',
                  )} />
                )}
                <div className="flex flex-col items-center gap-1">
                  <div className={cn(
                    'w-[27px] h-[27px] rounded-full flex items-center justify-center text-[16px] font-medium transition-colors',
                    active  ? 'bg-black text-white' : '',
                    done    ? 'bg-black text-white' : '',
                    pending ? 'bg-[#E4E4E4] text-[#AAAAAA]' : '',
                  )}>
                    {i + 1}
                  </div>
                  <span className={cn(
                    'text-[11px] sm:text-[16px] transition-colors',
                    active  && 'text-black font-medium',
                    done    && 'text-[#6C6C6C] font-normal',
                    pending && 'text-[#BBBBBB] font-normal',
                  )}>
                    {label}
                  </span>
                </div>
              </div>
            )
          })}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {userSlot}
        </div>

      </div>
    </header>
  )
}
