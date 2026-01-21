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



const NavRMenu = ({ className, style, mode, categories}: { className: string, style: React.CSSProperties, mode: number, categories: CategoryNode[] }) => {
    const mobile  = useMediaQuery('(max-width: 639px)');
    
    const [openMenu, setOpenMenu] = useState<boolean>(!mobile ? false : true);
    const navbarRef = useRef<HTMLDivElement>(null);
    //const [isMode, setIsMode] = useState<number>(mode);

    
    const { scrollY } = useScroll({});
    useMotionValueEvent(scrollY, "change", (latest) => {
        setOpenMenu(false)
    });

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
            animate("#navbar2 > a", (openMenu && mobile)  ?{ x:"50%"}: { x:0},{duration:0.3, ease:"easeOut"})
        }
    },[openMenu])

    // useEffect(()=>{
    //     const isFocus = itemRefs.current.some((item,i)=>item.current.matches(":hover"))
    //     console.log(isFocus)
    // },[itemRefs.current])

    const globalDelay = 0.4

    const [isHover, setIsHover] = useState<boolean>(false)

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




    const NavbarVariants = {
        default: {
            x: "-115vw",
        },

        slide: {
            x: "-15vw",
        },

        changeDirectionRow: {
            flexDirection: !mobile ? "row" : "column",
        },

        changeDirectionColumn: {
            flexDirection: "column",
        }
    };

    // useEffect(()=>{
    //     if(mode === 1){
    //     animate("#navbar2",{borderBottomWidth: mode === 1 && SearchBarReady ? "1px":"0"},{duration:0.5})
    //     }
    // },[SearchBarReady , mode])
    const containerRef = useRef<HTMLDivElement | null>(null);
    const focusChanges = () => {
        if (!containerRef.current) return;

        containerRef.current.style.maxHeight = '30%';
    };
    const blurChanges = () => {
        if (!containerRef.current) return;

        containerRef.current.style.maxHeight = 'none';
    };
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
        <motion.div 
            initial={{x: "-115vw"}}
            animate={!mobile ? {x:"0vw"} : openMenu ? {x:"-15vw"} : { x: "-115vw" }} 
            transition={{duration:0.3, ease:"linear"}} 
            className={`flex max-sm:fixed top-0 left-0 sm:w-full w-[115%] max-sm:bg-gradient-to-r from-main/80 from-70% to-70% to-transparent max-sm:backdrop-blur-[4px] max-sm:h-[100dvh] max-sm:max-h-[100dvh] h-auto sm:px-0 px-6 max-sm:pl-[20vw] sm:pb-0 pb-5 ${
                mode === 1 ? "max-md:border-t-1 justify-between max-md:border-[#838383] z-4":" z-4 "
            }${
                mode === 1 ? !mobile ? " flex-row ":" flex-col ":" flex-col "
            }`}>
                
            <motion.div ref={containerRef} className={`sm:rounded-[39px] flex justify-start max-sm:flex-1 sm:h-fit h-full xl:overflow-hidden sm:overflow-hidden overflow-auto relative ease-in-out duration-300 delay-300  z-2 ${
                !mobile && isHover && "shadow-lg shadow-black/25 "
            } ${
                mode === 0 ? "lg:w-auto w-full sm:mt-0 mt-24":"w-full md:mr-8 sm:mt-0 mt-26 "
            }${
                mode === 0 ? !mobile? "bg-[#A7E4D9] sm:bg-[#A7E4D9] ":" bg-transparent " : " bg-transparent "
            }`}>
                <NavbarItems mode={mode} ref={navbarRef} id="navbar-scroll" className={`sm:rounded-[39px] flex sm:flex-row flex-col sm:items-center sm:space-x-3  xl:py-2 lg:py-2 py-0 sm:h-fit h-full overflow-x-auto sm:overflow-y-visible overflow-y-auto max-sm:space-y-3 ${
                    mode === 1 ? "md:mx-4 sm:ml-4 justify-start pl-[8px] pr-[20px] w-full" : "1xl:px-25 lg:px-14 lg:pl-14 lg:pr-14 pl-0 pr-10 lg:justify-center justify-start lg:w-auto w-full"
                }`}>
                    <div className={` ${mode == 0 ? "2xl:hidden flex max-sm:hidden pl-4" : "hidden" }`}><Image src="/logo_hau_white.svg" alt='logo' className=' min-w-[40px] min-h-[40px]' width={40} height={40}/></div>                    
                    {
                        categories.map((item,index)=>(
                            <NavLink navRef={navbarRef} item={item} index={index} key={index} itemRef={itemRefs.current[index]} isHoverExport={BackgroundTheme} globalDelay = {globalDelay}/>
                        ))
                    }
                </NavbarItems>
            </motion.div>
            { mode === 0 &&
            <div className='sm:hidden flex flex-col w-full px-4'>
                <div className='h-[1px] bg-white w-[60%] mb-4'></div>
                <h1 className='text-black text-[14px] mb-2'>Lub <span className='font-bold'>wyszukaj</span></h1>
            </div> 
            }
            {
                mode === 1 ? !mobile  && <SearchBarContext mode={mode} focusChanges={focusChanges} blurChanges={blurChanges} mobile={mobile} /> : <SearchBarContext mode={mode} focusChanges={focusChanges} blurChanges={blurChanges} mobile={mobile} />
            }
            
        </motion.div>
        {
            mode === 1 && mobile && <SearchBarContext mode={mode} mobile={mobile} />
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

const NavLink = ({ item, index, navRef, itemRef, isHoverExport, globalDelay}: { item: CategoryItem, index: number, navRef: React.Ref<HTMLDivElement | null>, itemRef: React.Ref<HTMLLabelElement | null>, isHoverExport: VoidFunction, globalDelay:number}) => {
    const mobile  = useMediaQuery('(max-width: 639px)');
    const [isHover, setIsHover] = useState<boolean>(false);
    
    const { scrollX } = useScroll({
        container: navRef as React.RefObject<HTMLElement>,
    });

    useMotionValueEvent(scrollX, "change", (latest) => {
        setIsHover(false)
        console.log("scrollX:", latest); // wypisze wartość scrollX w czasie scrollowania
    });
    
    const variants = {
        borderOpen: { height: "100%", transition: { duration: 0.3 , delay: globalDelay} },
        borderClosed: { height: 0, transition: { duration: 0.3 , delay: 0.3 } },
        ListOpen: { maxHeight: 350, display: "block", transition: { duration: 0.3 , delay: 0.32 + globalDelay } },
        ListClosed: { maxHeight: 0, display: "none", transition: { duration: 0.3 } },
        shadowOpen: { height: "100%", width: 50, transition: { duration: 0.3, delay: 0.1 + globalDelay } },
        shadowClosed: { height: 0, width: 0, transition: { duration: 0.3 , delay: 0.3 } },
        textOpen:{opacity: 1, transition:{duration:0.3, delay:0.4 + globalDelay}},
        textClosed:{opacity:0, transition:{duration:0.1}},
        circleOpen:{backgroundColor: "#f6f6f62e", transition:{duration:0.3, delay:0.1 + globalDelay}},
        circleClosed:{backgroundColor: "#f6f6f600", transition:{duration:0.3}},
    }
    return (
    <motion.label ref={itemRef} tabIndex={index} onFocus={() => {setIsHover(true)}} onBlur={() => {setIsHover(false)}} onMouseEnter={() => {setIsHover(true); isHoverExport()}} onMouseLeave={() => setIsHover(false)} style={{ marginRight: index === category.length - 1 ? "0px" : "" }} key={index} className={`text-black outline-none relative sm:text-[clamp(15px,1.3vw,18px)] max-lg:py-1 text-[16px] font-poppins whitespace-nowrap max-sm:w-fit`}>
        {!mobile ? (
        <div className='px-[6px] sm:py-1 flex justify-start sm:justify-center items-center'>
            <motion.div initial={{height:0}} animate={isHover ? "borderOpen" : "borderClosed"} variants={variants} className='rounded-t-[20px] bg-[#AF9E9E]/83 absolute top-0 left-0 w-full h-full z-[9]'>
                <motion.div initial={{height:0, width:0}} animate={isHover ? "shadowOpen" : "shadowClosed"} variants={variants} className='absolute w-[50px] h-full left-[100%] bottom-0 overflow-hidden'>
                    <div className='sh-nav-rounded rounded-bl-[20px]'></div>
                </motion.div>
            </motion.div>
            <motion.a initial={{backgroundColor: "#f6f6f600"}} animate={isHover ? "circleOpen" : "circleClosed"} variants={variants} className='p-1 rounded-[10px] z-10 2xl:font-medium'>{item.title}</motion.a>
            
            <SubmenuPortal anchorRef={itemRef as React.RefObject<HTMLLabelElement>} open={isHover}>
                <motion.div
                    initial={{ maxHeight: 0, display: "none" }}
                    animate={isHover ? "ListOpen" : "ListClosed"}
                    variants={variants}
                    className="space-y-3 z-[9999] bg-[#AF9E9E]/83 w-auto h-auto px-4 pb-3 pt-2 flex flex-col rounded-b-[20px] rounded-r-[20px] overflow-hidden backdrop-blur-[2px] shadow-lg shadow-black/25"
                >
                    {item.subcategory?.map((subitem, subindex) => (
                    <Link key={subindex} href={`/subcategory/${subitem.slug}`} className="w-auto h-auto flex no-underline outline-none">
                        <motion.h1
                        initial={{ opacity: 0 }}
                        animate={isHover ? "textOpen" : "textClosed"}
                        variants={variants}
                        className="text-black text-[14px] hover:scale-[0.9] origin-left ease-in-out duration-300"
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