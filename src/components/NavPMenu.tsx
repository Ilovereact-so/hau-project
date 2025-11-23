'use client'
import React, { useEffect, useRef, useState } from 'react'
import ResearchNav from './ResearchNav'
import NavHamburger from './NavHamburger'
import NavbarItems from './NavbarItems'
import { category } from '@/constants'
import Link from 'next/link'
import { Search } from 'lucide-react'
import Image from 'next/image'
import { motion, useMotionValueEvent, useScroll } from 'framer-motion'
import useMediaQuery from '@/hooks/useMediaQuery'
import SubmenuPortal from './SubmenuPortal'
import ServerUser from './ServerUser'

const NavPMenu = ({ children, }: Readonly<{children: React.ReactNode}>) => {
  const mobile  = useMediaQuery('(max-width: 639px)');
    const [openMenu, setOpenMenu] = useState<boolean>(!mobile ? false : true);
    const navbarRef = useRef<HTMLDivElement>(null);
    const parentNavbarRef = useRef<HTMLDivElement>(null);


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
    },[openMenu])

    useEffect(()=>{
        const isFocus = itemRefs.current.some((item,i)=>item.current.matches(":hover"))
        console.log(isFocus)
    },[itemRefs.current])

    const globalDelay = 0.4

    const [isHover, setIsHover] = useState<boolean>(false)
    const BackgroundTheme = () =>{
        
        const handleMouseLeave = () => {
        // sprawdzamy, czy żaden element nie jest już hovered
        const anyHovered = itemRefs.current.some((item) =>
            item.current?.matches(":hover")
        );
            setIsHover(anyHovered);
        };
        handleMouseLeave()

        itemRefs.current.forEach((ref) => {
            const el = ref.current;
            el.addEventListener("mouseleave", handleMouseLeave);
        });

        return () => {
            itemRefs.current.forEach((ref) => {
                const el = ref.current;
                if (!el) return;
                el.removeEventListener("mouseleave", handleMouseLeave);
            });
        };


    }
  return (
    <div className='flex px-7 py-2 space-x-5 item-center border-b-1 border-[#838383]'>
        <div className='contrast-70 brightness-80 w-auto h-auto'>
            <Image src="/logo_hau.svg" alt='logo' className='min-w-[76px]' width={76} height={63}/>
        </div>
        <div className="flex items-center xl:space-y-6 space-y-0 lg:space-x-0 w-full sm:max-w-[calc(100%-100px)]">
            {mobile &&
            <div className='flex justify-start w-full pl-10 lg:mt-0 mt-7 mb-0 relative z-10'>
                <NavHamburger isOpen={openMenu} onClick={() => setOpenMenu(!openMenu)} className='sm:hidden inline-flex'/>
            </div>
            }
            <motion.div animate={{x: !mobile ? "0%" : openMenu ? "-15vw" : '-115vw'}} transition={{duration:0.5, ease:"backInOut", stiffness:100}} className='flex max-sm:fixed top-0 left-0 sm:w-full w-[115%] max-sm:bg-gradient-to-r from-[#a7e4d9a6] from-70% to-70% to-transparent max-sm:backdrop-blur-[4px] max-sm:h-screen h-auto sm:px-0 px-6 max-sm:pl-[20vw] sm:pb-0 pb-5'>
                <motion.div className={`flex justify-start max-sm:flex-1 sm:h-fit h-full w-full xl:overflow-hidden sm:mt-0 mt-24 sm:overflow-hidden overflow-auto relative ease-in-out duration-300 delay-300 mx-3`}>
                    <NavbarItems mode={1} ref={navbarRef} id="navbar-scroll2" className='sm:rounded-[39px] flex sm:flex-row flex-col justify-start sm:items-center sm:space-x-3  xl:py-2 lg:py-2 py-0 sm:h-fit h-full w-full overflow-x-auto sm:overflow-y-visible overflow-y-auto max-sm:space-y-3'>                        {
                            category.map((item,index)=>(
                                <NavLink navRef={navbarRef} item={item} index={index} key={index} itemRef={itemRefs.current[index]} isHoverExport={BackgroundTheme} globalDelay = {globalDelay}/>
                            ))
                        }
                    </NavbarItems>
                </motion.div>
                <div className='sm:hidden flex flex-col w-full px-4'>
                    <div className='h-[1px] bg-white w-[60%] mb-4'></div>
                    <h1 className='text-black text-[14px] mb-2'>Lub <span className='font-bold'>wyszukaj</span></h1>
                </div> {/**  0 - 640 relative, 640-1060 absolute, 1060+ relative */} 
                <div className='w-auto relative h-auto flex justify-center items-center ml-5'>
                    <div className='bg-[#F4F4F4] border-1 border-[#838383] h-fit rounded-full inline-flex space-x-3 px-3 py-2 w-auto'>
                        <Search className='text-black xl:w-[24px] w-[20px] xl:h-[24px] h-[20px]'/>
                        {/**<input placeholder='Obroża taktyczna..' className='focus:outline-none font-poppins text-[16px] placeholder:text-[16px] text-black placeholder:text-[#4E4E4E]'/> */}
                        <ResearchNav  isMobile={mobile} minWidth={150}/>
                    </div>    
                </div>
                {
                    children
                }
            </motion.div>
        </div>
        
    </div>
  )
}

