'use client'
// Dyrektywa potrzebna od czasu, gdy strona główna stała się server componentem —
// wcześniej 'use client' dziedziczyło się od klientowego page.tsx.
import React, { useCallback, useEffect, useRef, useState } from 'react'
import Carousel from './Carousel'
import { getSubcategories } from '@/sanity/helpers/clientRequest'
import { SubcategoryTileSkeleton } from './ui/Skeleton'
import { Subcategory } from '../../sanity.types'
import { urlFor } from '@/sanity/lib/image'
import Newsletter from './Newsletter'
import Container from './Container'
import Image from 'next/image'
import { ArrowRight, ChevronLeft, ChevronRight} from 'lucide-react'
import { Paw_Filled } from './ui/paw'
import Link from 'next/link'

const SubCategoryContainer = () => {
    type cat = {
        title: string;
        path: string;
        imageWithAlt: Subcategory['imageWithAlt'];
    }
    
    
    function getTwoUniqueRandomIndexes(length: number): [number, number] {
    if (!Number.isInteger(length) || length < 2) {
        throw new Error('Length must be an integer >= 2');
    }

    
    const first = Math.floor(Math.random() * length);

    let second: number;
    do {
        second = Math.floor(Math.random() * length);
    } while (second === first);

    return [first, second];
    }

    const getCategory = useCallback(async() => {
        const sumResponse: cat[] = []
        const data = await getSubcategories()
        //console.log("Subcategories data:", data)
        data.forEach((item)=> {
            //console.log("subcat length",item.subcategory?.length)
            if(item.subcategory?.length && item.subcategory.length >=2){
                const [nr1, nr2] = getTwoUniqueRandomIndexes(item.subcategory.length)
                sumResponse.push({
                    title: item.subcategory[nr1].title,
                    path: item.subcategory[nr1].slug,
                    imageWithAlt: item.subcategory[nr1].imageWithAlt
                })
                sumResponse.push({
                    title: item.subcategory[nr2].title,
                    path: item.subcategory[nr2].slug,
                    imageWithAlt: item.subcategory[nr2].imageWithAlt
                })
            }
        })
        return sumResponse
    }, [])
    const [SubcatData, setSubcatData] = useState<cat[]>()
    useEffect(()=>{
        getCategory().then((res)=>{setSubcatData(res)})
    }, [getCategory])

    const itemRef = useRef<HTMLDivElement>(null)
    const leftChevronRef = React.useRef<HTMLDivElement>(null);
    const rightChevronRef = React.useRef<HTMLDivElement>(null);
  return (
    <div className='w-full bg-main h-auto font-poppins pb-5'>
        <div className='w-full overflow-hidden lg:h-[100px] h-[50px] mb-8'>
            <div className='lg:h-[200px] h-[100px] relative lg:top-[-100px] top-[-50px] bg-background lg:rounded-b-[100%] rounded-b-[40%]'></div>
        </div>
        <Container>            
            <div className='flex justify-between sm:items-end items-center lg:mx-15 sm:mx-10 mx-6 mb-6'>
                <div className='flex md:flex-row flex-col md:space-x-3 max-md:space-x-0 md:items-center items-start'>
                    <Paw_Filled className='text-[#6eb0a6] md:h-[34px] sm:h-[20px] h-[18px]'/>
                    <div className='flex lg:flex-row flex-col md:space-x-4 max-md:space-x-0 lg:items-end'>
                        <h1 className='text-black font-bold  text-[clamp(16px,1.9vw,24px)]'>Odkryj kategorie</h1>
                        <h1 className='text-black text-[clamp(12px,1.9vw,16px)] mb-1'>Wszytko, czego potrzbuje Twój pies</h1>
                    </div>
                </div>
                <div className='flex space-x-3'>
                    <div ref={leftChevronRef} className='md:w-[50px] md:h-[50px] sm:w-[40px] sm:h-[40px] w-[34px] h-[34px] flex justify-center items-center bg-white rounded-full cursor-pointer hover:bg-[#E1E1E1] transition-colors duration-300'>
                        <ChevronLeft className='text-black md:w-[24px] sm:w-[20px] w-[18px] md:h-[24px] sm:h-[20px] h-[18px]'/>
                    </div>
                    <div ref={rightChevronRef} className='md:w-[50px] md:h-[50px] sm:w-[40px] sm:h-[40px] w-[34px] h-[34px] flex justify-center items-center bg-white rounded-full cursor-pointer hover:bg-[#E1E1E1] transition-colors duration-300'>
                        <ChevronRight className='text-black md:w-[24px] sm:w-[20px] w-[18px] md:h-[24px] sm:h-[20px] h-[18px]'/>
                    </div>
                </div>
            </div>
            <Carousel rightBtn={rightChevronRef} leftBtn={leftChevronRef} bodyClassName="rounded-[clamp(40px,8vw,68px)] bg-fancy-black subcategory_shadow mb-5 xl:p-6 sm:p-5 p-3 relative z-2">
                <div className='flex 1xl:space-x-6 lg:space-x-5 sm:space-x-5 space-x-3 w-auto h-auto '>
                    {
                        !SubcatData
                        // Szkielety na czas pobierania subkategorii z Sanity — ciemne
                        // kafelki zamiast pustej karuzeli (patrz components/ui/Skeleton.tsx).
                        ? Array.from({ length: 6 }).map((_, index) => (
                            <SubcategoryTileSkeleton key={`subcat-skeleton-${index}`} />
                        ))
                        : SubcatData.map((item:cat, index)=>(
                            <div key={index} ref={itemRef} className='w-[clamp(170px,18vw,255px)] flex flex-col justify-evenly items-center group hover:scale-95 h-[clamp(240px,22vw,322px)] rounded-[35px] relative px-2 ease-in-out duration-200 border border-[#2b2b2b] bg-[#2c2c2c]'>
                                <div className='w-full flex flex-col items-center'>
                                    <div className='flex sm:w-25 w-20 sm:h-25 h-20 p-3 bg-[#93aba7] rounded-full'>
                                    {item?.imageWithAlt?.asset &&
                                        <Image src={urlFor(item.imageWithAlt.asset).url()} width={255} height={255} alt={item?.title} className='w-full z-1 rounded-[35px]' />
                                    }
                                    </div>
                                    <div className='text-white font-medium text-center flex flex-col items-center mt-4 text-[clamp(14px,1.1vw,16px)]'>
                                        <p>{item.title}</p>
                                        <hr className='text-[#e2f3f0] w-[50px]  mt-2 border border-[#e2f3f0] ease-in-out duration-300'></hr>
                                    </div>
                                </div>
                                <Link href={`/subcategory/${item.path}`} className='flex text-[clamp(11px,1.2vw,14px)] text-white space-x-1 items-center cursor-pointer'>
                                    <p>Zobacz produkty</p>
                                    <ArrowRight className=' h-4 w-4'/>
                                </Link>
                            </div>
                        ))
                    }
                </div>
            </Carousel>
            <Newsletter/>
        </Container>
    </div>
  )
}

export default SubCategoryContainer