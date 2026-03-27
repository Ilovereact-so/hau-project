'use client'
import React, { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Search, X } from 'lucide-react'
import ResearchNav from './ResearchNav'
import {useMediaQuery} from '@/hooks/useMediaQuery'
import { useState } from 'react'
import { useProductSearch } from '@/hooks/useProductSearch'
import { urlFor } from '@/sanity/lib/image'
import Image from 'next/image'
import PriceFormatter from './PriceFormatter'
import Link from 'next/link'
import { createPortal } from 'react-dom'
import { SearchOverlay } from './SearchOverlay'
import { set } from 'sanity'
import SearchPortal from './SearchPortal'

type Props ={
    mode: number,
    mobile: boolean,
    focusChanges?: VoidFunction,
    blurChanges?: VoidFunction,
    onQueryChange: (value: string) => void;
}

const SearchBarContext = ({mode, mobile, focusChanges, blurChanges, onQueryChange}: Props) => {
    //const tab  = useMediaQuery('(max-width: 1023px)');
    const xl = useMediaQuery('(max-width: 1279px)');
    const portalChange = useMediaQuery('(max-width: 1059px)');
    const literaly_md = useMediaQuery('(max-width: 767px)');
    //const searchBarChange  = useMediaQuery('(max-width: 767px)');

    // const SearchBarVariants = {
    // startP: {
    //     opacity: 1,  // pojawia się → ukryty → znika
    //     y:0,
    //     height:"auto",
    //     transition: {
    //     duration: 1.2,
    //     times: [0, 1]
    //     },
    // },
    // endP: {
    //     opacity: [1, 0 , 0],  // znika → ukryty → pojawia się
    //     y: [0,-20, 0],
    //     marginTop: 0,
    //     width:["100%","100%","0px"],
    //     height:["auto","0px","0px"],
    //     transition: {
    //     duration: 1.2,
    //     times: [0, 0.9, 1]
    //     }
    // },
    // startU: {
    //     opacity: 1,  // pojawia się → ukryty → znika
    //     y:0,
    //     transition: {
    //     duration: 1.2,
    //     times: [0, 0.3, 0.7, 1]
    //     },
    // },
    // endU: {
    //     opacity: [1, 0, 0, 1],  // znika → ukryty → pojawia się
    //     y: [0, -20, -20, 0],
    //     transition: {
    //     duration: 1.2,
    //     times: [0, 0.3, 0.7, 1]
    //     }
    // }
    // };
    // const SearchBarVariants2 = {
    // startP: {
    //     height:["auto"],
    //     opacity: 0,  // pojawia się → ukryty → znika
    //     marginTop: 0,
    //     y:0,
    //     overflow:"hidden",
    //     justifyContent:"center",
    //     width:"0px",
    //     transition: {
    //     duration: 1.2,
    //     times: [0, 1]
    //     },
    // },
    // endP: {
    //     marginTop: 0,
    //     overflow:"hidden",
    //     justifyContent: !searchBarChange ? "start" : "end",
    //     opacity: [0,1,1],  // znika → ukryty → pojawia się
    //     width:!searchBarChange ? ["0px","",""] : !mobile ? ["0px","","fit-content"] : ["0px","","100%"],
    //     maxWidth: !tab ? ["0px","320px","320px"] : !mobile ? ["0px","250px","250px"] : ["0px","100%","100%"],
    //     minWidth: !tab ? ["0px","0px", "320px"] : !searchBarChange ? ["0px","0px", "250px"]: ["0px","0px", "fit-content"],
    //     transition: {
    //     duration: 1.2,
    //     times: [0, 0.9,1]
    //     }
    // },
    // startU: {
    //     opacity: 1,  // pojawia się → ukryty → znika
    //     y:0,
    //     transition: {
    //     duration: 1.2,
    //     times: [0, 0.3, 0.7, 1]
    //     },
    // },
    // endU: {
    //     opacity: [1, 0, 0, 1],  // znika → ukryty → pojawia się
    //     y: [0, -20, -20, 0],
    //     transition: {
    //     duration: 1.2,
    //     times: [0, 0.3, 0.7, 1]
    //     }
    // }
    // };
    // console.log(mode, mobile, searchBarChange);
    //mode === 1 ? mobile == true ? (searchBarChange? "inline-flex": "hidden"): (!searchBarChange? "inline-flex": "hidden") : "inline-flex"
    //initial={mode==1 ? "startP" : "startU"} animate={mode == 1 ? "endP": "endU"}
    const [query, setQuery] = useState<string>("")
    const { results, loading } = useProductSearch(query)
    const md = useMediaQuery('(max-width: 920px)')
    const anchorRef = useRef<HTMLDivElement>(null)
    const counts: Record<string, number> = {}

    const handleChange = (e: string) => {
        const value = e;

        setQuery(value);        // aktualizacja state dziecka
        onQueryChange(value);   // przekazanie do rodzica
    };
    results.forEach((item) => {
    const key = item.path

    counts[key] = (counts[key] || 0) + 1
    })
    
  return (
    <motion.div  className={`h-auto sm:justify-center left-0 justify-start flex sm:ml-0 z-3 ${
        mode === 1 ? "mt-0 xl:min-w-[310px] max-w-max md:px-5 relative top-0 w-full items-center max-sm:max-w-[calc(100%-70px)] ml-4":"2xl:mt-5 mt-0 sm:items-start items-center sm:px-10 2xl:relative absolute max-sm:relative bottom-5 max-sm:top-0 max-2xl:top-21 top-0 sm:w-full w-fit max-sm:overflow-y-auto max-sm:overflow-x-hidden rounded-[14px]"
    }`}>
        <motion.div ref={anchorRef} initial={{padding:"0px", borderRadius:"40px"}} animate={query ? {paddingInlineStart: mode === 0 ? !md ? "40px" : "20px" : !literaly_md ? "8px":"0", paddingInlineEnd:  mode === 0 ?  !md ? "40px" : "20px" : !literaly_md ? "8px":"0",padding: mode === 1 ?  (!literaly_md ? "8px":"0") : "8px", borderRadius:  mode === 0 ? "14px" : query.length < 2 && results.length === 0 ? "28px":"28px 28px 0px 0px"}:{padding:"0px", borderRadius:"40px"}} transition={{duration:0.3, ease:"linear"}} className={`bg-[#D1EAE5]/85 flex flex-col items-center  max-w-full ${
            mode === 0 ? "backdrop-blur-[4px] w-auto" : "relative md:w-auto w-full"
        }`}>
            <div className={` inline-flex space-x-5 max-w-[100%] overflow-hidden px-3 py-2    ${
            mode === 1 ? "md:border-1 border-l-1 md:border-[#838383] border-[#838383] bg-fancy-black md:h-fit h-full max-sm:w-full md:rounded-full rounded-l-full":"bg-white h-fit w-min rounded-full"
            }`}>
                <Search className={` xl:min-w-[24px] min-w-[20px] xl:min-h-[24px] min-h-[20px] ${
                    mode === 1 ? "text-white":"text-black"   
                }`}/>
                {/**<input placeholder='Obroża taktyczna..' className='focus:outline-none font-poppins text-[16px] placeholder:text-[16px] text-black placeholder:text-[#4E4E4E]'/> */}
                <ResearchNav isMobile={mobile} mode={mode} value={query} setValue={(e)=>handleChange(e)} focusChanges={focusChanges} blurChanges={blurChanges} minWidth={!xl ? 200 : 140} maxWidth={mode === 1 && !mobile ? 320 : undefined}/>
                <X className={`cursor-pointer text-[#838383]  xl:w-[24px] w-[20px] xl:h-[24px] h-[20px] ${query ? "inline-flex" : "hidden"}`} onClick={() => handleChange("")}></X>
            </div>
            {query && results.length > 0 && !loading &&
                <>
                    <div className='bottom-0 left-0 translate-x-[-100%] absolute w-[20px] h-[20px] overflow-hidden'>
                        <div id="search-sh" className="w-full h-full rounded-br-[28px]"></div>
                    </div> 
                    <div className='bottom-0 lg:hidden max-md:hidden right-0 translate-x-[100%] absolute w-[20px] h-[20px] overflow-hidden'>
                        <div id="search-sh2" className="w-full h-full rounded-bl-[28px]"></div>
                    </div>
                </>
            }

            {(query && !portalChange) || mode == 0 ? (
                <Context loading={loading} mode={mode} results={results} query={query} counts={counts} handleChange={handleChange} />
            ):(
                <SearchPortal anchorRef={anchorRef} query={query} results={results} loading={loading}>
                    <Context loading={loading} mode={mode} results={results} query={query} counts={counts} handleChange={handleChange} />
                </SearchPortal>
                
            )}
            {/* <div className={`${
                mode === 1 && "absolute min-w-[100%] w-max top-[100%] right-0 bg-[#D1EAE5]/95 backdrop-blur-[2px]"
                } ${
                    mode === 1 ? results.length === 0  || loading ? "rounded-t-[0px] rounded-b-[14px] px-3" : "rounded-[14px] rounded-tr-[0px] md:px-10 px-5 py-3" : "w-auto"
                }`}>
                {query && (
                    <SearchOverlay onClose={() => handleChange("")} />
                )}
                
                {query && !portalChange ? (
                    <Context loading={loading} mode={mode} results={results} query={query} counts={counts} />
                ):
                <SearchPortal anchorRef={anchorRef}>
                    <Context loading={loading} mode={mode} results={results} query={query} counts={counts} />
                </SearchPortal>
                }   
        </div> */}
      </motion.div> 
    </motion.div>
  )
}