type CategoryItem = {
    name: string;
    path: string;
    subcategory?: { name: string; path: string }[];
}

const NavLink = ({ item, index, navRef, itemRef, isHoverExport, globalDelay}: { item: CategoryItem, index: number, navRef: React.Ref<HTMLDivElement | null>, itemRef: React.Ref<HTMLLabelElement | null>, isHoverExport: VoidFunction, globalDelay:number}) => {
    const mobile  = useMediaQuery('(max-width: 639px)');
    const [isHover, setIsHover] = useState<boolean>(false);
    
    const { scrollX } = useScroll({
        container: navRef as React.RefObject<HTMLElement>,
    });

    // useMotionValueEvent(scrollX, "change", (latest) => {
    //     setIsHover(false)
    //     console.log("scrollX:", latest); // wypisze wartość scrollX w czasie scrollowania
    // });
    
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
    <motion.label ref={itemRef} tabIndex={index} onFocus={() => {setIsHover(true)}} onBlur={() => {setIsHover(false)}} onHoverStart={() => {setIsHover(true); isHoverExport()}} onMouseLeave={() => setIsHover(false)} style={{ marginRight: index === category.length - 1 ? "0px" : "" }} key={index} className={`text-black outline-none relative sm:text-[clamp(13px,1.2vw,18px)] text-[16px] font-poppins whitespace-nowrap max-sm:w-fit`}>
        {!mobile ? (
        <div className='px-[6px] sm:py-1 flex justify-start sm:justify-center items-center'>
            <motion.div initial={{height:0}} animate={isHover ? "borderOpen" : "borderClosed"} variants={variants} className='rounded-t-[20px] bg-[#AF9E9E]/83 absolute top-0 left-0 w-full h-full z-[9]'>
                <motion.div initial={{height:0, width:0}} animate={isHover ? "shadowOpen" : "shadowClosed"} variants={variants} className='absolute w-[50px] h-full left-[100%] bottom-0 overflow-hidden'>
                    <div className='sh-nav-rounded rounded-bl-[20px]'></div>
                </motion.div>
            </motion.div>
            <motion.a initial={{backgroundColor: "#f6f6f600"}} animate={isHover ? "circleOpen" : "circleClosed"} variants={variants} href={item.path} className='p-1 rounded-[10px] z-10'>{item.name}</motion.a>
            
            <SubmenuPortal anchorRef={itemRef as React.RefObject<HTMLLabelElement>} open={isHover}>
                <motion.div
                    initial={{ maxHeight: 0, display: "none" }}
                    animate={isHover ? "ListOpen" : "ListClosed"}
                    variants={variants}
                    className="space-y-3 z-[9999] bg-[#AF9E9E]/83 w-auto h-auto px-4 pb-3 pt-2 flex flex-col rounded-b-[20px] rounded-r-[20px] overflow-hidden backdrop-blur-[2px] shadow-lg shadow-black/25"
                >
                    {item.subcategory?.map((subitem, subindex) => (
                    <Link key={subindex} href={subitem.path} className="w-auto h-auto flex no-underline outline-none">
                        <motion.h1
                        initial={{ opacity: 0 }}
                        animate={isHover ? "textOpen" : "textClosed"}
                        variants={variants}
                        className="text-black text-[14px] hover:scale-[0.9] origin-left ease-in-out duration-300"
                        >
                        {subitem.name}
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
                <motion.p initial={{backgroundColor: "#f6f6f600"}} animate={isHover ? "circleOpen" : "circleClosed"} variants={variants} className='p-1 rounded-[10px]'>{item.name}</motion.p>
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
                <Link key={subindex} href={subitem.path} className="w-auto h-auto flex">
                    <motion.h1
                    initial={{ opacity: 0 }}
                    animate={isHover ? "textOpen" : "textClosed"}
                    variants={variants}
                    className="text-black text-[14px] hover:underline"
                    >
                    {subitem.name}
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

export default NavPMenu