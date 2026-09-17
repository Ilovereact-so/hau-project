"use client"
import { useUser } from '@clerk/nextjs'
import React from 'react'
import { Lock, User as UserIcon } from 'lucide-react'
import Loading from './Loading'
import Container from './Container'
import Image from 'next/image'
import { useProfileIsGuest } from './profile/ProfileSession'
import { useAuthModalStore } from '@/store/authModalStore'

const pad = (n: number) => String(n).padStart(2, '0')
const formatDate = (d?: Date | null) =>
    d ? `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}` : '—'

const ProfileContainer = ({ children }: { children: React.ReactNode }) => {
    const isGuest = useProfileIsGuest()

    return (
        <Container className='flex flex-col 2xl:px-15 md:px-10 px-6 font-poppins mt-10'>
            {isGuest ? <GuestProfileHeader /> : <UserProfileHeader />}
            <hr className='bg-black w-full sm:w-[clamp(400px,35vw,600px)] h-[1px] 2xl:h-[1px] mt-4'></hr>
            <div>
                {children}
            </div>
        </Container>
    )
}

function UserProfileHeader() {
    const { user, isLoaded } = useUser()

    if (!isLoaded || !user) return <Loading />

    return (
        <div className='flex justify-between relative max-lg:mt-30 max-md:mt-40'>
            <div className='flex flex-col'>
                <h1 className='text-black font-medium text-[clamp(17px,1.8vw,20px)]'>Moje konto</h1>
                <div className='flex mt-6'>
                    <Image src={user.imageUrl} width={100} height={100} alt="Zdjęcie profilowe" className='rounded-full w-[clamp(80px,7vw,100px)] h-[clamp(80px,7vw,100px)]' />
                    <div className='flex flex-col ml-4 justify-end mb-2'>
                        <p className='font-medium text-black text-[clamp(16px,1.2vw,18px)]'>{user.firstName} {user.lastName}</p>
                        <p className='text-black text-[clamp(14px,1.2vw,16px)]'>{user.primaryEmailAddress?.emailAddress}</p>
                    </div>
                </div>
            </div>
            <div className='flex justify-center max-lg:w-full items-center h-full absolute lg:top-[50%] md:-top-35 -top-50 left-[50%] translate-x-[-50%] lg:translate-y-[-50%]'>
                <h1 className='font-medium text-black text-[clamp(30px,2.1vw,40px)]'>Cześć {user.firstName}!</h1>
            </div>
            <div className='md:flex justify-end items-end max-md:absolute max-lg:-top-27 max-md:left-[50%] max-md:translate-x-[-50%] max-md:w-full max-md:text-center'>
                {/* getDate()/getMonth()+1 — wcześniej getDay() (dzień tygodnia) i miesiąc liczony od 0 */}
                <p className='text-black text-[14px]'>Konto stworzone: {formatDate(user.createdAt)}</p>
            </div>
        </div>
    )
}

/**
 * Nagłówek profilu dla gościa: ten sam układ co dla konta, ale dane są
 * "przydymione" (rozmyte, wyszarzone) i każde kliknięcie w nie otwiera
 * logowanie. Po zalogowaniu zostajemy na bieżącej stronie profilu.
 */
function GuestProfileHeader() {
    const openModal = useAuthModalStore(s => s.openModal)
    // Kliknięcie w przydymione dane konta → po zalogowaniu pokazujemy te dane.
    const openAccount = () => openModal('signIn', { redirectTo: '/profile/account' })
    // Przyciski CTA → zostajemy na bieżącej zakładce (np. wishlista po scaleniu).
    return (
        <div className='flex max-lg:flex-col-reverse lg:justify-between lg:items-end gap-6'>
            <div className='flex flex-col'>
                <h1 className='text-black font-medium text-[clamp(17px,1.8vw,20px)]'>Moje konto</h1>

                <button
                    type='button'
                    onClick={openAccount}
                    aria-label='Zaloguj się, aby zobaczyć dane konta'
                    title='Zaloguj się, aby zobaczyć dane konta'
                    className='group flex mt-6 text-left cursor-pointer'
                >
                    <div className='relative flex items-center justify-center rounded-full bg-[#ededed] w-[clamp(80px,7vw,100px)] h-[clamp(80px,7vw,100px)] opacity-80 group-hover:opacity-100 transition-opacity'>
                        <UserIcon className='text-[#9a9a9a] w-1/2 h-1/2 stroke-[1.2px]' />
                        <span className='absolute -bottom-1 -right-1 flex items-center justify-center rounded-full bg-fancy-black text-white w-8 h-8 shadow'>
                            <Lock className='w-4 h-4' />
                        </span>
                    </div>
                    <div className='flex flex-col ml-4 justify-end mb-2'>
                        <div aria-hidden className='select-none blur-[3px] opacity-10 grayscale'>
                            <p className='font-medium text-black text-[clamp(16px,1.2vw,18px)]'>Imię Nazwisko</p>
                            <p className='text-black text-[clamp(14px,1.2vw,16px)]'>adres@e-mail.pl</p>
                        </div>
                        <p className='text-[#6C6C6C] text-[13px] mt-1 group-hover:text-black transition-colors'>
                            Zaloguj się, aby zobaczyć dane konta
                        </p>
                    </div>
                </button>
            </div>

            <div className='flex flex-col lg:items-end items-center gap-3'>
                <h2 className='font-medium text-black text-[clamp(30px,2.1vw,40px)]'>Cześć!</h2>
                <p className='text-[#6C6C6C] text-[14px] max-w-[420px] lg:text-right text-center'>
                    Twoje polubione produkty zapisujemy na tym urządzeniu. Zaloguj się, żeby mieć je
                    na koncie, śledzić zamówienia i szybciej płacić.
                </p>
                
            </div>
        </div>
    )
}

export default ProfileContainer
