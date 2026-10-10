'use client'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import NavHamburger from './NavHamburger'
import NavbarItems from './NavbarItems'
import { GUIDES_NAV } from '@/constants'
import { filterProductCategories } from '@/lib/categoryNavigation'
import Link from 'next/link'
import { ArrowLeft, BookOpen, Search } from 'lucide-react'
import Image from 'next/image'
import { animate, AnimatePresence, motion } from 'framer-motion'
import {useMediaQuery} from '@/hooks/useMediaQuery'
import SubmenuPortal from './SubmenuPortal'
import SearchBarContext from './SearchBarContext'
import { CategoryNode } from '@/hooks/categories'
import { usePathname } from 'next/navigation'

const NavRMenu = ({ className, style, mode, categories, initialMobile = false}: { className: string, style: React.CSSProperties, mode: number, categories: CategoryNode[], initialMobile?: boolean }) => {
    // initialMobile — podpowiedź z middleware (User-Agent) przekazana z serwera,
    // żeby pierwszy render (SSR i pierwszy client render) od razu trafiał w
    // poprawny wariant. Realna detekcja przez matchMedia nadal działa tak samo
    // i przejmuje kontrolę po zamontowaniu / przy resize.
    const mobile  = useMediaQuery('(max-width: 639px)', initialMobile);

    // Jedyne źródło prawdy dla "navbar ma wyglądać jak mode 0 mobile" — to realny
    // mobile breakpoint (639px), ten sam dla obu mode'ów. Mode 1 w zakresie
    // 640–768px ma wyglądać DOKŁADNIE jak mode 1 powyżej 768px (poziome strzałki,
    // te same kolory) — jedyna różnica w tym zakresie dotyczy samego search bara
    // (ikonka zamiast pełnego paska, patrz render niżej — to rozstrzyga czysty CSS
    // breakpoint md:, nie JS, żeby uniknąć błysku złej wersji przy SSR na desktopowej
    // szerokości okna — matchMedia nie ma jak znać realnej szerokości okna zanim się
    // zamontuje, w przeciwieństwie do CSS, który liczy to od razu przy malowaniu).
    const isCompact = mobile;

    // Na mobile mode 1 ma wyglądać i działać tak jak mode 0 (pionowe menu, inline search bar
    // zamiast osobnego stałego paska, te same kolory/layout) — więc do WSZYSTKICH decyzji
    // stylistycznych/layoutowych (i do propsów `mode` przekazywanych w dół) używamy themeMode
    // zamiast surowego `mode`. Prawdziwe `mode` zostaje tylko tam, gdzie chodzi o realną
    // strukturę strony (np. efekt celujący w #navbar2, który istnieje tylko przy mode===1
    // niezależnie od tego, jak menu ma wyglądać).
    const themeMode = isCompact ? 0 : mode;

    // Panel (hamburger/search) zawsze startuje zamknięty — było `!mobile ? false : true`,
    // czyli na mobile menu ładowało się OTWARTE i od razu blokowało scroll strony
    // (patrz efekt niżej, który ustawia document.body.style.overflow na podstawie openMenu).
    const [openMenu, setOpenMenu] = useState<boolean>(false);
    const navbarRef = useRef<HTMLDivElement>(null);
    const [showSearchBar, setShowSearchBar] = useState<boolean>(false);

    // Przejście na inną stronę (kategoria, podkategoria) zamyka panel menu na
    // telefonie — layout z menu zostaje zamontowany między stronami tej samej
    // grupy tras, więc bez tego menu zostawało otwarte nad nową stroną.
    const pathname = usePathname();
    useEffect(() => {
        setOpenMenu(false);
    }, [pathname]);

    // Poradniki przestały być kategorią produktową — mają własną sekcję w Sanity
    // (typ `guide`) i własną podstronę /poradniki, więc znikają z listy kategorii
    // i wracają niżej jako osobny, wyróżniony link. filterProductCategories jest
    // zabezpieczeniem na wypadek, gdyby stary dokument `category` "Poradniki"
    // nadal siedział w datasecie — bez tego menu dalej pokazywałoby pustą kategorię.
    const visibleCategories = React.useMemo(() => filterProductCategories(categories), [categories])

    const itemRefs = useRef([...Array(visibleCategories.length)].map(()=>React.createRef() as React.RefObject<HTMLLabelElement>))
    // Uwaga: tu celowo `mobile` (realny próg), nie `isCompact` — to dotyczy fokusu/przesunięcia
    // logo przy pionowej liście kategorii za hamburgerem, a ta na mode 1 + md ma zostać
    // pozioma (strzałki), więc nie powinno się aktywować w tym zakresie szerokości.
    const autoMenu = useCallback(() => {
        mobile && itemRefs.current[0]?.current?.focus()
    }, [mobile])
    useEffect(()=>{
        autoMenu()
        if(mode === 1){
            animate("#navbar2 > .navbar-logo", (openMenu && mobile)  ?{ x:"50%"}: { x:0},{duration:0.3, ease:"easeOut"})
        }
        if((openMenu && mobile) || (showSearchBar)){
            document.body.style.overflow = "hidden"
        }else{
            document.body.style.overflow = "auto"
        }
    },[autoMenu, mobile, mode, openMenu, showSearchBar])

    // Opóźnienie otwarcia panelu po najechaniu. Krótkie, ale niezerowe — chroni
    // przed „mruganiem” paneli, gdy kursor tylko przejeżdża przez menu.
    // (Było 0.2 s + kolejne opóźnienia elementów, przez co lista podkategorii
    // pokazywała się dopiero po ~0,9 s — feedback: za wolno przy zakupach.)
    const globalDelay = 0.06

    const [isHover, setIsHover] = useState<boolean>(false)

    // ── Strzałki przewijania (mode===1 zawsze, mode===0 tylko desktop) ────────
    const [canScrollLeft, setCanScrollLeft]   = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
    const scrollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const checkNavScroll = () => {
        const el = navbarRef.current;
        if (!el) return;
        setCanScrollLeft(el.scrollLeft > 1);
        setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    };

    useEffect(() => {
        // `mobile` (realny próg), nie `isCompact` — strzałki i poziomy scroll kategorii
        // mają zostać aktywne na mode 1 + md (tabletowa szerokość), dokładnie tak jak
        // wygląda mode 0 przy tej samej szerokości (mode 0 też pokazuje wtedy strzałki,
        // bo realnie nie jest mobile). isCompact zawężałoby to tylko do prawdziwego
        // mobile i chowało strzałki na rzecz pionowej listy, czego tu nie chcemy.
        const arrowsActive = themeMode === 1 || (themeMode === 0 && !mobile);
        if (!arrowsActive) {
            // Reset stanu gdy strzałki nieaktywne (np. zmiana na mobile)
            setCanScrollLeft(false);
            setCanScrollRight(false);
            return;
        }
        const el = navbarRef.current;
        if (!el) return;

        // Blokada kółka myszy i dotyku
        const blockWheel = (e: WheelEvent) => e.preventDefault();
        const blockTouch = (e: TouchEvent) => e.preventDefault();
        el.addEventListener("wheel",     blockWheel, { passive: false });
        el.addEventListener("touchmove", blockTouch, { passive: false });

        // Pierwsze sprawdzenie dopiero po wyrenderowaniu layoutu
        const rafId = requestAnimationFrame(() => checkNavScroll());

        el.addEventListener("scroll", checkNavScroll);
        const ro = new ResizeObserver(() => checkNavScroll());
        ro.observe(el);
        window.addEventListener("resize", checkNavScroll);

        return () => {
            cancelAnimationFrame(rafId);
            el.removeEventListener("wheel",     blockWheel);
            el.removeEventListener("touchmove", blockTouch);
            el.removeEventListener("scroll",    checkNavScroll);
            ro.disconnect();
            window.removeEventListener("resize", checkNavScroll);
        };
    }, [themeMode, mobile]);

    const scrollNavBy = (dir: 1 | -1) => {
        navbarRef.current?.scrollBy({ left: dir * 160, behavior: "smooth" });
        setTimeout(checkNavScroll, 350);
    };

    const startScrollInterval = (dir: 1 | -1) => {
        scrollIntervalRef.current = setInterval(() => {
            navbarRef.current?.scrollBy({ left: dir * 4 });
            checkNavScroll();
        }, 16);
    };

    const stopScrollInterval = () => {
        if (scrollIntervalRef.current) {
            clearInterval(scrollIntervalRef.current);
            scrollIntervalRef.current = null;
        }
    };
    // ────────────────────────────────────────────────────────────────────────

    // Stan „kursor nad którąś kategorią” dla nakładki obok menu (mode 0).
    // Nasłuchy zakładamy RAZ na zamontowane zakładki. Wcześniej funkcja była
    // wołana przy każdym najechaniu i dokładała kolejne nasłuchy do wszystkich
    // zakładek (nigdy ich nie zdejmując) — po kilkudziesięciu ruchach myszą
    // każde wejście odpalało dziesiątki handlerów w trakcie animacji panelu.
    useEffect(() => {
        if (mode !== 0) return;
        const elements = itemRefs.current
            .map((ref) => ref.current)
            .filter((el): el is HTMLLabelElement => Boolean(el));

        const handleMouseEnter = () => setIsHover(true);
        const handleMouseLeave = (e: MouseEvent) => {
            const related = e.relatedTarget as Node | null;
            if (!related || !elements.some((el) => el.contains(related))) setIsHover(false);
        };

        elements.forEach((el) => {
            el.addEventListener("mouseenter", handleMouseEnter);
            el.addEventListener("mouseleave", handleMouseLeave);
        });
        return () => {
            elements.forEach((el) => {
                el.removeEventListener("mouseenter", handleMouseEnter);
                el.removeEventListener("mouseleave", handleMouseLeave);
            });
        };
    }, [mode, mobile, showSearchBar, visibleCategories]);

    const containerRef = useRef<HTMLDivElement | null>(null);
    const [_query, setQuery] = useState<string>("");

    // showSearBar odzwierciedla #search w pasku URL. Bazuje na natywnym evencie
    // "hashchange" zamiast pollingu/usePathname – odpala się tylko gdy hash faktycznie
    // się zmieni, więc jest to najtańszy możliwy sposób synchronizacji z URL-em.
    useEffect(() => {
        const checkHash = () => {
            const active = window.location.hash === "#search";
            setShowSearchBar(active);
            // Wyjście z wyszukiwania (X, "wstecz" przeglądarki, gest cofnięcia) usuwa
            // #search z hasha, ale samo nie zamykało panelu (openMenu) — a od niego
            // zależy document.body.style.overflow, więc strona zostawała bez scrolla.
            // if (!active) setOpenMenu(false);
        };
        checkHash();
        window.addEventListener("hashchange", checkHash);
        return () => window.removeEventListener("hashchange", checkHash);
    }, []);

    // Zamknięcie krzyżykiem ma robić dokładnie to co wciśnięcie "wstecz" w przeglądarce —
    // #search jest wpisem w historii (Link go pushuje), więc history.back() go zdejmuje
    // i odpala natywny "hashchange", który sam zaktualizuje showSearchBar przez listener wyżej.
    // Dzięki temu obie ścieżki zamykania (X i przypadkowe "wstecz" usera) są tym samym kodem
    // i nie zostawiają martwego wpisu w historii, do którego "wstecz" wracałoby po raz drugi.
    const closeSearchBar = () => {
        if (window.location.hash === "#search") {
            window.history.back();
            
        } else {
            setShowSearchBar(false);            
        }
    };

    // Otwieranie nie może iść przez <Link> – SearchBarContext renderuje własne <a> (wyniki
    // wyszukiwania), a HTML nie pozwala zagnieżdżać <a> w <a> (błąd hydracji). Robimy więc
    // to samo co Link ręcznie: pushState dodaje wpis w historii (żeby "wstecz"/closeSearchBar
    // nadal działały), a guard na hashu chroni przed pushowaniem kolejnych wpisów przy każdym
    // kliknięciu wewnątrz już otwartego search bara (np. w link produktu).
    const openSearchBar = () => {
        // Klik w cokolwiek wewnątrz JUŻ otwartego search bara (input, wyniki, chipy,
        // karty produktów) bąbelkuje do wrapperów z onClick={openSearchBar} w JSX
        // niżej. Bez tego guardu klik w kartę produktu — która najpierw zamyka panel
        // i zdejmuje #search (dismissSearchForNavigation) — po bąbelkowaniu
        // OTWIERAŁA panel od nowa: pushState("#search") wskrzeszał hash W TRAKCIE
        // in-flight nawigacji router.push. Efekt: RSC fetch 200 w terminalu, ale
        // URL zostaje na /#search i strona się nie zmienia. Gdy panel jest otwarty,
        // klik wewnątrz niego nie może niczego "otwierać".
        if (showSearchBar) return;
        if (window.location.hash !== "#search") {
            window.history.pushState(null, "", "#search");
        }
        setShowSearchBar(true);
        setOpenMenu(true)
    };

    // Zamknięcie search bara PO zatwierdzeniu wyszukiwania (Enter / lupa), gdy
    // SearchBarContext nawiguje na /search?q=...
    //
    // To musi być osobna ścieżka niż closeSearchBar(), bo tamto robi
    // window.history.back() — a wywołane przy okazji nawigacji cofało dopiero co
    // wypchniętą trasę /search i user zostawał na tej samej stronie. Dokładnie
    // stąd brało się "Enter nie przekierowuje".
    //
    // Zamiast cofać historię, zdejmujemy wpis "#search" przez replaceState:
    // podmienia BIEŻĄCY wpis (czyli /poprzednia#search → /poprzednia), więc po
    // wejściu na /search przycisk "wstecz" wraca na czystą poprzednią stronę
    // zamiast na taką z ponownie otwartym wyszukiwaniem.
    //
    // Panel zamykamy lokalnym stanem, bo listener wyżej reaguje wyłącznie na
    // natywny "hashchange", a router.push (history.pushState pod spodem) go nie
    // emituje — bez tego showSearchBar zostałby na true po nawigacji.
    const dismissSearchForNavigation = () => {
        if (window.location.hash === "#search") {
            window.history.replaceState(null, "", window.location.pathname + window.location.search);
        }
        setShowSearchBar(false);
        setOpenMenu(false);
    };

    const focusChanges = () => {};
    const blurChanges = () => {};

    return (
    <div className={className} style={style}>
            
        {/* Ten wiersz (ikonka search/wstecz + hamburger, w czarnej pigułce) jest widoczny
            tylko na realnym mobile (isCompact === mobile, ten sam próg dla obu mode'ów).
            Mode 1 w zakresie 640–768px NIE korzysta z tego wiersza — ma tam własną,
            osobną ikonkę search (rozstrzygane CSS-em, patrz render niżej). */}
        <div className={`flex justify-start transition-all ease-in-out duration-300 mb-0 relative z-10 ${
            themeMode === 1
                ? " w-auto pl-6"
                : `w-full rounded-r-[90px] ${isCompact ? "h-[46px] items-center bg-fancy-black pr-3 space-x-3 relative" : ""} `
        } ${
            openMenu && themeMode === 1 ? "translate-y-[-145%]":"translate-y-0 "
        } ${
            openMenu && themeMode === 0 && isCompact && "rounded-l-[40px] "
        }${
            mode === 1 ? " lg:mt-0 mt-3":" lg:mt-0 mt-6"
        }
        `}>
            <AnimatePresence mode="wait">
                {!showSearchBar ?
                <motion.div key="search-icon" initial={{ opacity: 1, zIndex:2 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: 'easeInOut' }}>
                    <Search onClick={()=>openSearchBar()} className={`relative text-white z-2 ${isCompact ? "inline-flex" : "hidden"}`}/>
                </motion.div>
                :
                <motion.div key="close-icon" initial={{ opacity: 0, zIndex:2 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: 'easeInOut' }}>
                    <ArrowLeft onClick={()=>closeSearchBar()} className={`relative text-white z-2 ${isCompact ? "inline-flex" : "hidden"}`} />
                </motion.div>
                }
            </AnimatePresence>
            <div className={`absolute top-0 -left-3 h-full w-5 overflow-hidden z-1  ${isCompact ? "inline-block" : "hidden"}`}>
                <div className={`w-[88px] h-full rounded-full ease-in-out duration-200 ${openMenu ? "bg-fancy-black" : "bg-transparent"}`}></div>
            </div>
            <NavHamburger isOpen={openMenu} onClick={() => {setOpenMenu(!openMenu); closeSearchBar()}} mode={themeMode} className={isCompact ? "inline-flex" : "hidden"}/>
        </div>

        <motion.div initial={{opacity:0, display:"none"}} animate={!mobile ? {opacity:0, display:"none"} : openMenu ? {opacity:1, display:"block"} : {opacity:0, display:"none"}} transition={{duration:0.3, delay:globalDelay}} className={`fixed top-0 left-0 w-full h-full bg-black/40  ${ themeMode === 1 ? "z-2 ": "z-2" }`}></motion.div>

        <div
            id='search-body'
            className={`flex max-sm:fixed top-0 left-0 sm:w-full w-[115%] max-sm:bg-gradient-to-r from-main/80 from-80% to-80% to-transparent max-sm:backdrop-blur-[4px] max-sm:h-[100dvh] max-sm:max-h-[100dvh] h-auto sm:px-0 px-6 max-sm:pl-[20vw] sm:pb-0 pb-5 transition-all ease-in-out duration-200 ${
                themeMode === 1 ? "justify-between  z-4":" z-4 "
            }${
                themeMode === 1 ? !mobile ? " flex-row ":" flex-col ":" flex-col "
            }${
                openMenu ? "max-sm:translate-x-[-15vw]":"max-sm:translate-x-[-115vw]"
            }`}>
            <motion.div onClick={()=>{setOpenMenu(false); closeSearchBar()}} initial={{opacity:0, display:"none"}} animate={!mobile ? isHover ? {opacity:1, display:"block"} : {opacity:0, display:"none"} : openMenu ? {opacity:1, display:"block"} : {opacity:0, display:"none"}} transition={{duration:0.3, delay:globalDelay}} className={`absolute top-0 right-0 w-[30%] h-full  ${ themeMode === 1 ? "z-2 ": "z-2" }`}></motion.div>
            <motion.div ref={containerRef} className={`sm:rounded-[39px] flex justify-start sm:h-fit xl:overflow-hidden sm:overflow-hidden overflow-auto relative transition-all ease-in-out  z-2 ${
                !mobile && isHover && " "
            } ${
                themeMode === 0 ? "lg:w-auto sm:w-full w-fit sm:mt-0 mt-22":"sm:w-full w-fit md:mr-8 mr-4 max-md:ml-4 sm:mt-0 mt-26 "
            }${
                themeMode === 0 ? !mobile? "bg-[#A7E4D9] sm:bg-[#bcdfdb] ":" bg-transparent " : " bg-transparent"
            } ${
                themeMode == 0 && showSearchBar ? "h-0 duration-200" : "h-full max-sm:flex-1 duration-200 "
            }`}>
                {/* ── Wrapper ze strzałkami – mode===1 zawsze + mode===0 desktop ── */}
                {(themeMode === 1 || (themeMode === 0 && !mobile)) ? (
                    <div className="relative flex items-center w-full overflow-hidden">

                        {/* Strzałka LEWA */}
                        <button
                            aria-label="Przewiń w lewo"
                            onClick={() => scrollNavBy(-1)}
                            onMouseDown={() => startScrollInterval(-1)}
                            onMouseUp={stopScrollInterval}
                            onMouseLeave={stopScrollInterval}
                            onTouchStart={() => startScrollInterval(-1)}
                            onTouchEnd={stopScrollInterval}
                            className={`flex-shrink-0 z-30 flex absolute top-[50%] translate-y-[-50%] left-[2px] items-center justify-center w-8 h-8 rounded-full transition-all duration-200 select-none
                                ${canScrollLeft
                                    ? "opacity-100 pointer-events-auto cursor-pointer hover:scale-[1.1]"
                                    : "opacity-0 pointer-events-none"
                                }`}
                        >
                            <svg width="20" color="black" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="15 18 9 12 15 6" />
                            </svg>
                        </button>

                        {/* Gradient fade – lewa krawędź */}
                        {canScrollLeft && (
                            <div
                                className={`absolute left-0 top-0 bottom-0 w-25 pointer-events-none z-20 ${
                                    themeMode === 0 ? "bg-gradient-to-r from-[#d9d9d9] from-[20%] to-transparent" : "bg-gradient-to-r from-background from-[20%] to-transparent"
                                }`}
                            />
                        )}
                        <NavbarItems mode={themeMode} ref={navbarRef} id="navbar-scroll" className={`flex sm:flex-row flex-col sm:items-center sm:space-x-3 xl:py-2 lg:py-2 py-0 sm:h-fit h-full overflow-x-scroll sm:overflow-y-visible overflow-y-auto max-sm:space-y-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
                            themeMode === 1
                                ? "md:mx-4 sm:ml-4 justify-start pl-[8px] pr-[20px] sm:w-full w-auto"
                                : "sm:rounded-[39px] 3xl:px-25 2.5xl:px-14 max-xl:px-2 max-lg:px-2 max-xl:pr-[22px] px-10  justify-start lg:w-auto w-full"
                        }`}>
                            <div className={`${themeMode === 0 ? "2xl:hidden flex max-sm:hidden pl-4" : "hidden"}`}>
                                <Image src="/logo_hau_white.svg" alt='logo' className='min-w-[40px] min-h-[40px]' width={40} height={40}/>
                            </div>
                            {visibleCategories.map((item, index) => (
                                <NavLink navRef={navbarRef} mode={themeMode} item={item} index={index} total={visibleCategories.length} key={item._id ?? index} itemRef={itemRefs.current[index]} globalDelay={globalDelay} initialMobile={initialMobile} />
                            ))}
                            <GuidesNavLink mode={themeMode} initialMobile={initialMobile} onNavigate={() => setOpenMenu(false)} />
                        </NavbarItems>

                        {/* Gradient fade – prawa krawędź */}
                        {canScrollRight && (
                            <div
                                className={`absolute right-0 top-0 bottom-0 w-25 pointer-events-none z-20 ${
                                    themeMode === 0 ? "bg-gradient-to-l from-[#d9d9d9] from-[20%] to-transparent" : "bg-gradient-to-l from-background from-[20%] to-transparent"
                                }`}
                            />
                        )}

                        {/* Strzałka PRAWA */}
                        <button
                            aria-label="Przewiń w prawo"
                            onClick={() => scrollNavBy(1)}
                            onMouseDown={() => startScrollInterval(1)}
                            onMouseUp={stopScrollInterval}
                            onMouseLeave={stopScrollInterval}
                            onTouchStart={() => startScrollInterval(1)}
                            onTouchEnd={stopScrollInterval}
                            className={`flex-shrink-0 z-30 flex absolute right-[2px] top-[50%] translate-y-[-50%] items-center justify-center w-8 h-8 rounded-full transition-all duration-200 select-none
                                ${canScrollRight
                                    ? "opacity-100 pointer-events-auto hover:scale-[1.1] cursor-pointer"
                                    : "opacity-0 pointer-events-none"
                                }`}
                        >
                            <svg width="20" height="20" color="black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="9 18 15 12 9 6" />
                            </svg>
                        </button>

                    </div>
                ) : (
                    /* ── mode===0 mobile – oryginalny markup, normalny scroll pionowy ── */
                    <AnimatePresence>
                        {!showSearchBar &&
                        <motion.div initial={{ opacity: 0, height:0 }}
                            animate={{ opacity: 1, height: "100%" }}
                            exit={{ opacity: 0, height:0 }}
                            transition={{ duration: 0.3, ease: 'easeInOut' }}>
                            <NavbarItems mode={themeMode} edgeFade ref={navbarRef} id="navbar-scroll" className={`flex sm:flex-row flex-col sm:items-center sm:space-x-3 xl:py-2 lg:py-2 py-0 max-sm:pt-5 sm:h-fit h-full overflow-x-auto sm:overflow-y-visible overflow-y-auto max-sm:space-y-2 sm:rounded-[39px] 1xl:px-25 lg:px-14 lg:pl-14 lg:pr-14 pl-0 pr-10 justify-start lg:w-auto w-full`}>
                                <div className="2xl:hidden flex max-sm:hidden pl-4">
                                    <Image src="/logo_hau_white.svg" alt='logo' className='min-w-[40px] min-h-[40px]' width={40} height={40}/>
                                </div>
                                {visibleCategories.map((item, index) => (
                                    <NavLink navRef={navbarRef} mode={themeMode} item={item} index={index} total={visibleCategories.length} key={item._id ?? index} itemRef={itemRefs.current[index]} globalDelay={globalDelay} initialMobile={initialMobile} />
                                ))}
                                <GuidesNavLink mode={themeMode} initialMobile={initialMobile} onNavigate={() => setOpenMenu(false)} />
                            </NavbarItems>
                        </motion.div>
                        }  
                    </AnimatePresence>
                )}
            </motion.div>
            {
                themeMode === 1 ? (
                    /* Wybór między ikonką (640–768px) a pełnym paskiem (≥768px) NIE może iść
                       przez JS (useMediaQuery('max-width:768px'), tak było wcześniej) — jego
                       SSR-owy fallback (initialMobile) pochodzi z User-Agenta, który nie ma
                       pojęcia o realnej szerokości okna desktopowej przeglądarki. Efekt: przy
                       odświeżeniu w 640–768px na pierwszej klatce renderował się stary, duży
                       pasek (bo md wychodziło false), a dopiero po hydracji i realnym
                       matchMedia przełączało się na ikonkę — czyli widoczny błysk.
                       Zamiast tego obie wersje są zamontowane razem, a widoczność rozstrzyga
                       czysty CSS breakpoint (md:hidden / hidden md:flex) — przeglądarka liczy
                       to od razu przy pierwszym malowaniu, zero JS-owego zgadywania. themeMode===1
                       już implikuje !mobile (patrz isCompact/themeMode wyżej), więc druga gałąź
                       nie potrzebuje osobnego guardu na mobile. */
                    <>
                        <div className="md:hidden flex items-center max-md:mr-2 max-sm:mr-0">
                            <button
                                type="button"
                                aria-label="Szukaj"
                                aria-expanded={showSearchBar}
                                onClick={() => (showSearchBar ? closeSearchBar() : openSearchBar())}
                                className="flex items-center justify-end w-10 h-10 text-black shrink-0 cursor-pointer"
                            >
                                <Search width={22} height={22} className={` ${
                                    mode == 1 && !mobile ? "text-black" : "text-white"
                                }`} />
                            </button>
                            {/* Container z inputem — położenie/styl 1:1 jak w mode 0 w tym samym zakresie
                                szerokości (min-sm/max-md): mode={0} przekazane do SearchBarContext, żeby
                                zadziałały JEGO własne klasy odpowiedzialne za pozycjonowanie
                                (absolute/bottom/top/rounded). Realny `mode` (1) zostaje bez zmian
                                wszędzie indziej. shrink-0 (nie w-full): #search-body jest tu flex-row,
                                więc w-full zrobiłoby z wrappera pełnoszerokościowy flex item i ściskało
                                ikonkę-siostrę — SearchBarContext i tak pozycjonuje się sam przez własny
                                position:absolute (mode=0), więc wrapper nie musi rezerwować miejsca. */}
                            <AnimatePresence>
                                {showSearchBar && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.2, ease: "easeInOut" }}
                                        className="shrink-0"
                                    >
                                        <SearchBarContext mode={0} isChangeMode={true} showSearchBar={showSearchBar} focusChanges={focusChanges} blurChanges={blurChanges} mobile={isCompact} onQueryChange={setQuery} onClose={closeSearchBar} onCommitSearch={dismissSearchForNavigation} />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                        <div className="hidden md:flex items-center" onClick={openSearchBar}>
                            <SearchBarContext mode={themeMode} isChangeMode={false} showSearchBar={showSearchBar} focusChanges={focusChanges} blurChanges={blurChanges} mobile={isCompact} onQueryChange={setQuery} onClose={closeSearchBar} onCommitSearch={dismissSearchForNavigation} />
                        </div>
                    </>
                ) : (
                    <div onClick={openSearchBar} className={`max-sm:flex max-sm:flex-col max-sm:min-h-0 w-full ${showSearchBar ? "max-sm:flex-1" : ""}`}><SearchBarContext mode={themeMode} isChangeMode={false} showSearchBar={showSearchBar} focusChanges={focusChanges} blurChanges={blurChanges} mobile={isCompact} onQueryChange={setQuery} onClose={closeSearchBar} onCommitSearch={dismissSearchForNavigation} /></div>
                )
            }

        </div>

    </div>
  )
}
type CategoryItem = {
    _id: string;
    title: string;
    slug: string;
    subcategory?: { 
        _id: string;
        title: string;
        slug: string;
     }[];
}

