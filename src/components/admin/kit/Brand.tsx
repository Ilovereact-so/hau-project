import Image from 'next/image'
import { cn } from './utils'

/**
 * Znak panelu — ten sam układ co w meblove („SK[X] MEBLE”), z nazwą HAU:
 * „HA” + litera „U” w ramce w kolorze akcentu + dopisek „ADMIN”.
 */
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className="flex flex-none items-end gap-0.5 text-[16px] font-extrabold tracking-[-0.02em] text-text duration-150 ease-in-out sm:text-[18px] xl:text-[20px]"
      aria-label="HAU — panel administracyjny"
    >
      <Image src="/logo_hau.svg" alt="HAU" width={40} height={40}  className={` ${
        compact ? "w-[30px]":"w-[40px]"
      }`}/>
      <span
        className={cn(
          'text-[9px] leading-2.25 font-medium tracking-widest text-accent sm:text-[11px] mb-2 xl:text-[13px]',
          compact && 'hidden'
        )}
      >
        ADMIN
      </span>
    </div>
  )
}
