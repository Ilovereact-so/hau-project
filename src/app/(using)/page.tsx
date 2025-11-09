'use client'
import { banerVariants } from "@/constants";
import Image from "next/image";
import {motion} from 'framer-motion'
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ContentContainer from "@/components/ContentContainer";
import ValueBar from "@/components/ValueBar";


export default function Home() {
    const [isIndex, setIndex] = useState<number>(0)
    const containerRef = useRef<HTMLDivElement>(null)
    const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
    const previousHeight = useRef<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const slide = slideRefs.current[isIndex];
    if (!container || !slide) return;

    const img = slide.querySelector("img") as HTMLImageElement | null;
    if (!img) return;

    const updateHeight = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        const rect = img.getBoundingClientRect();
        const newHeight = rect.height;

        // jeśli to pierwsze ustawienie lub nowa wysokość różna — aktualizujemy
        if (previousHeight.current === null || previousHeight.current !== newHeight) {
          container.style.height = `${newHeight}px`;
          previousHeight.current = newHeight;
        }
      }
    };

    // Ustaw wysokość natychmiast, gdy obraz jest już gotowy
    if (img.complete) {
      updateHeight();
    } else {
      img.addEventListener("load", updateHeight, { once: true });
    }

    // ResizeObserver śledzi zmianę wymiarów aktywnego slajdu
    const ro = new ResizeObserver(updateHeight);
    ro.observe(img);

    window.addEventListener("resize", updateHeight);

    // Sprzątanie
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateHeight);
      img.removeEventListener("load", updateHeight);
    };
  }, [isIndex]);

  return (
    <div>
        <header ref={containerRef}  className='w-full h-auto flex z-[9] relative'>
            
            {banerVariants.map((item,index)=>(
                <motion.div ref={(el) => { slideRefs.current[index] = el }} initial={{opacity:0}} animate={isIndex === index 
                    ? { opacity: 1, zIndex: 2 } 
                    : { opacity: 0, zIndex: 1 }}
                    transition={{ duration: 0.6, ease: "easeInOut" }}
                    key={index} className='w-full h-auto max-h-[100vh] overflow-hidden flex justify-center items-center top-0 left-0 z-[9] absolute '> {/**style={{backgroundImage:`url('${item.baner}')`}} */}
                    <div className="relative w-full h-[100vh] overflow-hidden">
                      {/* BACKGROUND IMAGE */}
                      <Image
                        src={item.baner}
                        alt="Zwierzak bawiący się zabawką BUBA - tło"
                        fill
                        className="object-cover saturate-50 z-[1]"
                        priority
                      />

                      {/* FOREGROUND IMAGE */}
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 z-[2] h-[100vh] w-max max-w-[120vw] overflow-hidden flex justify-center">
                        <Image
                          src={item.baner}
                          alt="Zwierzak bawiący się zabawką BUBA - pierwszy plan"
                          width={1648}
                          height={912}
                          className=" object-contain w-auto max-w-[400vw] relative 3xs:left-0 left-[-160px] ease-in-out duration-300"
                          priority
                        />
                      </div>
                    </div>

                    <div className='absolute w-full flex flex-col z-[4] xl:pl-30 lg:pl-22 pl-[7%] sm:bottom-[18%] bottom-[14%]'>
                        <h1 className='text-white sm:text-[clamp(40px,5vw,96px)] text-[30px] font-bold 1xl:leading-[110px] sm:leading-[90px] leading-[40px]'>{item.title}</h1>
                        <p className='text-white sm:text-[clamp(16px,1.5vw,24px)] text-[14px] mb-5 max-w-[600px]' dangerouslySetInnerHTML={{ __html: item.description }}/>
                        <button className='bg-white rounded-[15px] sm:ml-8 ml-3 text-black text-[clamp(13px,1.5vw,24px)] font-poppins font-bold sm:px-10 px-6 sm:py-3 py-2 inline-flex w-fit'>Sprawdź</button>
                    </div>
                    <div className="absolute sm:hidden block w-full h-full top-0 left-0 z-2 bg-gradient-to-t from-black/34 from-30% to-80% to-transparent"></div> 
                </motion.div>
            ))}
            
            <div className='flex justify-center items-center absolute sm:right-20 right-0 max-sm:left-[50%]  max-sm:translate-x-[-50%] sm:bottom-12 bottom-7 space-x-2 z-10'>
                <motion.div whileTap={{scale:0.8}} onTap={()=>setIndex( isIndex > 0 ? isIndex-1 : banerVariants.length -1)} className='cursor-pointer' ><ChevronLeft className='text-white xl:w-[24px] sm:w-[20px] w-[18px] xl:h-[24px] sm:h-[20px] h-[18px]'/></motion.div>
                {Array.from({ length: banerVariants.length }, (e, i) =>(
                    <motion.div initial={{backgroundColor:"#515151"}} animate={{backgroundColor: isIndex === i ? "#FEFEFE":"#515151" }} transition={{duration:0.2, ease:"easeInOut"}} key={i} className={`rounded-full xl:w-[17px] sm:w-[15px] w-[12px] xl:h-[17px] sm:h-[15px] h-[12px]`}></motion.div>
                ))}
                <motion.div whileTap={{scale:0.8}} onTap={()=>setIndex( isIndex < banerVariants.length -1 ? isIndex+1 : 0)} className='cursor-pointer'><ChevronRight className='text-white xl:w-[24px] sm:w-[20px] w-[18px] xl:h-[24px] sm:h-[20px] h-[18px]'/> </motion.div>
            </div>
      </header>
      <ContentContainer/>
    </div>
  );
}