// ── Animacja rozwijanego menu ─────────────────────────────────────────────
// Na komputerze animujemy WYŁĄCZNIE clip-path (i kolor tła napisu), nigdy wysokości.
// Wcześniej panel rósł przez `max-height: 0 → 420px` z liniowym easingiem:
// każda klatka przeliczała układ strony, a przy panelu o realnej wysokości
// ~150–250 px widoczny ruch kończył się w połowie czasu i panel „stawał” —
// stąd wrażenie szarpania. clip-path nie zmienia układu (framer-motion puszcza
// go przez Web Animations API, poza wątkiem Reacta), a krzywa ease-out daje
// płynne wyhamowanie niezależnie od wysokości panelu.
const EASE_OUT = [0.22, 1, 0.36, 1] as const
const EASE_IN = [0.4, 0, 1, 1] as const
// Tło zakładki odsłaniane od góry; prawa krawędź z zapasem 60 px, bo poza
// zakładką (left: 100%) siedzi wklęsły narożnik łączący ją z panelem.
const TAB_OPEN = "inset(0px -60px 0% 0px)"
const TAB_CLOSED = "inset(0px -60px 100% 0px)"
// Panel rozwijany od góry; ujemne marginesy na boki i dół zostawiają miejsce
// na cień (shadow-lg), który inaczej byłby przycięty.
const PANEL_OPEN = "inset(0% -20% -25% -20%)"
const PANEL_CLOSED = "inset(0% -20% 100% -20%)"

