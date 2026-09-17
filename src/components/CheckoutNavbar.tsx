'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { STEPS, type Step } from '@/app/(client)/checkout/_components/utils'

export default function CheckoutNavbar({ step, userSlot }: { step: Step; userSlot: React.ReactNode }) {

  return (
    <header className="w-full z-10 max-w-[1500px] mx-auto">
      <div id={"checkout_navbar"} className="mx-auto px-6 sm:px-10 lg:px-15 3xs:h-[90px] 3xs:flex items-center justify-between gap-4">

        {/* Logo */}
        <Link href="/" style={{ gridArea: 'logo' }} className="flex-shrink-0">
          <Image src="/logo_hau.svg" alt="HAU" width={80} height={80} className="lg:h-[65px] h-[55px] w-auto" />
        </Link>

        {/* Step indicators */}
        <nav style={{ gridArea: 'stepper' }} className="flex items-center font-poppins max-3xs:w-full justify-center">
          {STEPS.map((label, i) => {
            const done    = i < step
            const active  = i === step
            const pending = i > step
            return (
              <div key={label} className="flex items-center">
                {i > 0 && (
                  <hr className={cn(
                    'w-[50px] sm:w-[calc(20px+2vw)] h-[2px] mx-2 sm:mx-3',
                    done ? 'bg-black' : 'bg-[#D9D9D9]',
                  )} />
                )}
                <div className={`flex flex-col items-center gap-1  ${
                  i < step && "cursor-pointer"
                }`}>
                  <div className={cn(
                    'w-[28px] h-[28px] rounded-full flex items-center justify-center text-[clamp(14px,1.4vw,16px)] font-medium transition-colors',
                    active  ? 'bg-[#E4E4E4] text-black' : '',
                    done    ? 'bg-[#E4E4E4] text-[#767676]' : '',
                    pending ? 'bg-[#D9D9D9] text-[#B7B7B7] opacity-50' : '',
                  )}>
                    {done ? <Check size={14} strokeWidth={2.5} /> : i + 1}
                  </div>
                  <span className={cn(
                    'text-[11px] sm:text-[clamp(12px,1.4vw,16px)] transition-colors',
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
        <div style={{ gridArea: 'user' }} className="flex items-center gap-1 flex-shrink-0">
          {userSlot}
        </div>

      </div>
    </header>
  )
}
