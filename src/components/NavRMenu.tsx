'use client'
import React, { use, useEffect, useRef, useState } from 'react'
import ResearchNav from './ResearchNav'
import NavHamburger from './NavHamburger'
import NavbarItems from './NavbarItems'
import { category } from '@/constants'
import Link from 'next/link'
import { Search } from 'lucide-react'
import Image from 'next/image'
import { animate, motion, useMotionValueEvent, useScroll } from 'framer-motion'
import {useMediaQuery} from '@/hooks/useMediaQuery'
import SubmenuPortal from './SubmenuPortal'
import SearchBarContext from './SearchBarContext'
import { CategoryNode } from '@/hooks/categories'
import { set } from 'sanity'



const NavRMenu = ({ className, style, mode, categories}: { className: string, style: React.CSSProperties, mode: number, categories: CategoryNode[] }) => {
    const mobile  = useMediaQuery('(max-width: 639px)');
    
    const [openMenu, setOpenMenu] = useState<boolean>(!mobile ? false : true);
    const navbarRef = useRef<HTMLDivElement>(null);
    //const [isMode, setIsMode] = useState<number>(mode);

    
    // const { scrollY } = useScroll({});
    // useMotionValueEvent(scrollY, "change", (latest) => {
    //     setOpenMenu(false)
    // });

    const itemRefs = useRef([...Array(category.length)].map(()=>React.createRef() as React.RefObject<HTMLLabelElement>)) 
    const autoMenu = () => {
        // const tt = itemRefs.current.some((value, i)=> value.current === document.activeElement)
        // !tt && 
        // console.log(tt)
        mobile && itemRefs.current[0].current.focus()
    }
    useEffect(()=>{
        autoMenu()
        if(mode === 1){
            animate("#navbar2 > .navbar-logo", (openMenu && mobile)  ?{ x:"50%"}: { x:0},{duration:0.3, ease:"easeOut"})
        }
        if(openMenu){
            document.body.style.overflow = "hidden"
        }else{
            document.body.style.overflow = "auto"
        }
    },[openMenu])

    // useEffect(()=>{
    //     const isFocus = itemRefs.current.some((item,i)=>item.current.matches(":hover"))
    //     console.log(isFocus)
    // },[itemRefs.current])

    const globalDelay = 0.2

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
        const arrowsActive = mode === 1 || (mode === 0 && !mobile);
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
    }, [mode, mobile]);

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

