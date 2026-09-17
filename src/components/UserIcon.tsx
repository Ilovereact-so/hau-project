'use client'
import Image from 'next/image'
import React from 'react'
import {motion} from 'framer-motion'
import Link from 'next/link'
import { Lock, User } from 'lucide-react'
import { useAuthModalStore } from '@/store/authModalStore'
import { useSafeSignOut } from '@/hooks/useSafeSignOut'

type Props = {
    /** brak = gość */
    avatarUrl?: string | null
    mode: number
    card?: boolean
}

// Ikona konta w navbarze. Zalogowany: avatar + menu (konto, polubione, wyloguj).
// Gość: ikona prowadzi do profilu (wishlista gościa), menu ma polubione,
// przydymione "Moje konto" i przycisk logowania.
const UserIcon = ({ avatarUrl, mode, card }: Props) => {
    const isGuest = !avatarUrl
    const [isMouseOver, setMouseOver] = React.useState(false);
    const openModal = useAuthModalStore(s => s.openModal)
    const { signOut, pending } = useSafeSignOut()
    const globalDelay = 0.1;
    const variants = {
        borderOpen: { height: "100%", transition: { duration: 0.3 , delay: globalDelay} },
        borderClosed: { height: 0, transition: { duration: 0.2 , delay: 0.3 + 0.1 } },
        tunelOpen: { height: 10, transition: { duration: 0.1 , delay: globalDelay + 0.3 } },
        tunelClosed: { height: 0, transition: { duration: 0.1 , delay: 0.3 } },
        shadowOpen: { height: 20, transition: { duration: 0.2, delay: 0.21 + globalDelay } },
        shadowClosed: { height: 0, transition: { duration: 0.2 , delay: 0.3 } },
        ListOpen: { height: 120,width:"auto",  transition: { duration: 0.3 , delay: globalDelay + 0.5}},
        ListClosed: { height: 0, width: mode === 1 ? 42 : "auto",  transition: { duration: 0.3 } },
        
        // textOpen:{opacity: 1, transition:{duration:0.3, delay:0.4 + globalDelay}},
        // textClosed:{opacity:0, transition:{duration:0.1}},
        // circleOpen:{backgroundColor: "#f6f6f62e", transition:{duration:0.3, delay:0.1 + globalDelay}},
        // circleClosed:{backgroundColor: "#f6f6f600", transition:{duration:0.3}},
    }
    const open = (card?: boolean) => {
        if(card){
            document.getElementById("menu_dock_container")?.style.setProperty("border-radius", "24px 24px 0px 0px");
        }
    }
    const close = (card?: boolean) => {
        if(card){
            setTimeout(() => {
                document.getElementById("menu_dock_container")?.style.setProperty("border-radius", "24px");
            }, 300);
        }
    }
    return (
    <div onMouseEnter={()=>{setMouseOver(true); open(card);}} onTouchStart={()=>{setMouseOver(true); open(card);}} onTouchEnd={() => {setMouseOver(false); close(card);}} onMouseLeave={() => {setMouseOver(false); close(card);}} className={`ease-in-out duration-300 font-poppins px-1.5 ${mode === 1 ? "relative py-1.5":"lg:pl-4.5 pl-3.5 lg:py-3 py-2 "}`}>
        <motion.div initial={{height:0}} variants={variants} animate={isMouseOver ? "borderOpen" : "borderClosed"} className={`w-full absolute top-0 left-0 z-[-1] overflow-hidden`}>
            <div className='bg-fancy-black rounded-t-[35px] min-h-[60px]'></div>
        </motion.div>
        {isGuest ? (
           <div className="w-[30px] h-[30px] min-w-[30px] min-h-[30px] flex justify-center items-center">
                <User size={26} className={`lg:min-w-[25px] min-w-[20px] lg:min-h-[25px] min-h-[20px] stroke-[1.4px]  hover:text-main transition-colors ${
                    isMouseOver ? "text-white" : mode === 1 ? "sm:text-black text-white" : "text-white"
                }`}/>
           </div>
           
        ) : (
            <Image src={avatarUrl} alt='avatar' width={30} height={30} className='w-[30px] h-[30px] min-w-[30px] min-h-[30px] rounded-full'/>
        )}
        <motion.div initial={{height:0}} variants={variants} animate={isMouseOver ? "tunelOpen" : "tunelClosed"} className={`absolute bg-fancy-black h-[10px] top-[100%] ${
            card ? "left-0 sm:w-full w-[87px]":"sm:left-0 max-sm:right-[-51px] sm:w-full w-[146px]"
        }`}></motion.div>
        <motion.div initial={{height:0}} variants={variants} animate={isMouseOver ? "shadowOpen":"shadowClosed"}  className={`absolute w-[20px] h-[20px] overflow-hidden  ${
            card ? "left-[-100%] top-[calc(100%-10px)] w-full":"sm:left-[-100%] sm:top-[calc(100%-10px)] top-[calc(100%-4px)] right-[calc(-100%+24px)] max-sm:scale-[-1] max-sm:rounded-bl-[9px] sm:w-full"
        }`}>
            <div className='absolute top-0 right-0 w-full h-full sh-rounded-product-card rounded-br-[30px]'></div>
        </motion.div>
        
        <motion.div initial={{height:0}} variants={variants} animate={isMouseOver ? "ListOpen" : "ListClosed"} className={` w-auto sm:min-w-[100px] min-w-[146px] absolute top-[calc(100%+10px)] overflow-hidden flex flex-col justify-start z-3 ${
            card ? "sm:right-0 right-[-45px]":"sm:right-0 right-[-51px]"
        }`}>
            <div className={`bg-fancy-black rounded-b-[24px] w-full min-h-[120px] flex flex-col justify-between px-3 py-2 ${
               card ? "rounded-tl-[24px]":"sm:rounded-tl-[24px]" 
            }`}>
                <div className='text-white 2xl:text-[16px] text-[clamp(14px,1.3vw,15px)] flex flex-col px-2 py-1 text-nowrap mt-1 space-y-1'>
                    {isGuest ? (
                        <button
                            type='button'
                            onClick={() => openModal('signIn', { redirectTo: '/profile/account' })}
                            title='Zaloguj się, aby zobaczyć konto'
                            className='flex items-center gap-1.5 text-white/40 hover:text-white/70 transition-colors cursor-pointer text-left'
                        >
                            Moje konto <Lock className='w-3 h-3' aria-hidden />
                        </button>
                    ) : (
                        <Link href="/profile/account"><h1 className=''>Moje konto</h1></Link>
                    )}
                    <Link href="/profile/wishlist" ><h1 className=''>Polubione</h1></Link>
                </div>
                {isGuest ? (
                    <button
                        type='button'
                        onClick={() => openModal('signIn')}
                        className='font-semibold px-5 py-2 text-black bg-main rounded-full 2xl:text-[15px] text-[14px] text-nowrap cursor-pointer'
                    >
                        Zaloguj się
                    </button>
                ) : (
                    <button
                        type='button'
                        onClick={() => signOut('/')}
                        disabled={pending}
                        className='font-semibold px-5 py-2 text-white bg-black rounded-full 2xl:text-[15px] text-[14px] text-nowrap cursor-pointer disabled:opacity-60'
                    >
                        Wyloguj się
                    </button>
                )}
            </div>
        </motion.div>
    </div>
  )
}

export default UserIcon