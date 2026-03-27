import { useScroll, useSpring, useTransform, motion } from 'framer-motion';
import React, { useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

type Props = {
    children: React.ReactNode,
    bodyClassName?: string
}
const Carousel = ({children, bodyClassName}:Props) => {
    const rangeRef = React.useRef<HTMLInputElement>(null);
    const carouselRef = React.useRef<HTMLDivElement>(null);
    const carouselChildRef = React.useRef<HTMLDivElement>(null)

    const {scrollXProgress} = useScroll({
        container: carouselRef,
        
    }) 
    
    const smoothProgress = useSpring(scrollXProgress, { stiffness: 100, damping: 20 });
    const opacity = useTransform(smoothProgress, [0.7, 1], [1, 0]);
    const opacity2 = useTransform(smoothProgress, [0, 0.3], [0, 1]);

    useEffect(() => {
        return smoothProgress.on("change", (latest) => {
        if(carouselRef.current && carouselChildRef.current){
            const perW = carouselRef.current?.clientWidth / carouselChildRef.current?.clientWidth
            const percentage = (perW*100)+ (1-perW)*latest*100 
            if (rangeRef.current) {
                rangeRef.current.style.setProperty("width", `${percentage}%`);
            }
        }
    });
  }, [smoothProgress]);

    const handleClickNext = () => {
        if (carouselRef.current) {
          carouselRef.current.scrollBy({ left: 300, behavior: 'smooth' });
        }
    }

    const handleClickPrev = () => {
        if (carouselRef.current) {
          carouselRef.current.scrollBy({ left: -300, behavior: 'smooth' });
        }
    }

  return (
    <div className='w-full flex flex-col items-center'>
        <div className='w-full flex relative '>
            <div ref={carouselRef} className='carousel w-full lg:pl-25 md:pl-18 pl-10 lg:pr-25 md:pr-18 pr-10 overflow-x-scroll flex justify-start'>
                <motion.div style={{opacity:opacity2}} whileHover={{scale:0.9}} onClick={()=> handleClickPrev()} className='absolute z-2 left-6 lg:p-3 p-2 rounded-[15px] bg-white top-[50%] translate-y-[-50%] cursor-pointer'><ChevronLeft className='text-black w-[20px] h-[20px]'/></motion.div>
                <div ref={carouselChildRef} className={twMerge('w-auto h-auto flex-1 flex', bodyClassName)}>{children}</div>
                <motion.div style={{opacity}} whileHover={{scale:0.9}} onClick={()=> handleClickNext()} className='absolute z-2 right-6 lg:p-3 p-2 rounded-[15px] bg-white top-[50%] translate-y-[-50%] cursor-pointer'><ChevronRight className='text-black w-[20px] h-[20px]'/></motion.div>
            </div>
        </div>
        <div className='bg-[#BDBDBD] sm:w-[40vw] w-[60vw] h-[3px] rounded-full lg:mt-12 mt-12'>
            <div ref={rangeRef} className='bg-[#383838] h-full rounded-full' style={{ width: 'var(--thumb-size, 10%)' }}></div>
        </div>
    </div>
  )
}

export default Carousel