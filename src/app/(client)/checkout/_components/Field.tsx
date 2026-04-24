'use client'

import { cn } from '@/lib/utils'

export interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

export default function Field({ label, error, className, ...props }: FieldProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-[#3D3D3D]">{label}</span>
      <input
        {...props}
        className={cn(
          'w-full border rounded-lg px-4 py-3 text-[15px] font-poppins bg-white',
          'placeholder:text-[#BBBBBB] transition-colors',
          'focus:outline-none focus:border-fancy-black',
          error ? 'border-red-400' : 'border-[#D5D5D5]',
          className,
        )}
      />
      {error && <span className="text-xs text-red-500">{error}</span>}
    </label>
  )
}
