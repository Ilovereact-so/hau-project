'use client'
import Image from 'next/image'
import React from 'react'
import {motion} from 'framer-motion'
import { SignOutButton } from '@clerk/nextjs'
import Link from 'next/link'

const UserIcon = ({ avatarUrl, mode }: { avatarUrl: string, mode:number }) => {
    const [isMouseOver, setMouseOver] = React.useState(false);
    let globalDelay = 0.1;
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

    return (
    <div onMouseEnter={()=>setMouseOver(true)} onMouseLeave={() => setMouseOver(false)} className={`px-1.5 py-2 ease-in-out duration-300  ${
        mode === 1 ? "relative":""
    }`}>
        <motion.div initial={{height:0}} variants={variants} animate={isMouseOver ? "borderOpen" : "borderClosed"} className={`w-full absolute top-0 left-0 z-[-1] overflow-hidden`}>
            <div className='bg-fancy-black rounded-t-[35px] min-h-[60px]'></div>
        </motion.div>
        <Image src={avatarUrl} alt='avatar' width={30} height={30} className='w-[30px] h-[30px] rounded-full'/>
        <motion.div initial={{height:0}} variants={variants} animate={isMouseOver ? "tunelOpen" : "tunelClosed"} className='absolute bg-fancy-black h-[10px] w-full top-[100%] left-0'></motion.div>
        <motion.div initial={{height:0}} variants={variants} animate={isMouseOver ? "shadowOpen":"shadowClosed"}  className='absolute w-full h-[20px] left-[-100%] top-[calc(100%-10px)] overflow-hidden'>
            <div className='absolute top-0 right-0 w-full h-full sh-rounded-product-card rounded-br-[30px]'></div>
        </motion.div>
        
        <motion.div initial={{height:0}} variants={variants} animate={isMouseOver ? "ListOpen" : "ListClosed"} className=' w-auto min-w-[100px] absolute right-0 top-[calc(100%+10px)] overflow-hidden flex flex-col justify-start z-4'>
            <div className='bg-fancy-black rounded-b-[24px] rounded-tl-[24px] w-full min-h-[120px] flex flex-col justify-between px-3 py-2'>
                <div className='text-white text-[clamp(14px,1.3vw,15px)] flex flex-col px-2 py-1 text-nowrap mt-1 space-y-1'>
                    <h1>Moje konto</h1>
                    <Link href="/wishlist" ><h1>Polubione</h1></Link>
                    
                </div>
                <SignOutButton>
                    <div className='font-bold px-5 py-2 text-white bg-black rounded-full text-[14px] text-nowrap'>Wyloguj się</div>
                </SignOutButton>
            </div>
        </motion.div>
    </div>
  )
}

export default UserIcon