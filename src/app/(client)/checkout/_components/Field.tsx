'use client'

import { cn } from '@/lib/utils'

export interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

export default function Field({ label, error, className, ...props }: FieldProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[16px] font-poppins font-medium text-[#3D3D3D]">{label}</span>
      <input
        {...props}
        className={cn(
          'w-full border border-black text-black rounded-full px-4 py-3 text-[16px] font-poppins',
          'placeholder:text-[#BBBBBB] transition-colors',
          'focus:outline-none',
          error ? 'border-red-400' : 'border-black',
          className,
        )}
      />
      {error && <span className="text-xs text-red-500">{error}</span>}
    </label>
  )
}
