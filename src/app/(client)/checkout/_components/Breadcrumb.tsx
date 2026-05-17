'use client'

import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { STEPS, type Step } from './utils'

export default function Breadcrumb({ step }: { step: Step }) {
  return (
    <nav className="flex justify-center items-center gap-2 text-[16px] mb-8 font-poppins">
      {STEPS.map((label, i) => {
        const done    = i < step
        const active  = i === step
        const pending = i > step
        return (
          <div key={label} className='flex justify-center items-center'>
            {i > 0 && (
              <hr className='w-[40px] h-[1px] bg-black mx-4'
              />)}
          <div className='flex justify-center items-center flex-col space-y-2'>
            <div className={`w-[27px] h-[27px] rounded-full flex justify-center items-center text-[16px] bg-[#D9D9D9] ${
              active ? 'bg-[#E4E4E4] text-black' : 'bg-[#D9D9D9] text-[#BBBBBB]'
            }`}>{i+1}</div>
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
          </div>
        </div>
        )
      })}
    </nav>
  )
}
