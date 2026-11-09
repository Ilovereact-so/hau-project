'use client'
import { ArrowRight, Lock } from 'lucide-react'
import Link from 'next/link'
import React from 'react'
import { useAuthModalStore } from '@/store/authModalStore'
import { useSafeSignOut } from '@/hooks/useSafeSignOut'
import { GUEST_PROFILE_PATHS, useProfileIsGuest } from './profile/ProfileSession'

// Ścieżki bezwzględne — przy adresach zagnieżdżonych (np. /profile/orders/[id])
// względne "orders" rozwijało się do /profile/orders/orders.
const NAV = [
  { text: 'Moje konto',       href: '/profile/account'  },
  { text: 'Moje zamówienia',  href: '/profile/orders'   },
  { text: 'Polubione',        href: '/profile/wishlist' },
]

const isGuestAllowed = (href: string) =>
  (GUEST_PROFILE_PATHS as readonly string[]).includes(href)

const ProfileMenu = ({ selected }: { selected: number }) => {
  const isGuest   = useProfileIsGuest()
  const openModal = useAuthModalStore(s => s.openModal)
  const { signOut, pending } = useSafeSignOut()

  return (
    // Desktop: pionowa kolumna 300px sticky (bez zmian). Mobile (poniżej lg):
    // poziomy pasek linków z zawijaniem nad treścią — pionowe menu 300px zabierało
    // prawie cały ekran telefonu.
    <nav aria-label='Menu konta' className={`max-3xs:justify-start flex flex-wrap  self-start gap-x-6 lg:gap-x-0 gap-y-0 lg:sticky lg:top-10  ${
      selected == 0 && "w-full lg:w-[300px] md:w-[250px] flex-row md:flex-col items-center md:items-start max-md:mb-3"
    } ${
      selected == 1 && "w-full lg:w-[300px] 3md:w-[250px] flex-row 3md:flex-col items-center 3md:items-start max-3md:mb-5 max-md:mb-3"
    } ${
      selected == 2 && "w-full 2xl:w-[300px] 3lg:w-[250px] 3md:w-[200px] min-w-[200px] flex-row 3md:flex-col items-center 3md:items-start max-3md:mb-5 max-md:mb-3"
    } `}>
      {NAV.map((item, index) => {
        const textClass = selected !== index
          ? '2xl:text-[18px] text-[clamp(14px,1.8vw,16px)]'
          : '2xl:text-[20px] text-[clamp(15px,1.8vw,18px)] font-medium'
        const locked = isGuest && !isGuestAllowed(item.href)

        return (
          <div key={item.href} className='py-2 flex items-center space-x-2'>
            {locked ? (
              // Gość: sekcja "przydymiona" — widoczna, ale wymaga logowania.
              // Po zalogowaniu przechodzimy od razu do klikniętej sekcji.
              <button
                type='button'
                onClick={() => openModal('signIn', { redirectTo: item.href })}
                title='Zaloguj się, aby otworzyć tę sekcję'
                aria-label={`${item.text} — wymaga zalogowania`}
                className={`group flex items-center gap-1.5 text-[#6C6C6C] hover:text-black/60 transition-colors cursor-pointer ${textClass}`}
              >
                {item.text}
                <Lock strokeWidth={2.4} className='w-[14px] h-[14px] group-hover:opacity-100 text-[#6C6C6C]' aria-hidden />
              </button>
            ) : (
              <Link
                href={item.href}
                aria-current={selected === index ? 'page' : undefined}
                className={`text-black ${textClass}`}
              >
                {item.text}
              </Link>
            )}
            {/* Strzałka aktywnego elementu — na wąskich ekranach zbędna (kolumny nie ma) */}
            <ArrowRight
              className={`text-black hidden md:block ${selected !== index ? 'opacity-0' : 'opacity-100'}`}
              width={20}
              height={20}
            />
          </div>
        )
      })}

      {isGuest ? (
        <button
          type='button'
          onClick={() => openModal('signIn')}
          className='text-fancy-black 2xl:text-[18px] text-[clamp(14px,1.8vw,16px)] font-medium py-2 lg:mt-2 cursor-pointer transition-colors'
        >
          Zaloguj się
        </button>
      ) : (
        <button
          type='button'
          onClick={() => signOut('/')}
          disabled={pending}
          className='text-[#DE3232] 2xl:text-[18px] text-[clamp(14px,1.8vw,16px)] font-medium py-2 lg:mt-2 cursor-pointer disabled:opacity-60 text-left'
        >
          {pending ? 'Wylogowywanie…' : 'Wyloguj się'}
        </button>
      )}
    </nav>
  )
}

export default ProfileMenu
