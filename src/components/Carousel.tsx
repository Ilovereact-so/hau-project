import { useScroll, useSpring, useTransform, motion } from 'framer-motion';
import React, { useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

type Props = {
    children: React.ReactNode,
    bodyClassName?: string,
    rightBtn?: React.RefObject<HTMLDivElement | null>,
    leftBtn?: React.RefObject<HTMLDivElement | null>,
}
const Carousel = ({children, bodyClassName, rightBtn, leftBtn}:Props) => {
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

  useEffect(() => {
        const right = rightBtn?.current
        const left = leftBtn?.current
        if (!right || !left) return

        const scrollRight = () => carouselRef.current?.scrollBy({ left: 500, behavior: 'smooth' })
        const scrollLeft  = () => carouselRef.current?.scrollBy({ left: -500, behavior: 'smooth' })

        right.addEventListener('click', scrollRight)
        left.addEventListener('click', scrollLeft)

        return () => {
        right.removeEventListener('click', scrollRight)
        left.removeEventListener('click', scrollLeft)
        }
    }, [rightBtn, leftBtn])
    
    // const handleClickNext = () => {
    //     if (carouselRef.current) {
    //       carouselRef.current.scrollBy({ left: 300, behavior: 'smooth' });
    //     }
    // }

    // const handleClickPrev = () => {
    //     if (carouselRef.current) {
    //       carouselRef.current.scrollBy({ left: -300, behavior: 'smooth' });
    //     }
    // }

  return (
    <div className='w-full flex flex-col items-center'>
        <div className='w-full flex relative '>
            <div ref={carouselRef} className='carousel w-full max-4xl:px-15 pr-10 overflow-x-scroll flex justify-start'>
                <div ref={carouselChildRef} className={twMerge('w-auto h-auto flex-1 flex', bodyClassName)}>{children}</div>
            </div>
        </div>
        <div className='bg-[#BDBDBD] sm:w-[60vw] w-[60vw] max-w-[1900px] h-[3px] rounded-full mt-14 mb-10'>
            <div ref={rangeRef} className='bg-[#383838] h-full rounded-full' style={{ width: 'var(--thumb-size, 10%)' }}></div>
        </div>
    </div>
  )
}

export default Carousel