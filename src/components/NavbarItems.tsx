'use client'
import React from 'react'
import { motion } from 'framer-motion'

// NavbarItems to wrapper scroll kontenera (ref przekazany z rodzica).
// `edgeFade` maskuje górną/dolną krawędź kontenera gradientem koloru->transparent
// (mask-image), dzięki czemu itemy (i panel podkategorii, bo jest w tym samym
// kontenerze na mobile) płynnie znikają wjeżdżając/wyjeżdżając poza widoczny obszar
// scrolla — bez przyciemniania, czysto przez maskę, więc jest odporne na zmiany
// wysokości listy przy otwieraniu/zamykaniu akordeonu.
const EDGE_FADE_SIZE = 40; // px

const NavbarItems = ({
    className,
    id,
    children,
    ref,
    edgeFade,
}: {
    className?: string
    id?: string
    children: React.ReactNode
    ref: React.Ref<HTMLDivElement | null>
    mode?: number
    edgeFade?: boolean
}) => {
    const maskImage = edgeFade
        ? `linear-gradient(to bottom, transparent 0, black ${EDGE_FADE_SIZE}px, black calc(100% - ${EDGE_FADE_SIZE}px), transparent 100%)`
        : undefined;

    return (
        <motion.div
            ref={ref}
            className={className}
            id={id}
            style={edgeFade ? { WebkitMaskImage: maskImage, maskImage } : undefined}
        >
            {children}
        </motion.div>
    );
}

export default NavbarItems