const NavLink = React.memo(function NavLink({ item, index, total, navRef, itemRef, globalDelay, mode, initialMobile = false}: { item: CategoryItem, index: number, total: number, navRef: React.Ref<HTMLDivElement | null>, itemRef: React.Ref<HTMLLabelElement | null>, globalDelay:number, mode: number, initialMobile?: boolean}) {
    const mobile  = useMediaQuery('(max-width: 639px)', initialMobile);
    const [isHover, setIsHover] = useState<boolean>(false);

    const handleMouseEnter = (e: HTMLElement) => {
        const container = navRef as React.RefObject<HTMLElement>;
        if (container?.current) {
            const { left, right } = e.getBoundingClientRect();
            const { left: cLeft, right: cRight } = container.current.getBoundingClientRect();
            const offset = mode === 0 ? 40 : 25;

            if (left < cLeft + offset) {
                container.current.scrollTo({ left: container.current.scrollLeft + left - cLeft - offset, behavior: "smooth" });
            } else if (right > cRight - offset) {
                container.current.scrollTo({ left: container.current.scrollLeft + right - cRight + offset, behavior: "smooth" });
            }
        }
        setIsHover(true);
    }

    // Otwarcie: tło zakładki (0,16 s) → panel dołącza, gdy tło jest prawie
    // gotowe (0,28 s, większość ruchu w pierwszej połowie) — razem ~0,4 s
    // zamiast ~0,9 s w pierwotnej wersji. Zamknięcie: panel zwija się szybko
    // (0,16 s), tło zakładki znika tuż za nim. Każdy stan animuje się od
    // BIEŻĄCEJ wartości, więc szybkie przejeżdżanie po zakładkach nie skacze.
    const variants = {
        borderOpen: { clipPath: TAB_OPEN, transition: { duration: 0.16, ease: EASE_OUT, delay: globalDelay } },
        borderClosed: { clipPath: TAB_CLOSED, transition: { duration: 0.14, ease: EASE_IN, delay: 0.1 } },
        ListOpen: { clipPath: PANEL_OPEN, display: "block", transition: { duration: 0.28, ease: EASE_OUT, delay: 0.1 + globalDelay } },
        ListClosed: { clipPath: PANEL_CLOSED, transition: { duration: 0.16, ease: EASE_IN }, transitionEnd: { display: "none" } },
        // Telefon: lista jest w przepływie strony (akordeon), więc tu musi
        // rosnąć wysokość — do realnej wysokości treści ("auto"), nie do
        // sztywnego max-height. `visibility` zamiast `display`, żeby framer
        // mógł zmierzyć wysokość "auto".
        mobileListOpen: { height: "auto", opacity: 1, visibility: "visible", transition: { duration: 0.28, ease: EASE_OUT, delay: 0.06 + globalDelay } },
        mobileListClosed: { height: 0, opacity: 0, transition: { duration: 0.18, ease: EASE_IN }, transitionEnd: { visibility: "hidden" } },
        circleOpen:{backgroundColor: "#f6f6f62e", transition:{duration:0.16, delay:globalDelay}},
        circleClosed:{backgroundColor: "#f6f6f600", transition:{duration:0.16}},
    }
    const categoryHref = `/category/${item.slug}`
    return (
    <motion.label ref={itemRef} tabIndex={index} onFocus={() => {setIsHover(true)}} onBlur={() => {setIsHover(false)}} onMouseEnter={(e) => {handleMouseEnter(e.currentTarget)}} onMouseLeave={() => setIsHover(false)} style={{ marginRight: index === total - 1 ? "0px" : "" }} key={index} className={`text-black outline-none relative sm:text-[clamp(15px,1.3vw,18px)] max-lg:py-1 text-[16px] font-poppins whitespace-nowrap max-sm:w-fit`}>
        {!mobile ? (
        <div className={`px-[6px] flex justify-start sm:justify-center items-center ${
            mode === 1 ? "":"sm:py-1"
        }`}>
            <motion.div initial={{ clipPath: TAB_CLOSED }} animate={isHover ? "borderOpen" : "borderClosed"} variants={variants} className='rounded-t-[20px] bg-menu-content absolute top-0 left-0 w-full h-full z-[9]'>
                <div className='absolute w-[50px] h-full left-[100%] bottom-0 overflow-hidden'>
                    <div className='sh-nav-rounded rounded-bl-[20px]'></div>
                </div>
            </motion.div>
            {/* Główna kategoria jest klikalna — prowadzi na stronę kategorii
                (/category/[slug]) z produktami ze wszystkich jej podkategorii. */}
            <Link href={categoryHref} className='z-10 outline-none'>
                <motion.span initial={{backgroundColor: "#f6f6f600"}} animate={isHover ? "circleOpen" : "circleClosed"} variants={variants} className='p-1 rounded-[10px] block'>{item.title}</motion.span>
            </Link>

            <SubmenuPortal anchorRef={itemRef as React.RefObject<HTMLLabelElement>} scrollRef={navRef as React.RefObject<HTMLDivElement>} open={isHover} exit={()=>setIsHover(false)}>
                <motion.div
                    initial={{ clipPath: PANEL_CLOSED, display: "none" }}
                    animate={isHover ? "ListOpen" : "ListClosed"}
                    variants={variants}
                    className="z-[9999] bg-menu-content w-auto h-auto rounded-b-[20px] rounded-r-[20px] shadow-lg shadow-black/25"
                >
                    <div className="px-4 pb-3 pt-2 flex flex-col space-y-3">
                        <Link href={categoryHref} className="w-auto h-auto flex no-underline outline-none font-poppins">
                            <span className="text-black font-medium 2xl:text-[16px] text-[14px] hover:scale-[0.96] origin-left ease-in-out duration-300">
                            Wszystko z kategorii →
                            </span>
                        </Link>
                        {item.subcategory?.map((subitem, subindex) => (
                        <Link key={subindex} href={`/subcategory/${subitem.slug}`} className="w-auto h-auto flex no-underline outline-none font-poppins">
                            <span className="text-black 2xl:text-[16px] text-[14px] hover:scale-[0.96] origin-left ease-in-out duration-300">
                            {subitem.title}
                            </span>
                        </Link>
                        ))}
                        <hr className="border-white my-1" />
                    </div>
                </motion.div>
            </SubmenuPortal>
        </div>
        ):
        (
        <div className='px-[6px] sm:py-1 flex sm:flex-row flex-col justify-start sm:justify-center sm:items-center items-start'>

            <div className='z-10 relative px-2 py-[5px] h-auto'>
                <motion.p initial={{backgroundColor: "#f6f6f600"}} animate={isHover ? "circleOpen" : "circleClosed"} variants={variants} className='p-1 rounded-[10px]'>{item.title}</motion.p>
                <motion.div initial={{ clipPath: TAB_CLOSED }} animate={isHover ? "borderOpen" : "borderClosed"} variants={variants} className='rounded-t-[20px] bg-[#D1EAE5]/83 absolute top-0 left-0 w-full h-full z-[-1]'>
                    <div className='absolute w-[50px] h-full left-[100%] bottom-0 overflow-hidden'>
                        <div className='sh-nav-rounded2 rounded-bl-[20px]'></div>
                    </div>
                </motion.div>
            </div>

            <motion.div
                initial={{ height: 0, opacity: 0, visibility: "hidden" }}
                animate={isHover ? "mobileListOpen" : "mobileListClosed"}
                variants={variants}
                className={`z-10 bg-[#D1EAE5]/83 w-auto rounded-b-[20px] rounded-r-[20px] overflow-hidden shadow-lg shadow-black/25 ${
                    index == 1 ? "min-w-[65vw]":"min-w-auto"
                }`}
            >
                <div className="px-4 pb-3 pt-2 flex flex-col space-y-3">
                    <Link href={categoryHref} className="w-auto h-auto flex">
                        <span className="text-black text-[14px] font-medium hover:underline">
                        Wszystko z kategorii →
                        </span>
                    </Link>
                    {item.subcategory?.map((subitem, subindex) => (
                    <Link key={subindex} href={`/subcategory/${subitem.slug}`} className="w-auto h-auto flex">
                        <span className="text-black text-[14px] hover:underline">
                        {subitem.title}
                        </span>
                    </Link>
                    ))}
                    <hr className="border-white my-1" />
                </div>
            </motion.div>
        </div>
        )}
    </motion.label>
    )
})

