'use client'
import React, { useEffect, useState } from 'react'
import {motion, useScroll, useTransform} from 'framer-motion'
import useMediaQuery from '@/hooks/useMediaQuery';

const NavbarItems = ({ className, id , children, ref, mode}: { className?: string, id?: string, children: React.ReactNode, ref: React.Ref<HTMLDivElement | null>, mode?: number }) => {
    
    const mobile = useMediaQuery('(max-width: 1059px)');
    const mobileNav = useMediaQuery('(max-width: 639px)');

    const {scrollX, scrollXProgress, scrollYProgress, scrollY} = useScroll({
        container: ref as React.RefObject<HTMLElement>,
        offset: ["start start", "end end"]
        
    })  
    
    const hasScrollX = useHasHorizontalScroll(ref as React.RefObject<HTMLElement>);
    const opacity = useTransform(!mobileNav ? scrollXProgress : scrollYProgress, (pos)=> {
        return pos > 0.05 && (mode == 1 ? true : !mobile ?  scrollY.get()!= 0 : true) ? 1 : 0
    })
    const opacity2 = useTransform(!mobileNav ? scrollXProgress : scrollYProgress, (pos)=> {
        return pos < 0.9 ? 1 : 0
    })
    

    return (
    <motion.div ref={ref} className={className} id={id}>
        {hasScrollX && 
            <motion.div style={{ opacity }} className={`sticky z-20 top-0 sm:left-[-5px] left-0 sm:w-auto w-full sm:min-h-[40px] min-h-[25px] ease-in-out duration-300 ${
                mode === 1 ? "flex":"max-lg:flex max-sm:flex hidden"
            }`}>
                <div className='sm:backdrop-blur-[1px] sm:bg-gradient-to-r bg-gradient-to-b sm:from-[#73b9ad] from-black/40 from-30% to-transparent absolute sm:w-[40px] w-full h-full sm:rounded-l-[39px] sm:rounded-r-[10px] max-sm:rounded-b-[5px] max-sm:rounded-t-[10px]'></div>
            </motion.div>
    }  
        {children}
        {hasScrollX && 
            <motion.div style={{ opacity: opacity2 }} className={`sticky z-20 sm:top-0 max-sm:bottom-0 translate-x-[40px] max-sm:left-0 sm:w-0 w-full sm:min-h-[40px] min-h-[25px] min-w-[0px] ease-in-out duration-300 ${
                mode === 1 ? "flex sm:right-[-5px]":" hidden sm:right-[35px] "
            }`}>
                <div className='sm:backdrop-blur-[1px] sm:bg-gradient-to-l bg-gradient-to-t sm:from-[#73b9ad] from-black/40 from-30% to-transparent absolute right-0 sm:w-[40px] w-full h-full sm:rounded-r-[39px] sm:rounded-l-[10px] max-sm:rounded-t-[5px] max-sm:rounded-b-[10px]'></div>
            </motion.div>
        }
    </motion.div>
  )
}

function useHasHorizontalScroll(ref: React.RefObject<HTMLElement>) {
  const [hasScrollX, setHasScrollX] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const check = () => {
      setHasScrollX(el.scrollWidth > el.clientWidth);
    };

    check();

    const ro = new ResizeObserver(() => {
      check();
    });
    ro.observe(el);

    window.addEventListener("resize", check);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", check);
    };
  }, [ref]);

  return hasScrollX;
}

export default NavbarItems