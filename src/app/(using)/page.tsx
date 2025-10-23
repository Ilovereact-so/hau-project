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

                    <div className='absolute w-full flex flex-col z-[4] xl:pl-30 2lg:pl-22 pl-[7%] bottom-[18%]'>
                        <h1 className='text-white text-[clamp(24px,6vw,96px)] font-bold xl:leading-[110px] leading-[90px]'>{item.title}</h1>
                        <p className='text-white text-[clamp(14px,1.5vw,24px)] mb-5' dangerouslySetInnerHTML={{ __html: item.description }}/>
                        <button className='bg-white rounded-[15px] ml-8 text-black text-[clamp(13px,1.5vw,24px)] font-poppins font-bold px-10 py-3 inline-flex w-fit'>Sprawdź</button>
                    </div>
                </motion.div>
            ))}
            
            <div className='flex justify-center items-center absolute right-20 bottom-12 space-x-2 z-10'>
                <motion.div whileTap={{scale:0.8}} onTap={()=>setIndex( isIndex > 0 ? isIndex-1 : banerVariants.length -1)} className='cursor-pointer' ><ChevronLeft className='text-white xl:w-[24px] w-[20px] xl:h-[24px] h-[20px]'/></motion.div>
                {Array.from({ length: banerVariants.length }, (e, i) =>(
                    <motion.div initial={{backgroundColor:"#838383"}} animate={{backgroundColor: isIndex === i ? "#FEFEFE":"#838383" }} transition={{duration:0.2, ease:"easeInOut"}} key={i} className={`rounded-full xl:w-[17px] w-[15px] xl:h-[17px] h-[15px]`}></motion.div>
                ))}
                <motion.div whileTap={{scale:0.8}} onTap={()=>setIndex( isIndex < banerVariants.length -1 ? isIndex+1 : 0)} className='cursor-pointer'><ChevronRight className='text-white xl:w-[24px] w-[20px] xl:h-[24px] h-[20px]'/> </motion.div>
            </div> 
      </header>
      <ContentContainer/>
      <ValueBar/>
    </div>
  );
}
