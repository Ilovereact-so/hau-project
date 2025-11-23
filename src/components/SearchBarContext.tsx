'use client'
import React from 'react'
import { motion } from 'framer-motion'
import { Search } from 'lucide-react'
import ResearchNav from './ResearchNav'
import useMediaQuery from '@/hooks/useMediaQuery'
import { useState } from 'react'

type Props ={
    mode: number,
    SearchBarR?: React.Dispatch<React.SetStateAction<boolean>>,
    mobile: boolean
}
const SearchBarContext = ({mode, SearchBarR, mobile}: Props) => {
    const tab  = useMediaQuery('(max-width: 1023px)');
    const searchBarChange  = useMediaQuery('(max-width: 767px)');
    const [SearchBarReady, setSearchBarReady] = useState<boolean>(false);

    const SearchBarVariants = {
    startP: {
        opacity: 1,  // pojawia się → ukryty → znika
        y:0,
        height:"auto",
        transition: {
        duration: 1.2,
        times: [0, 1]
        },
    },
    endP: {
        opacity: [1, 0 , 0],  // znika → ukryty → pojawia się
        y: [0,-20, 0],
        marginTop: 0,
        width:["100%","100%","0px"],
        height:["auto","0px","0px"],
        transition: {
        duration: 1.2,
        times: [0, 0.9, 1]
        }
    },
    startU: {
        opacity: 1,  // pojawia się → ukryty → znika
        y:0,
        transition: {
        duration: 1.2,
        times: [0, 0.3, 0.7, 1]
        },
    },
    endU: {
        opacity: [1, 0, 0, 1],  // znika → ukryty → pojawia się
        y: [0, -20, -20, 0],
        transition: {
        duration: 1.2,
        times: [0, 0.3, 0.7, 1]
        }
    }
    };
    const SearchBarVariants2 = {
    startP: {
        height:["auto"],
        opacity: 0,  // pojawia się → ukryty → znika
        marginTop: 0,
        y:0,
        overflow:"hidden",
        justifyContent:"center",
        width:"0px",
        transition: {
        duration: 1.2,
        times: [0, 1]
        },
    },
    endP: {
        marginTop: 0,
        overflow:"hidden",
        justifyContent:"start",
        opacity: [0,1,1],  // znika → ukryty → pojawia się
        width:["0px","",""],
        maxWidth: !tab ? ["0px","320px","320px"] : ["0px","250px","250px"],
        minWidth: !tab ? ["0px","0px", "320px"] : ["0px","0px", "250px"],
        transition: {
        duration: 1.2,
        times: [0, 0.9,1]
        }
    },
    startU: {
        opacity: 1,  // pojawia się → ukryty → znika
        y:0,
        transition: {
        duration: 1.2,
        times: [0, 0.3, 0.7, 1]
        },
    },
    endU: {
        opacity: [1, 0, 0, 1],  // znika → ukryty → pojawia się
        y: [0, -20, -20, 0],
        transition: {
        duration: 1.2,
        times: [0, 0.3, 0.7, 1]
        }
    }
    };
    console.log(mode, mobile, searchBarChange);
    const chooseVariant = mode === 1 ? mobile == true ? (searchBarChange? "inline-flex" : "hidden") : (!searchBarChange? "inline-flex": "hidden") : "inline-flex"
  return (
    <motion.div initial={mode==1 ? "startP" : "startU"} animate={mode == 1 ? "endP": "endU"} variants={SearchBarReady ? SearchBarVariants2: SearchBarVariants} onAnimationComplete={()=>{setSearchBarReady(true); SearchBarR?.(true);}} className={`w-full h-auto sm:justify-center left-0 justify-start items-center sm:ml-0 ml-4 z-1 ${
        mode === 1 && SearchBarReady ? "mt-0 lg:min-w-[310px] min-w-[240px] sm:px-5 relative top-0":"lg:mt-5 mt-0 sm:px-10 lg:relative sm:absolute relative bottom-5 max-sm:top-0 max-lg:top-25 top-0"
    } ${
        mode === 1 ? mobile == true ? (searchBarChange? "inline-flex": "hidden"): (!searchBarChange? "inline-flex": "hidden") : "inline-flex"
    }`}>
        <div className={`h-fit rounded-full inline-flex space-x-5 px-3 py-2 w-auto   ${
        SearchBarReady && mode === 1 ? "border-1 border-black bg-[#F4F4F4]":"bg-white "
        }`}>
            <Search className='text-black xl:w-[24px] w-[20px] xl:h-[24px] h-[20px]'/>
            {/**<input placeholder='Obroża taktyczna..' className='focus:outline-none font-poppins text-[16px] placeholder:text-[16px] text-black placeholder:text-[#4E4E4E]'/> */}
            <ResearchNav isMobile={mobile} mode={mode} minWidth={!tab ? 200 : 140}/>
        </div>    
    </motion.div>
  )
}

export default SearchBarContext