const BackgroundTheme = () => {
  if (mode !== 0) return;

  const handleMouseEnter = () => {
    setIsHover(true);
  };

  const handleMouseLeave = (e: MouseEvent) => {
    const related = e.relatedTarget as Node | null;

    const stillInside = itemRefs.current.some((ref) => {
      const el = ref.current;
      return el && related && el.contains(related);
    });

    if (!stillInside) {
      setIsHover(false);
    }
  };

  itemRefs.current.forEach((ref) => {
    const el = ref.current;
    if (!el) return;

    el.addEventListener("mouseenter", handleMouseEnter);
    el.addEventListener("mouseleave", handleMouseLeave);
  });

  return () => {
    itemRefs.current.forEach((ref) => {
      const el = ref.current;
      if (!el) return;

      el.removeEventListener("mouseenter", handleMouseEnter);
      el.removeEventListener("mouseleave", handleMouseLeave);
    });
  };
};




    // const NavbarVariants = {
    //     default: {
    //         x: "-115vw",
    //     },

    //     slide: {
    //         x: "-15vw",
    //     },

    //     changeDirectionRow: {
    //         flexDirection: !mobile ? "row" : "column",
    //     },

    //     changeDirectionColumn: {
    //         flexDirection: "column",
    //     }
    // };

    // useEffect(()=>{
    //     if(mode === 1){
    //     animate("#navbar2",{borderBottomWidth: mode === 1 && SearchBarReady ? "1px":"0"},{duration:0.5})
    //     }
    // },[SearchBarReady , mode])
    const containerRef = useRef<HTMLDivElement | null>(null);
    const searchNoticeRef = useRef<HTMLDivElement | null>(null);
    const [query, setQuery] = useState<string>("");
    const [focus, setFocus] = useState<boolean>(false);
    const focusChanges = () => {
        setFocus(true);
        if (!containerRef.current|| !searchNoticeRef.current || mode === 1 || !mobile) return;

        containerRef.current.style.maxHeight = '0%';
        containerRef.current.style.marginTop = '80px';
        searchNoticeRef.current.style.maxHeight = "0px";        
        animate("#search-body", { paddingBottom: "5px" }, { duration: 0.3, ease: "easeOut" });

        // if(!mobile){
        //     containerRef.current.style.maxHeight = "none";
        //     containerRef.current.style.marginTop = '0px';
        // }
    };
    const blurChanges = () => {
        setFocus(false);
        console.log(query)
        if (!containerRef.current || !searchNoticeRef.current || query || mode === 1 || !mobile) return;

        containerRef.current.style.maxHeight = '100%';
        containerRef.current.style.marginTop = '88px';
        searchNoticeRef.current.style.maxHeight = "100%";
        animate("#search-body", { paddingBottom: "20px" }, { duration: 0.3, ease: "easeOut" });
        


    };
    useEffect(()=>{
        if(query === ""){
            if (!containerRef.current || !searchNoticeRef.current || mode === 1 || focus || !mobile) return;

            containerRef.current.style.maxHeight = '100%';
            containerRef.current.style.marginTop = '88px';
            searchNoticeRef.current.style.maxHeight = "100%";
            animate("#search-body", { paddingBottom: "20px" }, { duration: 0.3, ease: "easeOut" });

        }

    },[query])
    return (
    <div className={className} style={style}>
            
        <div className={`flex justify-start pl-6 transition-transform ease-in-out duration-300 mb-0 relative z-10 ${
            mode === 1 ? " w-auto":"lg:mt-0 mt-6 w-full "
        } ${
            openMenu && mode === 1 ? "translate-y-[-145%] ":"translate-y-0"
        }`}>
            <NavHamburger isOpen={openMenu} onClick={() => setOpenMenu(!openMenu)} mode={mode} className='sm:hidden inline-flex'/>
        </div>
        
        <motion.div initial={{opacity:0, display:"none"}} animate={!mobile ? isHover ? {opacity:1, display:"block"} : {opacity:0, display:"none"} : openMenu ? {opacity:1, display:"block"} : {opacity:0, display:"none"}} transition={{duration:0.3, delay:globalDelay}} className={`fixed top-0 left-0 w-full h-full bg-black/40  ${ mode === 1 ? "z-2 ": "z-0" }`}></motion.div>
        
        <div 
            id='search-body'
            className={`flex max-sm:fixed top-0 left-0 sm:w-full w-[115%] max-sm:bg-gradient-to-r from-main/80 from-70% to-70% to-transparent max-sm:backdrop-blur-[4px] max-sm:h-[100dvh] max-sm:max-h-[100dvh] h-auto sm:px-0 px-6 max-sm:pl-[20vw] sm:pb-0 pb-5 ${
                mode === 1 ? "max-md:border-t-1 justify-between max-md:border-[#838383] z-4":" z-4 "
            }${
                mode === 1 ? !mobile ? " flex-row ":" flex-col ":" flex-col "
            }${
                openMenu ? "max-sm:translate-x-[-15vw]":"max-sm:translate-x-[-115vw]"
            }`}>
            <motion.div onClick={()=>setOpenMenu(false)} initial={{opacity:0, display:"none"}} animate={!mobile ? isHover ? {opacity:1, display:"block"} : {opacity:0, display:"none"} : openMenu ? {opacity:1, display:"block"} : {opacity:0, display:"none"}} transition={{duration:0.3, delay:globalDelay}} className={`absolute top-0 right-0 w-[30%] h-full  ${ mode === 1 ? "z-2 ": "z-2" }`}></motion.div>
            <motion.div ref={containerRef} className={`sm:rounded-[39px] flex justify-start max-sm:flex-1 sm:h-fit h-full xl:overflow-hidden sm:overflow-hidden overflow-auto relative ease-in-out duration-300 delay-300  z-2 ${
                !mobile && isHover && "shadow-lg shadow-black/25 "
            } ${
                mode === 0 ? "lg:w-auto sm:w-full w-fit sm:mt-0 mt-24":"sm:w-full w-fit md:mr-8 sm:mt-0 mt-26 "
            }${
                mode === 0 ? !mobile? "bg-[#A7E4D9] sm:bg-[#A7E4D9] ":" bg-transparent " : " bg-transparent"
            }`}>
                {/* ── Wrapper ze strzałkami – mode===1 zawsze + mode===0 desktop ── */}
                {(mode === 1 || (mode === 0 && !mobile)) ? (
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
                                    mode === 0 ? "bg-gradient-to-r from-[#d9d9d9] from-[20%] to-transparent" : "bg-gradient-to-r from-background from-[20%] to-transparent"
                                }`}
                            />
                        )}

                        <NavbarItems mode={mode} ref={navbarRef} id="navbar-scroll" className={`flex sm:flex-row flex-col sm:items-center sm:space-x-3 xl:py-2 lg:py-2 py-0 sm:h-fit h-full overflow-x-scroll sm:overflow-y-visible overflow-y-auto max-sm:space-y-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
                            mode === 1
                                ? "md:mx-4 sm:ml-4 justify-start pl-[8px] pr-[20px] sm:w-full w-auto"
                                : "sm:rounded-[39px] 3xl:px-25 2.5xl:px-14 max-xl:px-2 max-lg:px-2 max-xl:pr-[22px] px-10  justify-start lg:w-auto w-full"
                        }`}>
                            <div className={`${mode === 0 ? "2xl:hidden flex max-sm:hidden pl-4" : "hidden"}`}>
                                <Image src="/logo_hau_white.svg" alt='logo' className='min-w-[40px] min-h-[40px]' width={40} height={40}/>
                            </div>
                            {categories.map((item, index) => (
                                <NavLink navRef={navbarRef} mode={mode} item={item} index={index} key={index} itemRef={itemRefs.current[index]} isHoverExport={BackgroundTheme} globalDelay={globalDelay} />
                            ))}
                        </NavbarItems>

                        {/* Gradient fade – prawa krawędź */}
                        {canScrollRight && (
                            <div
                                className={`absolute right-0 top-0 bottom-0 w-25 pointer-events-none z-20 ${
                                    mode === 0 ? "bg-gradient-to-l from-[#d9d9d9] from-[20%] to-transparent" : "bg-gradient-to-l from-background from-[20%] to-transparent"
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
                    <NavbarItems mode={mode} ref={navbarRef} id="navbar-scroll" className={`flex sm:flex-row flex-col sm:items-center sm:space-x-3 xl:py-2 lg:py-2 py-0 sm:h-fit h-full overflow-x-auto sm:overflow-y-visible overflow-y-auto max-sm:space-y-3 sm:rounded-[39px] 1xl:px-25 lg:px-14 lg:pl-14 lg:pr-14 pl-0 pr-10 justify-start lg:w-auto w-full`}>
                        <div className="2xl:hidden flex max-sm:hidden pl-4">
                            <Image src="/logo_hau_white.svg" alt='logo' className='min-w-[40px] min-h-[40px]' width={40} height={40}/>
                        </div>
                        {categories.map((item, index) => (
                            <NavLink navRef={navbarRef} mode={mode} item={item} index={index} key={index} itemRef={itemRefs.current[index]} isHoverExport={BackgroundTheme} globalDelay={globalDelay} />
                        ))}
                    </NavbarItems>
                )}
            </motion.div>
            { mode === 0 &&
            <div ref={searchNoticeRef} className='sm:hidden flex flex-col w-full px-4 ease-in-out duration-300'>
                <div className='h-[1px] bg-white w-[60%] mb-4'></div>
                <h1 className='text-black text-[14px] mb-2'>Lub <span className='font-bold'>wyszukaj</span></h1>
            </div> 
            }
            {
                mode === 1 ? !mobile  && <SearchBarContext mode={mode} focusChanges={focusChanges} blurChanges={blurChanges} mobile={mobile} onQueryChange={setQuery} /> : <SearchBarContext mode={mode} focusChanges={focusChanges} blurChanges={blurChanges} mobile={mobile} onQueryChange={setQuery} />
            }
            
        </div>
        {
            mode === 1 && mobile && <SearchBarContext mode={mode} mobile={mobile} onQueryChange={setQuery} />
        }

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

