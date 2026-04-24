'use client'

import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { STEPS, type Step } from './utils'

export default function Breadcrumb({ step }: { step: Step }) {
  return (
    <nav className="flex items-center gap-2 text-[20px] mb-8 font-poppins">
      {STEPS.map((label, i) => {
        const done    = i < step
        const active  = i === step
        const pending = i > step
        return (
          <span key={label} className="flex items-center gap-2">
            {i > 0 && (
              <ChevronRight size={13} className="text-[#BBBBBB] flex-shrink-0" />
            )}
            <span
              className={cn(
                'transition-colors',
                active  && 'text-fancy-black font-medium',
                done    && 'text-[#6C6C6C] font-normal',
                pending && 'text-[#BBBBBB] font-normal',
              )}
            >
              {label}
            </span>
          </span>
        )
      })}
    </nav>
  )
}
