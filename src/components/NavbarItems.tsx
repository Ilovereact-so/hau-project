'use client'
import React, { useEffect, useRef } from 'react'
import {motion, useScroll, useTransform} from 'framer-motion'

const NavbarItems = ({ className, id , children}: { className?: string, id?: string, children: React.ReactNode }) => {
    const navbarScrollRef = useRef<HTMLDivElement>(null);
    const {scrollX, scrollXProgress} = useScroll({
        container: navbarScrollRef,
        offset: ["start start", "end end"]
        
    })  
    const opacity = useTransform(scrollXProgress, (pos)=> {
        return pos > 0.05 ? 1 : 0
    })
    const opacity2 = useTransform(scrollXProgress, (pos)=> {
        return pos < 0.9 ? 1 : 0
    })
    useEffect(() => {
        const unsubscribe = scrollXProgress.on("change", (latest) => {
        console.log("scrollX:", latest); // wypisze wartość 0–1 w czasie scrollowania
    });

        return () => unsubscribe(); // sprzątanie
    }, [scrollXProgress]);
    return (
    <motion.div ref={navbarScrollRef} className={className} id={id}>
        <motion.div style={{ opacity }} className='2lg:hidden sticky z-20 top-0 left-[-5px] w-auto h-[40px] ease-in-out duration-300'>
            <div className='backdrop-blur-[1px] bg-gradient-to-r from-[#73b9ad] from-30% to-transparent absolute w-[40px] h-full rounded-l-[39px] rounded-r-[10px]'></div>
        </motion.div>
        {children}
        <motion.div style={{ opacity: opacity2 }} className='2lg:hidden sticky z-20 top-0 right-[-5px] w-auto h-[40px] ease-in-out duration-300'>
            <div className='backdrop-blur-[1px] bg-gradient-to-l from-[#73b9ad] from-30% to-transparent absolute w-[40px] h-full rounded-r-[39px] rounded-l-[10px]'></div>
        </motion.div>
    </motion.div>
  )
}

export default NavbarItems