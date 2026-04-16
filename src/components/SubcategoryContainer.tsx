import React, { useEffect, useRef, useState } from 'react'
import Carousel from './Carousel'
import { category } from '@/constants'
import { getSubcategories } from '@/sanity/helpers/clientRequest'
import { Subcategory } from '../../sanity.types'
import { urlFor } from '@/sanity/lib/image'
import { get } from 'http'
import Newsletter from './Newsletter'
import Container from './Container'

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

    const getCategory = async() => {
        const sumResponse: cat[] = []
        const data = await getSubcategories()
        //console.log("Subcategories data:", data)
        data.forEach((item, index)=> {
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
    }
    const [SubcatData, setSubcatData] = useState<cat[]>()
    useEffect(()=>{
        getCategory().then((res)=>{setSubcatData(res)})
    }, [])

    const itemRef = useRef<HTMLDivElement>(null)
    const  BottomHeavyH1 = ({text, className}:{text:string, className:string}) => {

        const ref = useRef<HTMLHeadingElement>(null);
        const [lines, setLines] = useState([text]);

        useEffect(() => {
            if (!ref.current) return;
            
            const container = ref.current;
            const words = text?.split(" ");
            if(!words) return;
            // Funkcja sprawdzająca ile słów mieści się w pierwszej linii
            const getSplitIndex = () => {
            for (let i = 1; i < words.length; i++) {
                const temp = document.createElement("span");
                temp.style.visibility = "hidden";
                temp.style.position = "absolute";
                temp.style.whiteSpace = "nowrap";
                temp.style.font = window.getComputedStyle(container).font;
                temp.textContent = words.slice(0, i).join(" ");
                document.body.appendChild(temp);
                const fits = temp.offsetWidth <= container.clientWidth;
                document.body.removeChild(temp);
                if (!fits) return i - 1; // ostatnie mieszczące się słowo
            }
            return words.length; // całość mieści się w jednej linii
            };

            const splitIndex = getSplitIndex();

            if (splitIndex === words.length) {
            setLines([text]); // jedna linia
            } else {
            setLines([words.slice(0, splitIndex).join(" "), words.slice(splitIndex).join(" ")]);
            }
        }, [text]);

        return (
            <h1 ref={ref} className={className}>
            {lines.map((line, i) => (
                <React.Fragment key={i}>
                {line}
                {i === 0 && lines.length > 1 ? <br /> : null}
                </React.Fragment>
            ))}
            </h1>
        );
    }
  return (
    <div className='w-full bg-main h-auto font-poppins pb-5'>
        <div className='w-full overflow-hidden h-[100px] mb-8'>
            <div className='h-[200px] relative top-[-100px] bg-background rounded-b-[100%]'></div>
        </div>
        <Container>
        <div className='flex justify-between lg:mx-25 md:mx-18 mx-10 mb-6'>
            <div className='flex flex-col'>
                <h1 className='text-black text-[clamp(16px,1.9vw,24px)]'>Przyspiesz szukanie: </h1>
                <h1 className='text-black font-bold text-[clamp(16px,1.9vw,24px)]'>Przeglądaj Podkategorie</h1>
            </div>
        </div>
        <Carousel bodyClassName="bg-fancy-black rounded-[clamp(40px,8vw,68px)] xl:p-6 sm:p-5 p-3">
            <div className='flex 1xl:space-x-6 lg:space-x-5 sm:space-x-5 space-x-3 w-auto h-auto'>
                {
                    SubcatData?.map((item:cat, index)=>(
                        <div key={index} ref={itemRef} style={item.imageWithAlt?.asset && {backgroundImage:`url(${urlFor(item.imageWithAlt.asset).url()})`}} className='w-[clamp(170px,18vw,255px)] h-[clamp(220px,22vw,322px)] bg-white bg-cover rounded-[35px] relative'>
                            <BottomHeavyH1 text={item?.title} className='absolute left-5 bottom-5 text-white font-bold font-poppins text-[clamp(13px,1.7vw,18px)] w-[80%]'/>
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