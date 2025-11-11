import React, { useEffect, useRef, useState } from 'react'
import Carousel from './Carousel'
import { category } from '@/constants'

const SubCategoryContent = () => {
    type cat = {
        name: string;
        path: string;
    }
    const [isCategory, setCategory] = useState<cat[]>([])
    const loading = false
    const [numbers, setNumbers] = useState<number[][]>([]);
    
    useEffect(() => {
        handleRandomize();
    }, []);

    useEffect(() => {
        console.log("Numbers zaktualizowane:", numbers);
        getCategory()
    }, [numbers]);

    const getRandomFromArray = (arr: number[]): number =>
    arr[Math.floor(Math.random() * arr.length)];

    const handleRandomize = () => {
        setNumbers((prevNumbers) =>
            category.map((cat, i) => {

                const used = prevNumbers[i] || [];

                const available = cat.subcategory
                .map((_, sub_i) => sub_i)
                .filter((sub_i) => !used.includes(sub_i));

                const newSelections: number[] = [];

                for (let j = 0; j < 2 && available.length > 0; j++) {
                    const remaining = available.filter((n) => !newSelections.includes(n));
                    if (remaining.length === 0) break;
                        const picked = getRandomFromArray(remaining);
                        newSelections.push(picked);
                }

                return [...used, ...newSelections];
            })
        );
        
    };
    const getCategory = () => {
        console.log(numbers)
        const items = category?.flatMap((item,i)=>{
            return numbers[i]?.map((num)=> item.subcategory[num] || [])
        })
        setCategory(items)
        console.log(items)
    }

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
    <div className='w-full h-auto font-poppins lg:mt-12 mt-8'>
        <div className='flex justify-between lg:mx-25 md:mx-18 mx-10 lg:mb-11 mb-8'>
            <div className='flex flex-col'>
                <h1 className='text-black text-[clamp(13px,2vw,30px)]'>Przyspiesz szukanie: </h1>
                <h1 className='text-black font-bold text-[clamp(13px,2vw,30px)]'>Przeglądaj Podkategorie</h1>
            </div>
        </div>
        <Carousel>
            <div className='flex 1xl:space-x-10 lg:space-x-7 space-x-5 w-auto h-auto'>
                {
                    loading ? <span>Products is loading...</span> :
                    isCategory?.map((item:cat, index)=>(
                        <div key={index} ref={itemRef} className='w-[clamp(170px,25vw,255px)] h-[clamp(210px,30vw,322px)] rounded-[35px] bg-slate-300 relative'>
                            <BottomHeavyH1 text={item?.name} className='absolute left-5 bottom-5 text-white font-bold font-poppins text-[18px] w-[80%]'/>
                        </div>
                    ))
                }
            </div>
        </Carousel>
    </div>
  )
}

export default SubCategoryContent