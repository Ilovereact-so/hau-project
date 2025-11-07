'use client'
import React, { useEffect, useRef } from 'react'
import {motion, useScroll, useTransform} from 'framer-motion'
import useMediaQuery from '@/hooks/useMediaQuery';

const NavbarItems = ({ className, id , children, ref}: { className?: string, id?: string, children: React.ReactNode, ref: React.Ref<HTMLDivElement | null> }) => {
    
    const mobile = useMediaQuery('(max-width: 1059px)');
    const {scrollX, scrollXProgress} = useScroll({
        container: ref as React.RefObject<HTMLElement>,
        offset: ["start start", "end end"]
        
    })  
    const opacity = useTransform(scrollXProgress, (pos)=> {
        return pos > 0.05 ? 1 : 0
    })
    const opacity2 = useTransform(scrollXProgress, (pos)=> {
        return pos < 0.9 ? 1 : 0
    })

    return (
    <motion.div ref={ref} className={className} id={id}>
        {mobile && 
            <motion.div style={{ opacity }} className='max-lg:flex max-sm:hidden hidden sticky z-20 top-0 left-[-5px] w-auto h-[40px] ease-in-out duration-300'>
                <div className='backdrop-blur-[1px] bg-gradient-to-r from-[#73b9ad] from-30% to-transparent absolute w-[40px] h-full rounded-l-[39px] rounded-r-[10px]'></div>
            </motion.div>
    }  
        {children}
        {mobile && 
            <motion.div style={{ opacity: opacity2 }} className='max-lg:flex max-sm:hidden hidden sticky z-20 top-0 right-[-5px] w-auto h-[40px] ease-in-out duration-300'>
                <div className='backdrop-blur-[1px] bg-gradient-to-l from-[#73b9ad] from-30% to-transparent absolute w-[40px] h-full rounded-r-[39px] rounded-l-[10px]'></div>
            </motion.div>
        }
    </motion.div>
  )
}

export default NavbarItems