type contextProps = {
    loading: boolean,
    mode: number,
    results: any[],
    query: string,
    counts: Record<string, number>,
    handleChange: (e:string) => void
}
const Context = ({loading, mode, results, query, counts, handleChange}:contextProps)=>{

    return(
        <div className={`${
                mode === 1 && "lg:absolute min-w-[100%] lg:w-max top-[100%] right-0 bg-[#D1EAE5]/95 backdrop-blur-[2px]"
                } ${
                    mode === 1 ? results.length === 0  || loading ? "rounded-t-[0px] rounded-b-[14px] px-3" : "rounded-[14px] lg:rounded-tr-[0px] md:px-10 px-5 py-3" : "w-auto"
                }`}>
                {query && (
                    <SearchOverlay onClose={() => handleChange("")} />
                )}
                {query && 
                <AnimatePresence>
                    <div className="z-10 w-full">
                    {loading && (
                        <motion.div initial={{opacity:"hidden"}} animate={{ opacity:"1"}} className={`p-3 text-sm text-[#4c8e8e] ${
                            mode === 1 && "w-full"
                        }`}>Searching...</motion.div>
                    )}

                    {!loading && results.length === 0&& query.length > 1 && (
                        <motion.div initial={{height:0, padding:0}} animate={{ height:"auto", padding:"12px"}} className="p-3 text-sm text-[#4c8e8e] overflow-hidden">
                        Nie znaleziono produktu
                        </motion.div>
                    )}

                    {!loading && results.length != 0 &&
                    <div className='flex flex-col w-full'>
                        <div className='flex flex-col p-2 pt-4 font-poppins'>
                            <h1 className={` text-black font-medium ${
                                mode === 1 ? "text-[clamp(12px,1.6vw,14px)]":"text-[clamp(14px,1.6vw,16px)]"
                            }`}>Podpowiedz wyszukiwania:</h1>
                            <div className='grid sm:grid-cols-[repeat(2,minmax(0,1fr))] grid-cols-1 gap-x-10 md:gap-y-2 gap-y-1 mt-2 px-4'>
                                {Object.entries(counts).map(([key, count]) => (
                                    <div key={key} className={`text-black space-x-8 flex justify-between items-center ${
                                        mode === 1 ? "text-[clamp(12px,1.6vw,14px)]":"text-[clamp(14px,1.6vw,16px)]"
                                    }`}>
                                        <p>{key}</p>
                                        <p>{count}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div id='search-scroll-container' className='sm:flex search-scroll grid-cols-[repeat(2,minmax(0,1fr))] grid 3xs:grid-cols-[repeat(3,minmax(0,1fr))] sm:grid-cols-none sm:space-x-2 max-sm:gap-3 max-sm:justify-items-center 1md:justify-between mt-5 w-full overflow-auto'>
                            {results.slice(0,5).map((product) => (
                                <Link
                                    href={`/product/${product?.slug}?variant=${product?.variants?.[0]?._key}`}
                                    key={product._id}
                                    className="cursor-pointer flex flex-col pb-2 min-w-[130px]"
                                >
                                    {product?.images && 
                                        <Image src={urlFor(product?.images[0]).url()} alt={String(product?.title)} width={154} height={154} className=' w-[154px] h-[154px] opacity-90 brightness-95 object-cover'/>
                                    }
                                    <p className={`font-medium text-black mt-2 line-clamp-1 w-fit max-w-[154px] ${
                                        mode === 1 ? "lg:text-[13px] text-[12px]":"lg:text-[14px] text-[13px]"
                                    }`}>{product?.title}</p>
                                    {product.compareAtPrice ? 
                                    <div className='flex justify-between items-center'>
                                        <h1 className="1xl:text-[14px] lg:text-[13px] text-[11px] text-[#DD1919] font-bold"><PriceFormatter amount={product?.price}/></h1>
                                        <h1 className='text-black 1xl:text-[13px] lg:text-[11px] text-[10px]'><span className='mr-1 line-through'>{product?.compareAtPrice}zł</span>{ (100 - ((parseFloat(String(product?.compareAtPrice)) / parseFloat(String(product?.price))) * 100)).toFixed(0)}%</h1>
                                    </div>
                                    :
                                    <div>
                                        <h1 className="1xl:text-[14px] lg:text-[13px] text-[11px] text-black font-bold"><PriceFormatter amount={product?.price}/></h1>
                                    </div>
                                    }
                                </Link>
                            ))}
                        </div>
                    </div>
                    }
                </div>
                </AnimatePresence>
                }
        </div>
            
    )
}

export default SearchBarContext