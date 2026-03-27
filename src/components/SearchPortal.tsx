import { useMediaQuery } from '@/hooks/useMediaQuery';
import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom';

type Props = {
    anchorRef: React.RefObject<HTMLDivElement | null>;
    children: React.ReactNode
    query: string,
    results: any[],
    loading: boolean
}
const SearchPortal = ({children, anchorRef, query, results, loading}:Props) => {
    const elRef = useRef<HTMLDivElement | null>(null);
    const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
    const mediumScreen = useMediaQuery('(max-width: 1023px)');;
    
    useEffect(() => {
        const el = document.createElement("div");
        document.body.appendChild(el);
        elRef.current = el;
        return () => {
          document.body.removeChild(el);
        };
    }, [query]);
     useEffect(() => {
        const updatePosition = () => {
            const anchor = anchorRef.current;
            if (!anchor) return;
            const rect = anchor.getBoundingClientRect();
            //console.log(anchor,rect)
            setPos({
                top: rect.bottom + window.scrollY,
                left: rect.left + window.scrollX,
                width: rect.width,
        });
        };
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
    },[anchorRef, query])
    
    if (!elRef.current || !pos) return null;
    const style: React.CSSProperties = {
        position: "absolute",
        top: pos.top,
        left: mediumScreen ? (results.length === 0 || loading ? pos.left : 0) : pos.left,
        minWidth: pos.width,
        zIndex: 9999,
    };

    return createPortal(
    <div style={style} className={` ${
        results.length === 0 || loading ? "":"max-lg:w-full max-lg:px-4"
    }`}>
        {children}
    </div>,
    elRef.current

  )
}

export default SearchPortal