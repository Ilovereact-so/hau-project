'use client'
import React, { useEffect, useState } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { useMediaQuery } from '@/hooks/useMediaQuery';

// NavbarItems odpowiada za:
// - wrapper scroll kontenera (ref przekazany z rodzica)
// - fade-wskaźniki TYLKO na mobile (max-sm) przy scroll pionowym
// - na desktop (sm+) fade i strzałki obsługuje NavRMenu

const NavbarItems = ({
    className,
    id,
    children,
    ref,
    mode,
}: {
    className?: string
    id?: string
    children: React.ReactNode
    ref: React.Ref<HTMLDivElement | null>
    mode?: number
}) => {
    const mobileNav = useMediaQuery('(max-width: 639px)');

    // Scroll progress potrzebny tylko dla mobile fade (oś Y)
    const { scrollYProgress } = useScroll({
        container: ref as React.RefObject<HTMLElement>,
        offset: ['start start', 'end end'],
    });

    // Fade górny – pojawia się gdy użytkownik przewinął w dół
    const opacityTop = useTransform(scrollYProgress, (pos) => (pos > 0.05 ? 1 : 0));
    // Fade dolny – znika gdy użytkownik dobrnął do końca
    const opacityBottom = useTransform(scrollYProgress, (pos) => (pos < 0.9 ? 1 : 0));

    // Mobile fade renderujemy tylko gdy: jesteśmy na mobile + mode !== 1
    const showMobileFade = mobileNav && mode !== 1;

    return (
        <motion.div ref={ref} className={className} id={id}>

            {/* Fade górny – tylko mobile mode 0 */}
            {showMobileFade && (
                <motion.div
                    style={{ opacity: opacityTop }}
                    className="sticky z-20 top-0 left-0 w-full min-h-[49px] ease-in-out duration-300 flex"
                >
                    <div className="bg-gradient-to-b from-black/40 from-30% to-transparent min-h-[49px] absolute w-full h-full rounded-b-[5px] rounded-t-[10px]" />
                </motion.div>
            )}

            {children}

            {/* Fade dolny – tylko mobile mode 0 */}
            {showMobileFade && (
                <motion.div
                    style={{ opacity: opacityBottom }}
                    className="sticky z-20 bottom-0 left-0 w-full min-h-[49px] ease-in-out duration-300 flex"
                >
                    <div className="bg-gradient-to-t from-black/40 from-30% to-transparent min-h-[49px] absolute right-0 top-[50%] translate-y-[-50%] w-full h-full rounded-t-[5px] rounded-b-[10px]" />
                </motion.div>
            )}

        </motion.div>
    );
}

export default NavbarItems