'use client'
import React, { useEffect, useRef, useState } from 'react'
import {motion, useMotionValueEvent, useScroll, useTransform} from 'framer-motion'
import useMediaQuery from '@/hooks/useMediaQuery';

const NavbarItems = ({ className, id , children, ref}: { className?: string, id?: string, children: React.ReactNode, ref: React.Ref<HTMLDivElement | null> }) => {
    
    const mobile = useMediaQuery('(max-width: 1059px)');
    const mobileNav = useMediaQuery('(max-width: 639px)');

    const {scrollX, scrollXProgress, scrollYProgress, scrollY} = useScroll({
        container: ref as React.RefObject<HTMLElement>,
        offset: ["start start", "end end"]
        
    })  
    const opacity = useTransform(!mobileNav ? scrollXProgress : scrollYProgress, (pos)=> {
        return pos > 0.05 && scrollY.get() != 0 ? 1 : 0
    })
    const opacity2 = useTransform(!mobileNav ? scrollXProgress : scrollYProgress, (pos)=> {
        return pos < 0.9 ? 1 : 0
    })

    return (
    <motion.div ref={ref} className={className} id={id}>
        {mobile && 
            <motion.div style={{ opacity }} className='max-lg:flex max-sm:flex hidden sticky z-20 top-0 sm:left-[-5px] left-0 w-auto sm:min-h-[40px] min-h-[25px] ease-in-out duration-300'>
                <div className='sm:backdrop-blur-[1px] sm:bg-gradient-to-r bg-gradient-to-b sm:from-[#73b9ad] from-black/40 from-30% to-transparent absolute sm:w-[40px] w-full h-full sm:rounded-l-[39px] sm:rounded-r-[10px] max-sm:rounded-b-[5px] max-sm:rounded-t-[10px]'></div>
            </motion.div>
    }  
        {children}
        {mobile && 
            <motion.div style={{ opacity: opacity2 }} className='max-lg:flex max-sm:flex hidden sticky z-20 sm:top-0 max-sm:bottom-0 sm:right-[-5px] max-sm:left-0 sm:w-auto w-full sm:min-h-[40px] min-h-[25px] ease-in-out duration-300'>
                <div className='sm:backdrop-blur-[1px] sm:bg-gradient-to-l bg-gradient-to-t sm:from-[#73b9ad] from-black/40 from-30% to-transparent absolute sm:w-[40px] w-full h-full sm:rounded-r-[39px] sm:rounded-l-[10px] max-sm:rounded-t-[5px] max-sm:rounded-b-[10px]'></div>
            </motion.div>
        }
    </motion.div>
  )
}

export default NavbarItems