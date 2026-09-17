import { useMediaQuery } from '@/hooks/useMediaQuery';
import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom';

type Props = {
    anchorRef: React.RefObject<HTMLDivElement | null>;
    children: React.ReactNode
    query: string,
    results: any[],
    loading: boolean
    showSearchBar: boolean | undefined
}
const SearchPortal = ({children, anchorRef, query: _query, results: _results, loading: _loading, showSearchBar}:Props) => {
    const elRef = useRef<HTMLDivElement | null>(null);
    const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
    const mediumScreen = useMediaQuery('(max-width: 1160px)');

    // Portal-owy div tworzymy raz, od razu przy mouncie — bez setTimeout. Poprzednia
    // wersja czekała 220ms zanim go w ogóle stworzyła, a return wewnątrz setTimeout
    // nigdy nie działał jako cleanup efektu, więc element zostawał w document.body
    // po odmontowaniu (wyciek). elRef to ref (nie state), więc samo jego ustawienie
    // tu nie wymusza re-rendera — ale poniższy efekt i tak zaraz woła setPos(...),
    // co przerenderuje komponent i wtedy elRef.current jest już gotowe.
    useEffect(() => {
        const el = document.createElement("div");
        document.body.appendChild(el);
        elRef.current = el;
        return () => {
            document.body.removeChild(el);
        };
    }, []);

    useEffect(() => {
        const anchor = anchorRef.current;
        if (!anchor) return;

        const updatePosition = () => {
            const rect = anchor.getBoundingClientRect();
            // Anchor schowany przez CSS (np. wrapper z klasą "hidden"/"md:hidden" —
            // dwie wersje search bara zamontowane naraz, widoczność rozstrzyga
            // breakpoint) ma getBoundingClientRect() z samymi zerami. Bez tego guarda
            // portal i tak renderował swoje dzieci (React portal wychodzi poza
            // hidden/display:none rodzica fizycznie w document.body), więc dostawaliśmy
            // widmowy drugi kontener przyklejony do top:0/left:0. Traktujemy zerowy
            // rozmiar jako "jeszcze/już nie gotowe" i nic nie renderujemy.
            if (rect.width === 0 && rect.height === 0) {
                setPos(null);
                return;
            }
            setPos({
                top: rect.bottom + window.scrollY,
                left: rect.left + window.scrollX,
                width: rect.width,
            });
        };

        updatePosition();

        // Anchor animuje padding w SearchBarContext (framer-motion) — to realna
        // zmiana box modelu na każdej klatce, więc ResizeObserver łapie ją
        // klatka po klatce i pozycja portalu nadąża za animacją, zamiast zgadywać
        // setTimeoutem ile ta animacja trwa (i psuć się przy każdej zmianie jej
        // długości/easingu).
        const ro = new ResizeObserver(updatePosition);
        ro.observe(anchor);

        window.addEventListener("scroll", updatePosition, true);
        window.addEventListener("resize", updatePosition);
        return () => {
            ro.disconnect();
            window.removeEventListener("scroll", updatePosition, true);
            window.removeEventListener("resize", updatePosition);
        };
    }, [anchorRef, showSearchBar]);

    if (!elRef.current || !pos) return null;
    const style: React.CSSProperties = {
        position: "absolute",
        top: pos.top,
        left: mediumScreen ? 0 : pos.left,
        minWidth: pos.width,
        zIndex: 9999,
    };

    return createPortal(
    <div style={style} className={` ${
        showSearchBar ? "max-3lg:w-full max-3lg:px-4 flex ":"max-3lg:w-full max-3lg:px-4"
    }`}>
        {children}
    </div>,
    elRef.current

  )
}

export default SearchPortal