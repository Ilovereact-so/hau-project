'use client'
import React from 'react'
import { motion } from 'framer-motion'
import { Search } from 'lucide-react'
import ResearchNav from './ResearchNav'
import {useMediaQuery} from '@/hooks/useMediaQuery'
import { useState } from 'react'

type Props ={
    mode: number,
    mobile: boolean,
    focusChanges?: VoidFunction,
    blurChanges?: VoidFunction
}
const SearchBarContext = ({mode, mobile, focusChanges, blurChanges}: Props) => {
    //const tab  = useMediaQuery('(max-width: 1023px)');
    const xl = useMediaQuery('(max-width: 1279px)');
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
  return (
    <motion.label className={`h-auto sm:justify-center left-0 justify-start flex items-center sm:ml-0 ml-4 z-1 ${
        mode === 1 ? "mt-0 xl:min-w-[310px] min-w-auto md:px-5 relative top-0 sm:w-auto w-full max-sm:max-w-[calc(100%-70px)]":"2xl:mt-5 mt-0 sm:px-10 2xl:relative absolute max-sm:relative bottom-5 max-sm:top-0 max-2xl:top-28 top-0 w-full"
    }`}>
        <div className={` inline-flex space-x-5 max-w-[100%] overflow-hidden px-3 py-2    ${
         mode === 1 ? "md:border-1 border-l-1 md:border-[#838383] border-[#838383] bg-fancy-black md:h-fit h-full max-sm:w-full md:rounded-full rounded-l-full":"bg-white h-fit w-auto rounded-full"
        }`}>
            <Search className={` xl:min-w-[24px] min-w-[20px] xl:min-h-[24px] min-h-[20px] ${
                mode === 1 ? "text-white":"text-black"   
            }`}/>
            {/**<input placeholder='Obroża taktyczna..' className='focus:outline-none font-poppins text-[16px] placeholder:text-[16px] text-black placeholder:text-[#4E4E4E]'/> */}
            <ResearchNav isMobile={mobile} mode={mode} focusChanges={focusChanges} blurChanges={blurChanges} minWidth={!xl ? 200 : 140} maxWidth={mode === 1 && !mobile ? 320 : undefined}/>
        </div>    
    </motion.label>
  )
}

export default SearchBarContext