/**
 * Poradniki jako osobny punkt nawigacji.
 *
 * Nie jest to NavLink z pustym submenu — poradniki nie mają podkategorii i nie
 * prowadzą do listy produktów, więc cały mechanizm hover + rozwijany panel
 * byłby tu pustą obietnicą. Zamiast tego prosty link do /poradniki, wizualnie
 * odróżniony obwódką i ikoną, żeby czytało się jako "inny rodzaj treści", a nie
 * kolejna kategoria sklepu.
 */
const GuidesNavLink = ({ mode, initialMobile = false, onNavigate }: { mode: number, initialMobile?: boolean, onNavigate?: VoidFunction }) => {
    const mobile = useMediaQuery('(max-width: 639px)', initialMobile);

    return (
        <div className={`flex ${mobile ? 'px-[6px] pt-1 pb-2 justify-start' : 'px-[6px] sm:py-1 justify-center items-center'}`}>
            <Link
                href={GUIDES_NAV.href}
                onClick={onNavigate}
                className={`group inline-flex items-center gap-2 whitespace-nowrap rounded-[14px] border transition-colors duration-300 outline-none
                    ${mobile ? 'text-[16px] px-3 py-[6px]' : 'sm:text-[clamp(15px,1.3vw,18px)] text-[16px] px-3 py-[3px]'}
                    ${mode === 1
                        ? 'border-black/25 text-black hover:bg-main hover:border-main'
                        : 'border-black/25 text-black hover:bg-[#94cdc3] hover:border-[#94cdc3] '
                    }`}
            >
                <BookOpen className="w-[16px] h-[16px] shrink-0" />
                <span className="font-poppins">{GUIDES_NAV.title}</span>
            </Link>
        </div>
    )
}

export default NavRMenu