const NavLink = ({ item, index, navRef, itemRef, isHoverExport, globalDelay, mode}: { item: CategoryItem, index: number, navRef: React.Ref<HTMLDivElement | null>, itemRef: React.Ref<HTMLLabelElement | null>, isHoverExport: VoidFunction, globalDelay:number, mode: number}) => {
    const mobile  = useMediaQuery('(max-width: 639px)');
    const [isHover, setIsHover] = useState<boolean>(false);
    
    const { scrollX } = useScroll({
        container: navRef as React.RefObject<HTMLElement>,
    });

    const handleMouseEnter = (e: HTMLElement) => {
        
        const container = navRef as React.RefObject<HTMLElement>;
        if (!container) return;

        

        const { left, right } = e.getBoundingClientRect();
        const { left: cLeft, right: cRight } = container.current.getBoundingClientRect();
        const offset = mode === 0 ? 40 : 25;

        if (left < cLeft + offset) {
            container.current.scrollTo({ left: container.current.scrollLeft + left - cLeft - offset, behavior: "smooth" });
        } else if (right > cRight - offset) {
            container.current.scrollTo({ left: container.current.scrollLeft + right - cRight + offset, behavior: "smooth" });
        }
        setIsHover(true); 
        isHoverExport();
    }
    
    // useMotionValueEvent(scrollX, "change", (latest) => {
    //     setIsHover(false)
    //     console.log("scrollX:", latest); // wypisze wartość scrollX w czasie scrollowania
    // });
    
    const variants = {
        borderOpen: { height: "100%", transition: { duration: 0.3 , delay: globalDelay} },
        borderClosed: { height: 0, transition: { duration: 0.3 , delay: 0.3 } },
        ListOpen: { maxHeight: 350, display: "block", transition: { duration: 0.3 , delay: 0.27 + globalDelay}},
        ListClosed: { maxHeight: 0, display: "none", transition: { duration: 0.3 } },
        shadowOpen: { height: "100%", width: 50, transition: { duration: 0.3, delay: 0.1 + globalDelay } },
        shadowClosed: { height: 0, width: 0, transition: { duration: 0.3 , delay: 0.3 } },
        textOpen:{opacity: 1, transition:{duration:0.3, delay:0.4 + globalDelay}},
        textClosed:{opacity:0, transition:{duration:0.1}},
        circleOpen:{backgroundColor: "#f6f6f62e", transition:{duration:0.3, delay:0.1 + globalDelay}},
        circleClosed:{backgroundColor: "#f6f6f600", transition:{duration:0.3}},
    }
    return (
    <motion.label ref={itemRef} tabIndex={index} onFocus={() => {setIsHover(true)}} onBlur={() => {setIsHover(false)}} onMouseEnter={(e) => {handleMouseEnter(e.currentTarget)}} onMouseLeave={() => setIsHover(false)} style={{ marginRight: index === category.length - 1 ? "0px" : "" }} key={index} className={`text-black outline-none relative sm:text-[clamp(15px,1.3vw,18px)] max-lg:py-1 text-[16px] font-poppins whitespace-nowrap max-sm:w-fit`}>
        {!mobile ? (
        <div className={`px-[6px] flex justify-start sm:justify-center items-center ${
            mode === 1 ? "":"sm:py-1"
        }`}>
            <motion.div initial={{height:0}} animate={isHover ? "borderOpen" : "borderClosed"} variants={variants} className='rounded-t-[20px] bg-menu-content absolute top-0 left-0 w-full h-full z-[9]'>
                <motion.div initial={{height:0, width:0}} animate={isHover ? "shadowOpen" : "shadowClosed"} variants={variants} className='absolute w-[50px] h-full left-[100%] bottom-0 overflow-hidden'>
                    <div className='sh-nav-rounded rounded-bl-[20px]'></div>
                </motion.div>
            </motion.div>
            <motion.a initial={{backgroundColor: "#f6f6f600"}} animate={isHover ? "circleOpen" : "circleClosed"} variants={variants} className='p-1 rounded-[10px] z-10 2xl:font-medium'>{item.title}</motion.a>
            
            <SubmenuPortal anchorRef={itemRef as React.RefObject<HTMLLabelElement>} scrollRef={navRef as React.RefObject<HTMLDivElement>} open={isHover} exit={()=>setIsHover(false)}>
                <motion.div
                    initial={{ maxHeight: 0, display: "none" }}
                    animate={isHover ? "ListOpen" : "ListClosed"}
                    variants={variants}
                    transition={{ease:"linear"}}
                    className="space-y-3 z-[9999] bg-menu-content w-auto h-auto px-4 pb-3 pt-2 flex flex-col rounded-b-[20px] rounded-r-[20px] overflow-hidden shadow-lg shadow-black/25"
                >
                    {item.subcategory?.map((subitem, subindex) => (
                    <Link key={subindex} href={`/subcategory/${subitem.slug}`} className="w-auto h-auto flex no-underline outline-none">
                        <motion.h1
                        initial={{ opacity: 0 }}
                        animate={isHover ? "textOpen" : "textClosed"}
                        variants={variants}
                        className="text-black text-[14px] hover:scale-[0.96] origin-left ease-in-out duration-300"
                        >
                        {subitem.title}
                        </motion.h1>
                    </Link>
                    ))}
                    <hr className="border-white my-1" />
                </motion.div>
            </SubmenuPortal>
        </div>
        ):
        (
        <div className='px-[6px] sm:py-1 flex sm:flex-row flex-col justify-start sm:justify-center sm:items-center items-start'>
            
            <div className='z-10 relative px-2 py-[5px] h-auto'>
                <motion.p initial={{backgroundColor: "#f6f6f600"}} animate={isHover ? "circleOpen" : "circleClosed"} variants={variants} className='p-1 rounded-[10px]'>{item.title}</motion.p>
                <motion.div initial={{height:0}} animate={isHover ? "borderOpen" : "borderClosed"} variants={variants} className='rounded-t-[20px] bg-[#AF9E9E]/83 absolute top-0 left-0 w-full h-full z-[-1]'>
                    <motion.div initial={{height:0, width:0}} animate={isHover ? "shadowOpen" : "shadowClosed"} variants={variants} className='absolute w-[50px] h-full left-[100%] bottom-0 overflow-hidden'>
                        <div className='sh-nav-rounded rounded-bl-[20px]'></div>
                    </motion.div>
                </motion.div> 
            </div>

            <motion.div
                initial={{ maxHeight: 0, display: "none" }}
                animate={isHover ? "ListOpen" : "ListClosed"}
                variants={variants}
                className={`space-y-3 z-10 bg-[#AF9E9E]/83 w-auto h-auto px-4 pb-3 pt-2 flex flex-col rounded-b-[20px] rounded-r-[20px] overflow-hidden shadow-lg shadow-black/25 ${
                    index == 1 ? "min-w-[65vw]":"min-w-auto"
                }`}
            >
                {item.subcategory?.map((subitem, subindex) => (
                <Link key={subindex} href={`/subcategory/${subitem.slug}`} className="w-auto h-auto flex">
                    <motion.h1
                    initial={{ opacity: 0 }}
                    animate={isHover ? "textOpen" : "textClosed"}
                    variants={variants}
                    className="text-black text-[14px] hover:underline"
                    >
                    {subitem.title}
                    </motion.h1>
                </Link>
                ))}
                <hr className="border-white my-1" />
            </motion.div>
        </div>
        )}
    </motion.label>
    )
}

export default NavRMenu